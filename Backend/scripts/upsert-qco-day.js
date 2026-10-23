import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'

const here = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(here, '../../.env.dev') })
dotenv.config()
if (!process.env.DATABASE_URL && process.env.POSTGRES_USER && process.env.POSTGRES_PASSWORD && process.env.POSTGRES_DB) {
  const user = encodeURIComponent(process.env.POSTGRES_USER)
  const password = encodeURIComponent(process.env.POSTGRES_PASSWORD)
  const database = encodeURIComponent(process.env.POSTGRES_DB)
  const port = process.env.POSTGRES_PORT || '5437'
  process.env.DATABASE_URL = `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`
}
pg.types.setTypeParser(1082, (value) => value)

const siteId = 'bekasi'
const plantId = 'priscolin-proj-bekasi'
const CERT_TESTS = [
  ['ffa', 'lab.ffa'],
  ['moisture', 'lab.moisture'],
  ['colorR', 'lab.color_r'],
  ['colorY', 'lab.color_y'],
  ['iv', 'lab.iv'],
  ['pv', 'lab.pv'],
  ['smp', 'lab.smp'],
  ['cloudPoint', 'lab.cloud_point'],
  ['anv', 'lab.anv'],
  ['carotene', 'lab.carotene'],
  ['phosphorus', 'lab.phosphorus'],
  ['dobi', 'lab.dobi'],
  ['totox', 'lab.totox'],
]

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) throw new Error('Expected a JSON payload on stdin')
  return JSON.parse(text)
}

async function definitionId(client) {
  const result = await client.query(
    'SELECT id FROM logsheet_definitions WHERE site_id = $1 AND form_code = $2',
    [siteId, 'F/QCO-001'],
  )
  if (!result.rows[0]) throw new Error('Missing logsheet definition F/QCO-001')
  return result.rows[0].id
}

async function cursor(client) {
  const result = await client.query(
    `SELECT MAX(c.snapshot_on)::text AS snapshot_on
     FROM storage_certificates c
     JOIN logsheet_submissions s ON s.id = c.submission_id
     JOIN logsheet_definitions d ON d.id = s.definition_id
     WHERE c.site_id = $1 AND d.form_code = 'F/QCO-001'`,
    [siteId],
  )
  return result.rows[0]?.snapshot_on ?? null
}

async function saveSubmission(client, definition, snapshotOn, businessKey, payload) {
  const encoded = JSON.stringify(payload)
  const existing = await client.query(
    `SELECT id, (payload = $3::jsonb) AS same
     FROM logsheet_submissions
     WHERE definition_id = $1 AND business_key = $2`,
    [definition, businessKey, encoded],
  )
  if (!existing.rows[0]) {
    const inserted = await client.query(
      `INSERT INTO logsheet_submissions (definition_id, business_key, period_start, period_end, payload)
       VALUES ($1,$2,$3,$3,$4::jsonb)
       RETURNING id`,
      [definition, businessKey, snapshotOn, encoded],
    )
    return { id: inserted.rows[0].id, history: false }
  }
  const id = existing.rows[0].id
  if (existing.rows[0].same) return { id, history: false }
  await client.query(
    `INSERT INTO submission_history (submission_id, payload)
     SELECT id, payload FROM logsheet_submissions WHERE id = $1`,
    [id],
  )
  await client.query(
    `UPDATE logsheet_submissions
     SET payload = $2::jsonb, period_start = $3, period_end = $3, imported_at = NOW()
     WHERE id = $1`,
    [id, encoded, snapshotOn],
  )
  return { id, history: true }
}

async function upsertDay(client, body) {
  const snapshotOn = body.snapshotOn
  const revision = body.revision ?? 1
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshotOn ?? '')) throw new Error('snapshotOn is required')
  const definition = await definitionId(client)
  const tankRows = await client.query('SELECT id, code FROM tanks WHERE plant_id = $1', [plantId])
  const tanks = new Map(tankRows.rows.map((row) => [row.code, row.id]))
  const aliasRows = await client.query(
    'SELECT source_text, commodity_id FROM commodity_aliases WHERE site_id = $1',
    [siteId],
  )
  const aliases = new Map(aliasRows.rows.map((row) => [row.source_text, row.commodity_id]))
  const commodityId = (text) => {
    if (!text) return null
    return aliases.get(text) ?? aliases.get(String(text).toLowerCase()) ?? null
  }

  let certificates = 0
  let parameters = 0
  let history = 0
  let skippedTanks = 0
  for (const tank of body.tanks ?? []) {
    const code = String(tank.tankId ?? '').replace(/\./g, '').replace(/\s+/g, '').trim()
    if (!code) continue
    const payload = { ...tank, tankId: code, snapshotOn, revision }
    const saved = await saveSubmission(
      client,
      definition,
      snapshotOn,
      `${snapshotOn}|${code}|${revision}`,
      payload,
    )
    if (saved.history) history += 1
    const tankId = tanks.get(code)
    if (!tankId) {
      skippedTanks += 1
      continue
    }
    const certificate = await client.query(
      `INSERT INTO storage_certificates (
         site_id, plant_id, tank_id, submission_id, oil, commodity_id, analysis_date, snapshot_on, revision,
         capacity, quantity, empty_space, temperature_c, odor, remark
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (tank_id, snapshot_on, revision) DO UPDATE SET
         submission_id = EXCLUDED.submission_id,
         oil = EXCLUDED.oil,
         commodity_id = EXCLUDED.commodity_id,
         analysis_date = EXCLUDED.analysis_date,
         capacity = EXCLUDED.capacity,
         quantity = EXCLUDED.quantity,
         empty_space = EXCLUDED.empty_space,
         temperature_c = EXCLUDED.temperature_c,
         odor = EXCLUDED.odor,
         remark = EXCLUDED.remark
       RETURNING id`,
      [
        siteId, plantId, tankId, saved.id, tank.oil || null, commodityId(tank.oil),
        tank.analysisDate, snapshotOn, revision,
        tank.capacity, tank.quantity, tank.emptySpace, tank.temperatureC, tank.odor, tank.remark,
      ],
    )
    const certificateId = certificate.rows[0].id
    await client.query('DELETE FROM certificate_parameters WHERE certificate_id = $1', [certificateId])
    for (const [field, codeName] of CERT_TESTS) {
      if (tank[field] == null) continue
      await client.query(
        `INSERT INTO certificate_parameters (certificate_id, canonical_code, numeric_value)
         VALUES ($1,$2,$3)`,
        [certificateId, codeName, tank[field]],
      )
      parameters += 1
    }
    certificates += 1
  }
  return { snapshotOn, certificates, parameters, history, skippedTanks }
}

async function recordRun(client, report) {
  const definition = await definitionId(client)
  const status = Array.isArray(report.failed) && report.failed.length > 0 ? 'failed' : 'succeeded'
  await client.query(
    `INSERT INTO ingest_runs (definition_id, range_from, range_to, status, detail, finished_at)
     VALUES ($1,$2,$3,$4,$5::jsonb, NOW())`,
    [definition, report.from ?? null, report.to ?? null, status, JSON.stringify(report)],
  )
}

const client = await pool.connect()
try {
  if (process.argv.includes('--cursor')) {
    console.log(JSON.stringify({ snapshotOn: await cursor(client) }))
  } else if (process.argv.includes('--record-run')) {
    await client.query('BEGIN')
    await recordRun(client, await readStdin())
    await client.query('COMMIT')
    console.log(JSON.stringify({ recorded: true }))
  } else {
    await client.query('BEGIN')
    const result = await upsertDay(client, await readStdin())
    await client.query('COMMIT')
    console.log(JSON.stringify(result))
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => {})
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
