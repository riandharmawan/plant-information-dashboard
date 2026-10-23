import { pool } from './db.js'

const siteId = 'bekasi'
const plantId = 'priscolin-proj-bekasi'
const formCode = 'F/TNF-004'
const externalId = '200e78d6-a1d6-4cfe-b01c-69b02909d345'

const extraAliases = [
  ['Olein toling', 'olein'],
  ['olein tolling', 'olein'],
  ['Cpo', 'cpo'],
]

function dayPayload(movementDate, rows) {
  return {
    movementDate,
    rows: rows.map((row) => ({
      rowIndex: row.rowIndex,
      vehicle: row.vehicle,
      commodityText: row.commodityText,
      timeIn: row.timeIn ?? null,
      timeOut: row.timeOut ?? null,
      customer: row.customer ?? null,
      sealIn: row.sealIn ?? null,
      sealOut: row.sealOut ?? null,
      operator: row.operator ?? null,
      remark: row.remark ?? null,
    })),
  }
}

function tankPhrase(remark, codes) {
  const numbered = [...remark.matchAll(/\bT\.?\s*0*\d+\b/gi)]
  const bulks = codes
    .filter((code) => code.startsWith('BAK '))
    .flatMap((code) => {
      const at = remark.toUpperCase().indexOf(code)
      return at < 0 ? [] : [{ index: at, text: remark.slice(at, at + code.length) }]
    })
  const found = [
    ...numbered.map((match) => ({ index: match.index, text: match[0] })),
    ...bulks,
  ].sort((left, right) => left.index - right.index)
  if (found.length === 0) return null
  const start = found[0].index
  const last = found.at(-1)
  return remark.slice(start, last.index + last.text.length).replace(/\s+/g, ' ').trim()
}

function canonicalCodes(phrase) {
  const codes = new Set()
  for (const match of phrase.matchAll(/\bT\.?\s*0*(\d+)\b/gi)) {
    codes.add(`T${match[1].padStart(2, '0')}`)
  }
  return [...codes]
}

function resolveTank(remark, tanks) {
  if (!remark) return { tankText: null, tankId: null }
  const codes = [...tanks.keys()]
  const phrase = tankPhrase(remark, codes)
  if (!phrase) return { tankText: null, tankId: null }
  const named = new Set(canonicalCodes(phrase))
  for (const code of codes) {
    if (code.startsWith('BAK ') && phrase.toUpperCase().includes(code)) named.add(code)
  }
  const known = [...named].filter((code) => tanks.has(code))
  if (named.size === 1 && known.length === 1) {
    return { tankText: phrase, tankId: tanks.get(known[0]) }
  }
  return { tankText: phrase, tankId: null }
}

async function definitionId(client) {
  await client.query(
    `UPDATE logsheet_definitions
     SET external_id = $3
     WHERE site_id = $1 AND form_code = $2 AND external_id IS NULL`,
    [siteId, formCode, externalId],
  )
  const result = await client.query(
    'SELECT id FROM logsheet_definitions WHERE site_id = $1 AND form_code = $2',
    [siteId, formCode],
  )
  if (!result.rows[0]) throw new Error(`Missing logsheet definition ${formCode}`)
  return result.rows[0].id
}

async function upsertSubmission(client, definition, movementDate, rows) {
  const payload = dayPayload(movementDate, rows)
  const key = movementDate
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
    [definition, key, movementDate, JSON.stringify(payload)],
  )
  return result.rows[0].id
}

/**
 * Replace each given movement date for Bekasi, then insert that day's vehicle visits.
 * One ingest_runs row covers the whole range.
 */
export async function ingestOilMovementDays(input) {
  const days = input.days ?? []
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const definition = await definitionId(client)
    for (const [source, commodityId] of extraAliases) {
      await client.query(
        `INSERT INTO commodity_aliases (site_id, commodity_id, source_text)
         VALUES ($1, $2, $3)
         ON CONFLICT (site_id, source_text) DO NOTHING`,
        [siteId, commodityId, source],
      )
    }
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

    let visits = 0
    for (const day of days) {
      const rows = day.rows ?? []
      if (rows.length === 0) throw new Error(`No visits for ${day.movementDate}`)
      const submissionId = await upsertSubmission(client, definition, day.movementDate, rows)
      await client.query(
        'DELETE FROM oil_movement_days WHERE site_id = $1 AND movement_date = $2',
        [siteId, day.movementDate],
      )
      const inserted = await client.query(
        `INSERT INTO oil_movement_days (site_id, plant_id, submission_id, movement_date)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [siteId, plantId, submissionId, day.movementDate],
      )
      const dayId = inserted.rows[0].id
      for (const row of rows) {
        const tank = resolveTank(row.remark, tanks)
        await client.query(
          `INSERT INTO oil_movements (
             day_id, row_index, vehicle, commodity_text, commodity_id,
             time_in, time_out, customer, seal_in, seal_out, operator, remark,
             tank_text, tank_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            dayId,
            row.rowIndex,
            row.vehicle,
            row.commodityText,
            commodityId(row.commodityText),
            row.timeIn ?? null,
            row.timeOut ?? null,
            row.customer ?? null,
            row.sealIn ?? null,
            row.sealOut ?? null,
            row.operator ?? null,
            row.remark ?? null,
            tank.tankText,
            tank.tankId,
          ],
        )
        visits += 1
      }
    }

    const detail = {
      downloaded: input.downloaded ?? days.length,
      skipped: input.skipped ?? 0,
      visits,
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
