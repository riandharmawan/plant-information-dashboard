import { pool } from './db.js'

const siteId = 'bekasi'
const plantId = 'priscolin-proj-bekasi'
const formCode = 'F/TNF-003'
const roundIndex = 1

function businessKey(recordedOn, tankCode) {
  return `${recordedOn}|${tankCode}|${roundIndex}`
}

function rowPayload(recordedOn, row) {
  return {
    recordedOn,
    tankCode: row.tankCode,
    roundIndex,
    productName: row.productName ?? '',
    levelM: row.levelM ?? null,
    temperatureC: row.temperatureC ?? null,
    operationalStatus: row.operationalStatus ?? '',
  }
}

async function definitionId(client) {
  const result = await client.query(
    'SELECT id FROM logsheet_definitions WHERE site_id = $1 AND form_code = $2',
    [siteId, formCode],
  )
  if (!result.rows[0]) throw new Error(`Missing logsheet definition ${formCode}`)
  return result.rows[0].id
}

async function upsertSubmission(client, definition, recordedOn, row) {
  const payload = rowPayload(recordedOn, row)
  const key = businessKey(recordedOn, row.tankCode)
  await client.query(
    `INSERT INTO submission_history (submission_id, payload, imported_at)
     SELECT id, payload, imported_at
     FROM logsheet_submissions
     WHERE definition_id = $1 AND business_key = $2 AND payload IS DISTINCT FROM $3::jsonb`,
    [definition, key, JSON.stringify(payload)],
  )
  const result = await client.query(
    `INSERT INTO logsheet_submissions (definition_id, business_key, period_start, period_end, payload)
     VALUES ($1, $2, $3, $3, $4::jsonb)
     ON CONFLICT (definition_id, business_key) DO UPDATE
       SET payload = EXCLUDED.payload,
           period_start = EXCLUDED.period_start,
           period_end = EXCLUDED.period_end,
           imported_at = NOW()
     RETURNING id`,
    [definition, key, recordedOn, JSON.stringify(payload)],
  )
  return result.rows[0].id
}

/**
 * Replace each given business date's sounding rows for Bekasi, then insert the sheet roster.
 * One ingest_runs row covers the whole range.
 */
export async function ingestSoundingDays(input) {
  const days = input.days ?? []
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const definition = await definitionId(client)
    const tankRows = await client.query('SELECT id, code FROM tanks WHERE plant_id = $1', [plantId])
    const tanks = new Map(tankRows.rows.map((row) => [row.code, row.id]))
    const aliasRows = await client.query(
      'SELECT source_text, commodity_id FROM commodity_aliases WHERE site_id = $1',
      [siteId],
    )
    const aliasOf = new Map(aliasRows.rows.map((row) => [row.source_text, row.commodity_id]))
    const commodityId = (text) => {
      if (!text) return null
      return aliasOf.get(text) ?? aliasOf.get(String(text).toLowerCase()) ?? null
    }

    let soundings = 0
    const unknownTanks = []
    for (const day of days) {
      await client.query(
        'DELETE FROM soundings WHERE site_id = $1 AND recorded_on = $2',
        [siteId, day.recordedOn],
      )
      for (const row of day.rows ?? []) {
        const submissionId = await upsertSubmission(client, definition, day.recordedOn, row)
        const tankId = tanks.get(row.tankCode)
        if (!tankId) {
          unknownTanks.push({ day: day.recordedOn, tankCode: row.tankCode })
          continue
        }
        await client.query(
          `INSERT INTO soundings (
             site_id, plant_id, tank_id, submission_id, recorded_on, round_index,
             product_name, commodity_id, level_m, temperature_c, operational_status
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            siteId,
            plantId,
            tankId,
            submissionId,
            day.recordedOn,
            roundIndex,
            row.productName ?? '',
            commodityId(row.productName),
            row.levelM ?? null,
            row.temperatureC ?? null,
            row.operationalStatus ?? '',
          ],
        )
        soundings += 1
      }
    }

    const detail = {
      downloaded: input.downloaded ?? days.length,
      skipped: input.skipped ?? 0,
      soundings,
      unknownTanks,
    }
    await client.query(
      `INSERT INTO ingest_runs (definition_id, range_from, range_to, status, detail, finished_at)
       VALUES ($1, $2, $3, 'succeeded', $4::jsonb, NOW())`,
      [definition, input.from, input.to, JSON.stringify(detail)],
    )
    await client.query('COMMIT')
    return detail
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
