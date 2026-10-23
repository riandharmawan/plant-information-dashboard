import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'

const here = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(here, '../.env') })
dotenv.config({ path: path.join(here, '../../.env.dev') })

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const user = process.env.POSTGRES_USER
  const password = process.env.POSTGRES_PASSWORD
  const database = process.env.POSTGRES_DB || 'pid_db'
  if (!user || !password) return ''
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:5437/${database}`
}

const siteId = 'bekasi'
const plantId = 'priscolin-proj-bekasi'

function tankCode(text) {
  if (!text) return null
  return String(text).replace(/\./g, '').replace(/\s+/g, ' ').trim()
}

function arg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

if (process.argv.includes('--verify')) {
  const from = arg('--from')
  const to = arg('--to')
  const connectionString = databaseUrl()
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  if (!from || !to) throw new Error('Verify needs --from and --to')
  const pool = new pg.Pool({ connectionString })
  try {
    const result = await pool.query(
      `SELECT d.production_date::text AS day, pu.code AS unit, count(r.id)::int AS readings
       FROM refinery_quality_days d
       JOIN process_units pu ON pu.id = d.process_unit_id
       LEFT JOIN refinery_quality_readings r ON r.day_id = d.id
       WHERE d.site_id = $1 AND d.production_date >= $2::date AND d.production_date <= $3::date
       GROUP BY d.production_date, pu.code
       ORDER BY 1, 2`,
      [siteId, from, to],
    )
    console.log(JSON.stringify({ days: result.rows }))
  } finally {
    await pool.end()
  }
} else {
await upsertDay()
}

async function upsertDay() {
const chunks = []
for await (const chunk of process.stdin) chunks.push(chunk)
const day = JSON.parse(Buffer.concat(chunks).toString('utf8'))

const connectionString = databaseUrl()
if (!connectionString) throw new Error('DATABASE_URL is not set')
if (!day?.productionDate || !day?.processUnit) throw new Error('The parsed day is missing a production date or process unit')

const pool = new pg.Pool({ connectionString })
const client = await pool.connect()
try {
  const definition = await client.query(
    'SELECT id FROM logsheet_definitions WHERE site_id = $1 AND form_code = $2',
    [siteId, 'F/QCO-002'],
  )
  if (!definition.rows[0]) throw new Error('Missing logsheet definition F/QCO-002')
  const unit = await client.query(
    'SELECT id FROM process_units WHERE plant_id = $1 AND code = $2',
    [plantId, day.processUnit],
  )
  if (!unit.rows[0]) throw new Error(`Missing process unit ${day.processUnit}`)

  const tankRows = await client.query('SELECT id, code FROM tanks WHERE plant_id = $1', [plantId])
  const tanks = new Map(tankRows.rows.map((row) => [row.code, row.id]))
  const aliasRows = await client.query(
    'SELECT source_text, commodity_id FROM commodity_aliases WHERE site_id = $1',
    [siteId],
  )
  const aliasOf = new Map(aliasRows.rows.map((row) => [row.source_text, row.commodity_id]))
  const commodityId = (text) => (text ? aliasOf.get(text) ?? aliasOf.get(String(text).toLowerCase()) ?? null : null)
  const tankId = (text) => {
    const code = tankCode(text)
    return code ? tanks.get(code) ?? null : null
  }

  await client.query('BEGIN')
  const submission = await client.query(
    `INSERT INTO logsheet_submissions (definition_id, business_key, period_start, period_end, payload)
     VALUES ($1,$2,$3,$3,$4::jsonb)
     ON CONFLICT (definition_id, business_key) DO UPDATE
       SET payload = EXCLUDED.payload, period_start = EXCLUDED.period_start, period_end = EXCLUDED.period_end, imported_at = NOW()
     RETURNING id`,
    [definition.rows[0].id, `${day.productionDate}|${day.processUnit}`, day.productionDate, JSON.stringify(day)],
  )
  await client.query(
    'DELETE FROM refinery_quality_days WHERE process_unit_id = $1 AND production_date = $2',
    [unit.rows[0].id, day.productionDate],
  )
  const dayRow = await client.query(
    `INSERT INTO refinery_quality_days (
       site_id, plant_id, process_unit_id, submission_id, production_date, report_date, declared_oils
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id`,
    [
      siteId, plantId, unit.rows[0].id, submission.rows[0].id,
      day.productionDate, day.reportDate, day.declaredOils ?? '',
    ],
  )
  let readings = 0
  for (const reading of day.readings ?? []) {
    const inserted = await client.query(
      `INSERT INTO refinery_quality_readings (
         day_id, row_index, observed_time, from_tank_text, from_tank_id, flow_rate, remark
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [
        dayRow.rows[0].id, reading.rowIndex, reading.time, reading.fromTank,
        tankId(reading.fromTank), reading.flowRate, reading.remark,
      ],
    )
    readings += 1
    for (const [stream, item] of Object.entries(reading.streams ?? {})) {
      if (!item) continue
      const streamRow = await client.query(
        `INSERT INTO refinery_quality_streams (
           reading_id, stream, commodity_text, commodity_id, destination_text, destination_tank_id
         ) VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id`,
        [
          inserted.rows[0].id, stream, item.commodity, commodityId(item.commodity), item.destination,
          tankId(item.destination),
        ],
      )
      for (const [codeName, value] of Object.entries(item.parameters ?? {})) {
        if (value == null || value === '' || value === '-') continue
        const numeric = typeof value === 'number'
        await client.query(
          `INSERT INTO refinery_quality_parameters (stream_id, canonical_code, numeric_value, text_value)
           VALUES ($1,$2,$3,$4)`,
          [streamRow.rows[0].id, codeName, numeric ? value : null, numeric ? null : String(value)],
        )
      }
    }
  }
  await client.query('COMMIT')
  console.log(JSON.stringify({ productionDate: day.productionDate, processUnit: day.processUnit, readings }))
} catch (error) {
  await client.query('ROLLBACK')
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
}
