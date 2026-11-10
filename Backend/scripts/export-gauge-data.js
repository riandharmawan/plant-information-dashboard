/**
 * Export the gauge data of one or more sites (tanks, readings, capacities, gauge sources) to a JSON file
 * that import-gauge-data.js loads into another database, for example staging.
 *
 *   node scripts/export-gauge-data.js --sites=bontang,tanjung-pura --out=backups/gauge-data.json
 *
 * Reads DATABASE_URL from Backend/.env or the environment, else the repo's .env.dev (the dev database).
 * Never exported: gauge passwords (only sources with no sign-in are kept), user ids, and anything outside
 * the gauge tables. Daily rounds from gauges (soundings with a source other than logsheet) are included.
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

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null
const sites = (arg('sites') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const out = arg('out') ?? 'backups/gauge-data.json'
if (sites.length === 0 || !process.env.DATABASE_URL) {
  console.error('Usage: node scripts/export-gauge-data.js --sites=bontang,tanjung-pura [--out=backups/gauge-data.json]')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const rows = async (sql, params) => (await pool.query(sql, params)).rows.map((row) => row.j)

try {
  const found = await pool.query('SELECT id FROM sites WHERE id = ANY($1::text[])', [sites])
  const missing = sites.filter((id) => !found.rows.some((row) => row.id === id))
  if (missing.length) throw new Error(`Unknown site: ${missing.join(', ')}`)

  const tankScope = `tank_id IN (SELECT t.id FROM tanks t JOIN plants p ON p.id = t.plant_id WHERE p.site_id = ANY($1::text[]) AND t.source = 'atg')`
  const bundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    sites,
    tables: {
      plants: await rows(
        `SELECT jsonb_build_object('id', p.id, 'site_id', p.site_id, 'name', p.name, 'is_active', p.is_active) AS j
         FROM plants p WHERE p.site_id = ANY($1::text[]) AND p.id = p.site_id || '-default'`,
        [sites],
      ),
      tanks: await rows(
        `SELECT jsonb_build_object('id', t.id, 'plant_id', t.plant_id, 'code', t.code, 'name', t.name,
                                   'sort_order', t.sort_order, 'source', t.source, 'stock_group', t.stock_group) AS j
         FROM tanks t JOIN plants p ON p.id = t.plant_id
         WHERE p.site_id = ANY($1::text[]) AND t.source = 'atg' ORDER BY t.sort_order, t.code`,
        [sites],
      ),
      tank_profiles: await rows(`SELECT to_jsonb(x) AS j FROM tank_profiles x WHERE ${tankScope}`, [sites]),
      tank_gauging_info: await rows(`SELECT to_jsonb(x) AS j FROM tank_gauging_info x WHERE ${tankScope}`, [sites]),
      tank_gauging_tank_map: await rows(
        `SELECT to_jsonb(x) - 'id' - 'created_at' - 'updated_at' AS j FROM tank_gauging_tank_map x WHERE x.site_id = ANY($1::text[])`,
        [sites],
      ),
      tank_gauging_latest: await rows(`SELECT to_jsonb(x) AS j FROM tank_gauging_latest x WHERE ${tankScope}`, [sites]),
      tank_gauging_samples: await rows(
        `SELECT to_jsonb(x) - 'id' AS j FROM tank_gauging_samples x WHERE ${tankScope} ORDER BY x.sampled_at`,
        [sites],
      ),
      tank_gauging_sources: await rows(
        `SELECT jsonb_build_object('site_id', x.site_id, 'base_url', x.base_url, 'label', x.label, 'enabled', x.enabled) AS j
         FROM tank_gauging_sources x WHERE x.site_id = ANY($1::text[]) AND x.auth_type = 'none'`,
        [sites],
      ),
      tank_gauging_settings: await rows(
        `SELECT jsonb_build_object('site_id', x.site_id, 'round_times', x.round_times, 'round_tolerance_min', x.round_tolerance_min) AS j
         FROM tank_gauging_settings x WHERE x.site_id = ANY($1::text[])`,
        [sites],
      ),
      stock_groups: await rows(
        `SELECT jsonb_build_object('site_id', x.site_id, 'code', x.code, 'name', x.name, 'sort_order', x.sort_order) AS j
         FROM stock_groups x WHERE x.site_id = ANY($1::text[])`,
        [sites],
      ),
      site_modules: await rows(
        `SELECT jsonb_build_object('site_id', x.site_id, 'module_key', x.module_key) AS j
         FROM site_modules x WHERE x.site_id = ANY($1::text[])`,
        [sites],
      ),
      soundings: await rows(
        `SELECT to_jsonb(x) - 'id' - 'submission_id' - 'commodity_id' AS j FROM soundings x
         WHERE x.site_id = ANY($1::text[]) AND x.source <> 'logsheet'`,
        [sites],
      ),
    },
  }

  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true })
  fs.writeFileSync(out, JSON.stringify(bundle))
  const counts = Object.entries(bundle.tables).map(([name, list]) => `${name}=${list.length}`).join('  ')
  console.log(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)\n${counts}`)
} finally {
  await pool.end()
}
