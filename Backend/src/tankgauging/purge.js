/**
 * Staged purge of gauge samples, as in Jetty Planning System.
 *   1. A sample older than the active window is archived.
 *   2. An archived sample older than the grace period is deleted.
 * Each step is logged in tank_gauging_purge_log. The latest reading is never touched, and the
 * daily rounds already live in soundings, so history is not lost.
 */
import crypto from 'node:crypto'

const BATCH = 20000

function days(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export async function purgeSamples(db, opts = {}) {
  const activeDays = days(opts.activeDays ?? process.env.TANK_GAUGING_SAMPLE_ACTIVE_DAYS, 30)
  const archiveDays = days(opts.archiveDays ?? process.env.TANK_GAUGING_SAMPLE_ARCHIVE_DAYS, 7)
  const batchId = crypto.randomUUID()
  let archived = 0
  let deleted = 0

  for (;;) {
    const r = await db.query(
      `WITH picked AS (
         SELECT id FROM tank_gauging_samples
         WHERE archived_at IS NULL AND sampled_at < NOW() - make_interval(days => $1) LIMIT $2
       ), moved AS (
         UPDATE tank_gauging_samples s SET archived_at = NOW() FROM picked WHERE s.id = picked.id
         RETURNING s.id, s.tank_id, s.source_base_url, s.sampled_at, s.total_mass, s.flow_rate_tph, s.level_mm, s.temperature_c, s.status_text
       )
       INSERT INTO tank_gauging_purge_log (batch_id, action, sample_id, tank_id, source_base_url, sampled_at, total_mass, flow_rate_tph, level_mm, temperature_c, status_text)
       SELECT $3::uuid, 'archive', id, tank_id, source_base_url, sampled_at, total_mass, flow_rate_tph, level_mm, temperature_c, status_text FROM moved`,
      [activeDays, BATCH, batchId],
    )
    archived += r.rowCount
    if (r.rowCount < BATCH) break
  }

  for (;;) {
    const r = await db.query(
      `WITH picked AS (
         SELECT id FROM tank_gauging_samples
         WHERE archived_at IS NOT NULL AND archived_at < NOW() - make_interval(days => $1) LIMIT $2
       ), gone AS (
         DELETE FROM tank_gauging_samples s USING picked WHERE s.id = picked.id
         RETURNING s.id, s.tank_id, s.source_base_url, s.sampled_at, s.total_mass, s.flow_rate_tph, s.level_mm, s.temperature_c, s.status_text
       )
       INSERT INTO tank_gauging_purge_log (batch_id, action, sample_id, tank_id, source_base_url, sampled_at, total_mass, flow_rate_tph, level_mm, temperature_c, status_text)
       SELECT $3::uuid, 'delete', id, tank_id, source_base_url, sampled_at, total_mass, flow_rate_tph, level_mm, temperature_c, status_text FROM gone`,
      [archiveDays, BATCH, batchId],
    )
    deleted += r.rowCount
    if (r.rowCount < BATCH) break
  }
  return { batchId, activeDays, archiveDays, archived, deleted }
}
