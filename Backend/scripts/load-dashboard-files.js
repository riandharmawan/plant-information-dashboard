import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config()

const here = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(here, '../../Frontend/src/data')
const siteId = 'bekasi'
const plantId = 'priscolin-proj-bekasi'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

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

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'))
}

function tankCode(text) {
  if (!text) return null
  return String(text).replace(/\./g, '').replace(/\s+/g, ' ').trim()
}

const client = await pool.connect()
try {
  await client.query('BEGIN')
  for (const [code, name] of [
    ['refinery150', 'Refinery 150'],
    ['refinery500', 'Refinery 500'],
    ['fractionation400', 'Fractionation 400'],
    ['fractionation500', 'Fractionation 500'],
  ]) {
    await client.query(
      `INSERT INTO process_units (plant_id, code, name, yield_rule)
       VALUES ($1,$2,$3,'same-day')
       ON CONFLICT (plant_id, code) DO UPDATE SET name = EXCLUDED.name`,
      [plantId, code, name],
    )
  }
  const aliases = [
    ['CPO', 'cpo'], ['cpo', 'cpo'], ['RPO', 'rpo'], ['rpo', 'rpo'], ['RPO/RBDPO', 'rpo'],
    ['RPS', 'rps'], ['rps', 'rps'], ['RPS/RBDPS', 'rps'], ['RRPS/RRBDPS', 'rps'],
    ['PFAD', 'pfad'], ['pfad', 'pfad'], ['PMF', 'pmf'], ['pmf', 'pmf'], ['RPL/RPOL', 'olein'],
    ['Olein', 'olein'], ['olein', 'olein'], ['Olein IV 64', 'olein'], ['olein iv64', 'olein'],
    ['iv 64', 'olein'], ['iv64', 'olein'], ['Olein Tooling', 'olein'], ['olein tolling', 'olein'],
  ]
  for (const [source, commodityId] of aliases) {
    await client.query(
      `INSERT INTO commodity_aliases (site_id, commodity_id, source_text)
       VALUES ($1,$2,$3)
       ON CONFLICT (site_id, source_text) DO UPDATE SET commodity_id = EXCLUDED.commodity_id`,
      [siteId, commodityId, source],
    )
  }

  const tanks = new Map()
  const tankRows = await client.query('SELECT id, code FROM tanks WHERE plant_id = $1', [plantId])
  for (const row of tankRows.rows) tanks.set(row.code, row.id)
  const aliasRows = await client.query('SELECT source_text, commodity_id FROM commodity_aliases WHERE site_id = $1', [siteId])
  const aliasOf = new Map(aliasRows.rows.map((row) => [row.source_text, row.commodity_id]))
  const commodityId = (text) => (text ? aliasOf.get(text) ?? aliasOf.get(String(text).toLowerCase()) ?? null : null)

  async function definitionId(formCode) {
    const result = await client.query(
      'SELECT id FROM logsheet_definitions WHERE site_id = $1 AND form_code = $2',
      [siteId, formCode],
    )
    if (!result.rows[0]) throw new Error(`Missing logsheet definition ${formCode}`)
    return result.rows[0].id
  }

  async function submission(definition, businessKey, day, payload) {
    const result = await client.query(
      `INSERT INTO logsheet_submissions (definition_id, business_key, period_start, period_end, payload)
       VALUES ($1,$2,$3,$3,$4::jsonb)
       ON CONFLICT (definition_id, business_key) DO UPDATE
         SET payload = EXCLUDED.payload, period_start = EXCLUDED.period_start, period_end = EXCLUDED.period_end, imported_at = NOW()
       RETURNING id`,
      [definition, businessKey, day, JSON.stringify(payload)],
    )
    return result.rows[0].id
  }

  const soundingDef = await definitionId('F/TNF-003')
  const certDef = await definitionId('F/QCO-001')
  const refineryDef = await definitionId('F/QCO-002')
  const unit = await client.query(
    'SELECT id FROM process_units WHERE plant_id = $1 AND code = $2',
    [plantId, 'refinery150'],
  )

  await client.query('DELETE FROM certificate_parameters WHERE certificate_id IN (SELECT id FROM storage_certificates WHERE site_id = $1)', [siteId])
  await client.query('DELETE FROM storage_certificates WHERE site_id = $1', [siteId])
  await client.query('DELETE FROM soundings WHERE site_id = $1', [siteId])
  await client.query('DELETE FROM lab_results WHERE site_id = $1', [siteId])
  await client.query('DELETE FROM refinery_quality_days WHERE site_id = $1', [siteId])

  const logsheets = readJson('logsheets.json')
  let soundings = 0
  let skippedTanks = 0
  for (const row of logsheets.soundings) {
    const code = tankCode(row.tankId)
    const tankId = tanks.get(code)
    const key = `${row.recordedOn}|${row.tankId}|${row.roundIndex}`
    const submissionId = await submission(soundingDef, key, row.recordedOn, row)
    if (!tankId) {
      skippedTanks += 1
      continue
    }
    await client.query(
      `INSERT INTO soundings (
         site_id, plant_id, tank_id, submission_id, recorded_on, round_index,
         product_name, commodity_id, level_m, temperature_c, operational_status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        siteId, plantId, tankId, submissionId, row.recordedOn, row.roundIndex,
        row.productName ?? '', commodityId(row.productName), row.soundingLevelM, row.temperatureC, row.operationalStatus ?? '',
      ],
    )
    soundings += 1
  }

  const qc = readJson('qc.json')
  let certificates = 0
  for (const row of qc.storage) {
    const code = tankCode(row.tankId)
    const tankId = tanks.get(code)
    const key = `${row.snapshotOn}|${row.tankId}|${row.revision}`
    const submissionId = await submission(certDef, key, row.snapshotOn, row)
    if (!tankId) {
      skippedTanks += 1
      continue
    }
    const inserted = await client.query(
      `INSERT INTO storage_certificates (
         site_id, plant_id, tank_id, submission_id, oil, commodity_id, analysis_date, snapshot_on, revision,
         capacity, quantity, empty_space, temperature_c, odor, remark
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [
        siteId, plantId, tankId, submissionId, row.oil, commodityId(row.oil), row.analysisDate, row.snapshotOn, row.revision,
        row.capacity, row.quantity, row.emptySpace, row.temperatureC, row.odor, row.remark,
      ],
    )
    for (const [field, codeName] of CERT_TESTS) {
      if (row[field] == null) continue
      await client.query(
        `INSERT INTO certificate_parameters (certificate_id, canonical_code, numeric_value)
         VALUES ($1,$2,$3)`,
        [inserted.rows[0].id, codeName, row[field]],
      )
    }
    certificates += 1
  }

  const refinery = readJson('refineryQuality.json')
  let readings = 0
  for (const day of refinery.days) {
    const key = `${day.productionDate}|${day.processUnit}`
    const submissionId = await submission(refineryDef, key, day.productionDate, day)
    const dayRow = await client.query(
      `INSERT INTO refinery_quality_days (
         site_id, plant_id, process_unit_id, submission_id, production_date, report_date, declared_oils
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [siteId, plantId, unit.rows[0].id, submissionId, day.productionDate, day.reportDate, day.declaredOils ?? ''],
    )
    for (const reading of day.readings) {
      const fromCode = tankCode(reading.fromTank)
      const inserted = await client.query(
        `INSERT INTO refinery_quality_readings (
           day_id, row_index, observed_time, from_tank_text, from_tank_id, flow_rate, remark
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id`,
        [
          dayRow.rows[0].id, reading.rowIndex, reading.time, reading.fromTank,
          fromCode ? tanks.get(fromCode) ?? null : null, reading.flowRate, reading.remark,
        ],
      )
      readings += 1
      for (const [stream, item] of Object.entries(reading.streams ?? {})) {
        if (!item) continue
        const destCode = tankCode(item.destination)
        const streamRow = await client.query(
          `INSERT INTO refinery_quality_streams (
             reading_id, stream, commodity_text, commodity_id, destination_text, destination_tank_id
           ) VALUES ($1,$2,$3,$4,$5,$6)
           RETURNING id`,
          [
            inserted.rows[0].id, stream, item.commodity, commodityId(item.commodity), item.destination,
            destCode ? tanks.get(destCode) ?? null : null,
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
  }

  await client.query('COMMIT')
  console.log(JSON.stringify({ soundings, certificates, readings, skippedTanks }))
} catch (error) {
  await client.query('ROLLBACK')
  console.error(error)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
