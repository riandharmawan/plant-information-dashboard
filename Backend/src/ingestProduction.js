import { pool } from './db.js'

const siteId = 'bekasi'
const plantId = 'priscolin-proj-bekasi'

const forms = {
  'F/RFA-004(A)': 'b1d7e44d-e90d-447f-9772-ffecba657b1e',
  'F/RFA-004(B)': '476fba4b-8ee8-4e3b-8fb1-627da45a47d3',
}

function tankCode(text) {
  const raw = String(text ?? '').replace(/\s+/g, ' ').trim()
  const numbered = raw.match(/^t\.?\s*0*(\d+)$/i)
  if (!numbered) return null
  return `T${numbered[1].padStart(2, '0')}`
}

async function definitionId(client, formCode) {
  const externalId = forms[formCode]
  if (!externalId) throw new Error(`Unknown production form ${formCode}`)
  const result = await client.query(
    'SELECT id FROM logsheet_definitions WHERE site_id = $1 AND form_code = $2',
    [siteId, formCode],
  )
  if (!result.rows[0]) throw new Error(`Missing logsheet definition ${formCode}`)
  await client.query(
    `UPDATE logsheet_definitions
     SET external_id = $2
     WHERE id = $1 AND external_id IS NULL`,
    [result.rows[0].id, externalId],
  )
  return result.rows[0].id
}

async function upsertSubmission(client, definition, day) {
  const key = `${day.productionDate}|${day.processUnit}`
  const payload = JSON.stringify(day)
  await client.query(
    `INSERT INTO submission_history (submission_id, payload, imported_at)
     SELECT id, payload, imported_at
     FROM logsheet_submissions
     WHERE definition_id = $1 AND business_key = $2 AND payload IS DISTINCT FROM $3::jsonb`,
    [definition, key, payload],
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
    [definition, key, day.productionDate, payload],
  )
  return result.rows[0].id
}

/**
 * Replace each production day for its process unit, then insert flows, materials, utilities, and remarks.
 * One ingest_runs row covers the whole range.
 */
export async function ingestProductionDays(input) {
  const formCode = input.formCode
  const days = input.days ?? []
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const definition = await definitionId(client, formCode)
    const unitRows = await client.query('SELECT id, code FROM process_units WHERE plant_id = $1', [plantId])
    const units = new Map(unitRows.rows.map((row) => [row.code, row.id]))
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

    const counts = { days: 0, flows: 0, materials: 0, utilities: 0, remarks: 0 }
    const unknownUnits = []
    for (const day of days) {
      const unitId = units.get(day.processUnit)
      if (!unitId) {
        unknownUnits.push({ day: day.productionDate, processUnit: day.processUnit })
        continue
      }
      const submissionId = await upsertSubmission(client, definition, day)
      await client.query(
        'DELETE FROM production_days WHERE submission_id = $1 OR (process_unit_id = $2 AND production_date = $3)',
        [submissionId, unitId, day.productionDate],
      )
      const inserted = await client.query(
        `INSERT INTO production_days (site_id, plant_id, process_unit_id, submission_id, production_date)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id`,
        [siteId, plantId, unitId, submissionId, day.productionDate],
      )
      const dayId = inserted.rows[0].id
      counts.days += 1
      for (const flow of day.flows ?? []) {
        await client.query(
          `INSERT INTO production_flows (
             day_id, block, row_index, shift_text, commodity_text, commodity_id,
             from_tank_text, from_tank_id, started_at, ended_at, flow_start, flow_end,
             quantity, unit, destination_text, destination_tank_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [
            dayId, flow.block, flow.rowIndex, flow.shiftText, flow.commodityText, commodityId(flow.commodityText),
            flow.fromTankText, tankId(flow.fromTankText), flow.startedAt, flow.endedAt, flow.flowStart, flow.flowEnd,
            flow.quantity, flow.unit, flow.destinationText, tankId(flow.destinationText),
          ],
        )
        counts.flows += 1
      }
      for (const material of day.materials ?? []) {
        await client.query(
          `INSERT INTO production_materials (
             day_id, shift_text, material, row_index, slot, quantity, tank_volume, total_quantity, unit, lot, grade
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            dayId, material.shiftText, material.material, material.rowIndex ?? 0, material.slot, material.quantity,
            material.tankVolume, material.totalQuantity, material.unit, material.lot, material.grade,
          ],
        )
        counts.materials += 1
      }
      for (const utility of day.utilities ?? []) {
        await client.query(
          `INSERT INTO production_utilities (
             day_id, row_index, shift_text, canonical_code, quantity, flow_start, flow_end, unit, owner
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)`,
          [
            dayId, utility.rowIndex, utility.shiftText, utility.canonicalCode,
            utility.quantity, utility.flowStart, utility.flowEnd, utility.unit,
          ],
        )
        counts.utilities += 1
      }
      for (const remark of day.remarks ?? []) {
        await client.query(
          `INSERT INTO production_remarks (day_id, row_index, section_text, shift_text, remark)
           VALUES ($1,$2,$3,$4,$5)`,
          [dayId, remark.rowIndex, remark.sectionText, remark.shiftText, remark.remark],
        )
        counts.remarks += 1
      }
    }

    const detail = {
      formCode,
      downloaded: input.downloaded ?? days.length,
      skipped: input.skipped ?? 0,
      ...counts,
      unknownUnits,
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
