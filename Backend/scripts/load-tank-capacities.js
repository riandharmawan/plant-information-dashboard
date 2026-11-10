/**
 * Save tank capacities from a file into the tank master, for a site whose gauge gives none.
 * A capacity saved in the master takes priority over the one the gauge reports.
 *
 *   node scripts/load-tank-capacities.js scripts/tank-capacities/tanjung-pura.json
 *   node scripts/load-tank-capacities.js <file> --dry-run
 *
 * The file: { "siteId": "...", "unit": "ton"|"kg", "capacities": { "<tank code>": amount } }.
 * Tanks not in the site are listed and skipped. Existing bottom stock and other profile fields stay.
 * Reads DATABASE_URL from Backend/.env or the environment, else the repo's .env.dev (dev database).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config()
const here = path.dirname(fileURLToPath(import.meta.url))
const devFile = path.resolve(here, '../../.env.dev')
if (!process.env.DATABASE_URL && fs.existsSync(devFile)) {
  const dev = dotenv.parse(fs.readFileSync(devFile))
  process.env.DATABASE_URL = `postgresql://${dev.POSTGRES_USER || 'pid_user'}:${encodeURIComponent(dev.POSTGRES_PASSWORD || '')}@127.0.0.1:5437/${dev.POSTGRES_DB || 'pid_db'}`
}

const file = process.argv[2]
const dry = process.argv.includes('--dry-run')
if (!file || !process.env.DATABASE_URL) {
  console.error('Usage: node scripts/load-tank-capacities.js <file.json> [--dry-run]')
  process.exit(1)
}
const spec = JSON.parse(fs.readFileSync(file, 'utf8'))
if (!['ton', 'kg'].includes(spec.unit)) throw new Error('unit must be ton or kg')

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
try {
  const tanks = await pool.query(
    'SELECT t.id, t.code FROM tanks t JOIN plants p ON p.id = t.plant_id WHERE p.site_id = $1',
    [spec.siteId],
  )
  const byCode = new Map(tanks.rows.map((row) => [String(row.code).toLowerCase(), row.id]))
  let saved = 0
  const missing = []
  for (const [code, amount] of Object.entries(spec.capacities)) {
    const id = byCode.get(code.toLowerCase())
    if (!id) {
      missing.push(code)
      continue
    }
    if (!(Number(amount) > 0)) throw new Error(`capacity for ${code} must be above 0`)
    if (!dry) {
      await pool.query(
        `INSERT INTO tank_profiles (tank_id, capacity, capacity_unit, origin) VALUES ($1, $2, $3, 'report')
         ON CONFLICT (tank_id) DO UPDATE SET capacity = EXCLUDED.capacity, capacity_unit = EXCLUDED.capacity_unit`,
        [id, amount, spec.unit],
      )
    }
    saved += 1
  }
  console.log(`${dry ? 'would save' : 'saved'} ${saved} capacities for ${spec.siteId}` + (missing.length ? `; not found: ${missing.join(', ')}` : ''))
} finally {
  await pool.end()
}
