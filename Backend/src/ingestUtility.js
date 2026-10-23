import { pool } from './db.js'

const siteId = 'bekasi'
const plantId = 'priscolin-proj-bekasi'

async function definitionId(client, form) {
  const result = await client.query(
    `INSERT INTO logsheet_definitions (site_id, plant_id, external_id, form_code, name, mapper_key)
     VALUES ($1, $2, $3, $4, $5, 'utility')
     ON CONFLICT (site_id, form_code) DO UPDATE
       SET external_id = COALESCE(logsheet_definitions.external_id, EXCLUDED.external_id),
           plant_id = COALESCE(logsheet_definitions.plant_id, EXCLUDED.plant_id),
           mapper_key = COALESCE(logsheet_definitions.mapper_key, EXCLUDED.mapper_key)
     RETURNING id`,
    [siteId, plantId, form.externalId, form.formCode, form.name],
  )
  return result.rows[0].id
}

async function upsertSubmission(client, definition, day) {
  const key = day.assetCode ? `${day.recordedOn}|${day.assetCode}` : day.recordedOn
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
    [definition, key, day.recordedOn, payload],
  )
  return result.rows[0].id
}

/**
 * Replace each utility day for its form, then insert the child rows.
 * One ingest_runs row covers the form's range. Readings stay owner = false.
 */
export async function ingestUtilityDays(input) {
  const days = input.days ?? []
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const definition = await definitionId(client, input)
    const assetRows = await client.query(
      'SELECT id, code FROM utility_assets WHERE site_id = $1',
      [siteId],
    )
    const assets = new Map(assetRows.rows.map((row) => [row.code, row.id]))
    const counts = { days: 0, readings: 0, materials: 0, loaderRuns: 0, checks: 0, jobs: 0, jobChecks: 0 }
    for (const day of days) {
      const assetId = day.assetCode ? assets.get(day.assetCode) : null
      if (day.assetCode && !assetId) throw new Error(`Missing utility asset ${day.assetCode}`)
      const submissionId = await upsertSubmission(client, definition, day)
      await client.query('DELETE FROM utility_days WHERE submission_id = $1', [submissionId])
      const inserted = await client.query(
        `INSERT INTO utility_days (site_id, plant_id, asset_id, submission_id, recorded_on, place_text, shift_banner)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id`,
        [siteId, plantId, assetId, submissionId, day.recordedOn, day.placeText ?? null, day.shiftBanner ?? null],
      )
      const dayId = inserted.rows[0].id
      counts.days += 1
      for (const reading of day.readings ?? []) {
        await client.query(
          `INSERT INTO utility_readings (
             day_id, row_index, observed_time, shift_text, group_text, tag_text,
             numeric_value, text_value, unit, remark, canonical_code, owner
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL,FALSE)`,
          [
            dayId, reading.rowIndex, reading.observedTime ?? null, reading.shiftText ?? null,
            reading.groupText ?? null, reading.tagText ?? null, reading.numericValue ?? null,
            reading.textValue ?? null, reading.unit ?? null, reading.remark ?? null,
          ],
        )
        counts.readings += 1
      }
      for (const material of day.materials ?? []) {
        await client.query(
          `INSERT INTO utility_material_uses (
             day_id, row_index, group_text, material_text, lot, received_qty, used_qty,
             remaining_qty, unit, operator, remark
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9,$10)`,
          [
            dayId, material.rowIndex, material.groupText ?? null, material.materialText ?? null,
            material.lot ?? null, material.receivedQty ?? null, material.usedQty ?? null,
            material.remainingQty ?? null, material.operator ?? null, material.remark ?? null,
          ],
        )
        counts.materials += 1
      }
      for (const run of day.loaderRuns ?? []) {
        await client.query(
          `INSERT INTO utility_loader_runs (
             day_id, row_index, shift_text, hour_start, hour_end, hours_total, fuel_liters, oil_liters, remark
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            dayId, run.rowIndex, run.shiftText ?? null, run.hourStart ?? null, run.hourEnd ?? null,
            run.hoursTotal ?? null, run.fuelLiters ?? null, run.oilLiters ?? null, run.remark ?? null,
          ],
        )
        counts.loaderRuns += 1
      }
      for (const check of day.checks ?? []) {
        await client.query(
          'INSERT INTO utility_checks (day_id, row_index, item_text, result) VALUES ($1,$2,$3,$4)',
          [dayId, check.rowIndex, check.itemText, check.result],
        )
        counts.checks += 1
      }
      for (const job of day.jobs ?? []) {
        const jobRow = await client.query(
          `INSERT INTO utility_jobs (day_id, row_index, period_text, performed_on, done_by)
           VALUES ($1,$2,$3,$4,$5)
           RETURNING id`,
          [dayId, job.rowIndex, job.periodText ?? null, job.performedOn ?? null, job.doneBy ?? null],
        )
        counts.jobs += 1
        for (const check of job.checks ?? []) {
          await client.query(
            'INSERT INTO utility_job_checks (job_id, item_text, result) VALUES ($1,$2,$3)',
            [jobRow.rows[0].id, check.itemText, check.result],
          )
          counts.jobChecks += 1
        }
      }
    }
    const detail = {
      formCode: input.formCode,
      downloaded: input.downloaded ?? days.length,
      skipped: input.skipped ?? 0,
      ...counts,
    }
    await client.query(
      `INSERT INTO ingest_runs (definition_id, range_from, range_to, status, detail, finished_at)
       VALUES ($1, $2, $3, 'succeeded', $4::jsonb, NOW())`,
      [definition, input.from ?? null, input.to ?? null, JSON.stringify(detail)],
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
