/**
 * Poll gauge system hosts and keep tank_gauging_latest and tank_gauging_samples current.
 * Ported from Jetty Planning System (tank-gauging-poll-job.js), scoped by site.
 *
 * One run reads each enabled source once. The schedule is cron, not an in-app timer.
 */
import { slugify } from '../datahub/sync.js'
import {
  fetchTankInfo,
  fetchTankMeta,
  fetchTankParameters,
  openSession,
  parseTankInfoResponse,
  parseTankMetaResponse,
  parseTankParameterResponse,
  productToGroupCode,
  readingToRawPayload,
  trimBaseUrl,
  unitTankKey,
} from './client.js'
import { resolveEnabledSources, updateSourcePollHealth } from './sources.js'
import { writeRounds } from './rounds.js'

/** Its own advisory lock, so two pollers never run at once. */
const ADVISORY_LOCK_KEY = 930932

/**
 * A session lock must be taken and released on the same connection, so it gets its own client.
 * @returns {Promise<import('pg').PoolClient | null>} the client holding the lock, or null when it is taken
 */
async function acquireLock(pool) {
  const client = await pool.connect()
  const r = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [ADVISORY_LOCK_KEY])
  if (r.rows[0]?.ok) return client
  client.release()
  return null
}

async function releaseLock(client) {
  await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => {})
  client.release()
}

/**
 * The plant row that carries a site's gauged tanks. Plants are an internal key in this
 * application, so one hidden default plant per site is created on first use.
 */
export async function ensureDefaultPlant(db, siteId) {
  const id = `${siteId}-default`
  const existing = await db.query('SELECT id FROM plants WHERE id = $1', [id])
  if (existing.rows[0]) return id
  const site = await db.query('SELECT name FROM sites WHERE id = $1', [siteId])
  if (!site.rows[0]) throw new Error(`Site ${siteId} does not exist`)
  await db.query(
    `INSERT INTO plants (id, site_id, name, is_active) VALUES ($1, $2, $3, TRUE) ON CONFLICT DO NOTHING`,
    [id, siteId, `${site.rows[0].name} (default)`],
  )
  return id
}

/**
 * Make sure each gauged tank has a tank row and a map row. A tank keeps its identity by
 * host, unit and number, so renaming it in the gauge system does not create a second tank.
 * @returns {Promise<{ tankByKey: Map<string, string>, created: number, mapped: number }>}
 */
export async function syncTankMap(db, siteId, baseUrl, units) {
  const base = trimBaseUrl(baseUrl)
  const plantId = await ensureDefaultPlant(db, siteId)
  const tankByKey = new Map()
  let created = 0
  let order = Number(
    (await db.query('SELECT COALESCE(MAX(sort_order), 0) AS n FROM tanks WHERE plant_id = $1', [plantId])).rows[0].n,
  )

  for (const unit of units) {
    for (const tank of unit.tanks) {
      if (!tank.code) continue
      const key = unitTankKey(unit.name, tank.externalTankId)

      const known = await db.query(
        `SELECT tank_id FROM tank_gauging_tank_map
         WHERE site_id = $1 AND source_base_url = $2 AND source_unit_name = $3 AND external_tank_id = $4`,
        [siteId, base, unit.name, tank.externalTankId],
      )
      let tankId = known.rows[0]?.tank_id ?? null

      if (tankId == null) {
        let code = tank.code
        let taken = await db.query('SELECT id FROM tanks WHERE plant_id = $1 AND LOWER(code) = LOWER($2)', [plantId, code])
        // The same number can exist in two units. The second one is told apart by its unit name.
        if (taken.rows[0]) {
          const mapped = await db.query('SELECT 1 FROM tank_gauging_tank_map WHERE tank_id = $1', [taken.rows[0].id])
          if (mapped.rows[0]) {
            code = `${tank.code}@${unit.name || base}`
            taken = await db.query('SELECT id FROM tanks WHERE plant_id = $1 AND LOWER(code) = LOWER($2)', [plantId, code])
          }
        }
        if (taken.rows[0]) {
          tankId = taken.rows[0].id
        } else {
          tankId = `${siteId}-${slugify(code)}`
          order += 1
          await db.query(
            `INSERT INTO tanks (id, plant_id, code, name, sort_order, source)
             VALUES ($1, $2, $3, $4, $5, 'atg') ON CONFLICT (id) DO NOTHING`,
            [tankId, plantId, code, tank.name, order],
          )
          created += 1
        }
      }

      await db.query('UPDATE tanks SET name = COALESCE(NULLIF($2, \'\'), name), source = \'atg\', updated_at = NOW() WHERE id = $1', [tankId, tank.name])
      await db.query(
        `INSERT INTO tank_gauging_tank_map (site_id, source_base_url, source_unit_name, external_tank_id, tank_id, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (site_id, source_base_url, source_unit_name, external_tank_id)
         DO UPDATE SET tank_id = EXCLUDED.tank_id, updated_at = NOW()`,
        [siteId, base, unit.name, tank.externalTankId, tankId],
      )
      tankByKey.set(key, tankId)
    }
  }

  // Tanks that left the gauge system lose their link. The tank and its history stay.
  const keep = [...tankByKey.values()]
  await db.query(
    `DELETE FROM tank_gauging_tank_map WHERE site_id = $1 AND source_base_url = $2 AND NOT (tank_id = ANY($3::text[]))`,
    [siteId, base, keep],
  )
  return { tankByKey, created, mapped: tankByKey.size }
}

/**
 * The tank numbers to ask for in one live-values call.
 * Tank numbers repeat from 1 in every unit, so a host with several units is read one unit at a time
 * (see remoteFor), each with its own list.
 */
export function tankListFor(units, unit) {
  return unit.tanks.map((t) => t.externalTankId).join('|')
}

async function storeReading(db, base, unitName, tankId, reading, fetchedAt) {
  const recordedAt = reading.recordedAt && !Number.isNaN(new Date(reading.recordedAt).getTime()) ? new Date(reading.recordedAt) : null
  const raw = JSON.stringify(readingToRawPayload(reading))
  await db.query(
    `INSERT INTO tank_gauging_latest (
       tank_id, product_name, tank_comment, level_mm, temperature_c, observed_density_kg_m3,
       total_observed_volume, total_mass, flow_rate_tph, status_text, tank_status_code, level_movement,
       gauge_ref_height_mm, recorded_at, fetched_at, raw_payload, source, source_base_url, source_unit_name
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,'tankvision-gwt',$17,$18)
     ON CONFLICT (tank_id) DO UPDATE SET
       product_name = EXCLUDED.product_name, tank_comment = EXCLUDED.tank_comment, level_mm = EXCLUDED.level_mm,
       temperature_c = EXCLUDED.temperature_c, observed_density_kg_m3 = EXCLUDED.observed_density_kg_m3,
       total_observed_volume = EXCLUDED.total_observed_volume, total_mass = EXCLUDED.total_mass,
       flow_rate_tph = EXCLUDED.flow_rate_tph, status_text = EXCLUDED.status_text,
       tank_status_code = EXCLUDED.tank_status_code, level_movement = EXCLUDED.level_movement,
       gauge_ref_height_mm = EXCLUDED.gauge_ref_height_mm,
       recorded_at = EXCLUDED.recorded_at, fetched_at = EXCLUDED.fetched_at, raw_payload = EXCLUDED.raw_payload,
       source_base_url = EXCLUDED.source_base_url, source_unit_name = EXCLUDED.source_unit_name`,
    [
      tankId, reading.productName, reading.tankComment, reading.levelMm, reading.temperatureC,
      reading.observedDensityKgM3, reading.totalObservedVolume, reading.totalMass, reading.flowRateTph,
      reading.statusText, reading.tankStatusCode, reading.levelMovement, reading.gaugeRefHeightMm,
      recordedAt, fetchedAt, raw, base, unitName,
    ],
  )
  await db.query(
    `INSERT INTO tank_gauging_samples (
       tank_id, source_base_url, product_name, tank_comment, total_mass, flow_rate_tph, level_mm,
       temperature_c, observed_density_kg_m3, total_observed_volume, status_text, sampled_at, raw_payload
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
    [
      tankId, base, reading.productName, reading.tankComment, reading.totalMass, reading.flowRateTph,
      reading.levelMm, reading.temperatureC, reading.observedDensityKgM3, reading.totalObservedVolume,
      reading.statusText, fetchedAt, raw,
    ],
  )
}

/**
 * A gauged tank counts under the commodity card of the product the gauge says it holds, so the
 * card follows a product change. A tank with no product keeps its previous group.
 */
async function assignStockGroup(db, siteId, tankId, productName) {
  const code = productToGroupCode(productName)
  if (!code) return
  await db.query(
    `INSERT INTO stock_groups (site_id, code, name, sort_order)
     VALUES ($1, $2, $2, COALESCE((SELECT MAX(sort_order) + 1 FROM stock_groups WHERE site_id = $1), 0))
     ON CONFLICT (site_id, code) DO NOTHING`,
    [siteId, code],
  )
  await db.query('UPDATE tanks SET stock_group = $2 WHERE id = $1 AND stock_group IS DISTINCT FROM $2', [tankId, code])
}

/** How long a tank's capacity is trusted before it is read again. */
const INFO_REFRESH_DAYS = 7

/**
 * Read each tank's detail page (capacity, height, state) when it has not been read for a week.
 * Sequential and paced, because the units are slow. Returns counts. Never throws.
 */
export async function refreshTankInfo(db, { fetchOpts, units, tankByKey, delayMs }) {
  const result = { read: 0, failed: 0, fresh: 0 }
  try {
    const ids = [...tankByKey.values()]
    const fresh = await db.query(
      `SELECT tank_id FROM tank_gauging_info WHERE tank_id = ANY($1::text[]) AND fetched_at > NOW() - make_interval(days => $2)`,
      [ids, INFO_REFRESH_DAYS],
    )
    const done = new Set(fresh.rows.map((row) => row.tank_id))
    const pause = Number.isFinite(Number(delayMs)) ? Number(delayMs) : 250
    for (const unit of units) {
      // A unit that cannot give tank details would fail on every tank. Give up on it after a few misses.
      let misses = 0
      for (const tank of unit.tanks) {
        const tankId = tankByKey.get(unitTankKey(unit.name, tank.externalTankId))
        if (!tankId) continue
        if (done.has(tankId)) {
          result.fresh += 1
          continue
        }
        if (misses >= 3) {
          result.failed += 1
          continue
        }
        try {
          const res = await fetchTankInfo({ ...fetchOpts, tankId: tank.externalTankId, remote: remoteFor(units, unit) })
          const info = res.ok ? parseTankInfoResponse(res.text) : null
          if (!info) {
            result.failed += 1
            misses += 1
            continue
          }
          misses = 0
          await db.query(
            `INSERT INTO tank_gauging_info (tank_id, max_capacity_litre, tank_height_mm, tank_location, tank_state, roof_status, fetched_at, raw_payload)
             VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7::jsonb)
             ON CONFLICT (tank_id) DO UPDATE SET max_capacity_litre = EXCLUDED.max_capacity_litre,
               tank_height_mm = EXCLUDED.tank_height_mm, tank_location = EXCLUDED.tank_location,
               tank_state = EXCLUDED.tank_state, roof_status = EXCLUDED.roof_status,
               fetched_at = NOW(), raw_payload = EXCLUDED.raw_payload`,
            [tankId, info.maxCapacityLitre, info.tankHeightMm, info.tankLocation, info.tankState, info.roofStatus, JSON.stringify(info)],
          )
          result.read += 1
        } catch {
          result.failed += 1
          misses += 1
        }
        if (pause > 0) await new Promise((resolve) => setTimeout(resolve, pause))
      }
    }
  } catch {
    result.failed += 1
  }
  return result
}

/** The unit to address in a request. Only a host with several units needs one. */
export function remoteFor(units, unit) {
  return units.length > 1 && unit.name ? unit.name : undefined
}

/** Poll one source. Never throws: a failure is returned and recorded on the source. */
export async function pollSource(db, source, opts = {}) {
  const base = trimBaseUrl(source.baseUrl)
  const fetchOpts = { baseUrl: base, auth: source.auth, fetchImpl: opts.fetchImpl, retryDelayMs: opts.retryDelayMs, timeoutMs: opts.timeoutMs }

  const finish = async (result) => {
    await updateSourcePollHealth(db, source.id, { ok: result.ok, error: result.error })
    return { sourceId: source.id, siteId: source.siteId, sourceBaseUrl: base, ...result }
  }

  try {
    // One session for the whole poll. The unit is slow to open one, and each call would open another.
    fetchOpts.cookie = await openSession(base, fetchOpts)
    const metaRes = await fetchTankMeta(fetchOpts)
    if (!metaRes.ok) return finish({ ok: false, error: `Tank list HTTP ${metaRes.status}${metaRes.status === 204 ? ' (empty)' : ''}`, fetched: 0, stored: 0 })
    const meta = parseTankMetaResponse(metaRes.text)
    const units = meta.units.filter((unit) => unit.tanks.length > 0)
    if (units.length === 0) return finish({ ok: false, error: 'The tank list has no tanks', fetched: 0, stored: 0 })

    // Work out how every unit will be read before anything is created, so an unsupported
    // host leaves no tanks behind.
    const tankLists = new Map(units.map((unit) => [unit, tankListFor(units, unit)]))
    const { tankByKey, created } = await syncTankMap(db, source.siteId, base, units)
    const fetchedAt = opts.now ?? new Date()
    let fetched = 0
    let stored = 0
    let unmapped = 0
    const problems = []

    for (const unit of units) {
      const res = await fetchTankParameters({ ...fetchOpts, tankList: tankLists.get(unit), remote: remoteFor(units, unit) })
      if (!res.ok) {
        problems.push(`${unit.name || base}: live values HTTP ${res.status}`)
        continue
      }
      const productByTankId = new Map()
      for (const tank of unit.tanks) {
        const product = meta.productByUnitTank.get(unitTankKey(unit.name, tank.externalTankId))
        if (product) productByTankId.set(tank.externalTankId, product)
      }
      const { readings, parseMode } = parseTankParameterResponse(res.text, productByTankId)
      if (readings.length === 0) {
        problems.push(`${unit.name || base}: no readings (${parseMode})`)
        continue
      }
      for (const reading of readings) {
        fetched += 1
        const tankId = tankByKey.get(unitTankKey(unit.name, reading.externalTankId))
        if (!tankId) {
          unmapped += 1
          continue
        }
        await storeReading(db, base, unit.name, tankId, reading, fetchedAt)
        await assignStockGroup(db, source.siteId, tankId, reading.productName)
        stored += 1
      }
    }

    // Capacity and the like change rarely. Read them after the live values, so a slow unit never
    // delays a reading, and a failure here does not fail the poll.
    const info = await refreshTankInfo(db, { fetchOpts, units, tankByKey, delayMs: opts.infoDelayMs })

    const ok = problems.length === 0 && stored > 0
    return finish({ ok, error: ok ? null : problems.join('; ') || 'nothing stored', fetched, stored, unmapped, tanksCreated: created, units: units.length, info })
  } catch (error) {
    return finish({ ok: false, error: error?.message || String(error), fetched: 0, stored: 0 })
  }
}

/**
 * Poll every enabled source, then turn readings into daily rounds.
 * @param {import('pg').Pool} db
 * @param {{ siteId?: string, skipLock?: boolean, fetchImpl?: typeof fetch, now?: Date, rounds?: boolean }} [opts]
 */
export async function runTankGaugingPoll(db, opts = {}) {
  let lock = null
  if (!opts.skipLock) {
    lock = await acquireLock(db)
    if (!lock) return { skipped: true, reason: 'lock_not_acquired' }
  }
  try {
    const sources = await resolveEnabledSources(db, { siteId: opts.siteId })
    if (sources.length === 0) return { skipped: true, reason: opts.siteId ? 'no_enabled_sources_for_site' : 'no_enabled_sources' }

    const results = []
    for (const source of sources) results.push(await pollSource(db, source, opts))

    const rounds = []
    if (opts.rounds !== false) {
      for (const siteId of [...new Set(sources.map((s) => s.siteId))]) {
        try {
          rounds.push({ siteId, ...(await writeRounds(db, siteId, opts.now ?? new Date())) })
        } catch (error) {
          rounds.push({ siteId, error: error?.message || String(error) })
        }
      }
    }
    return {
      skipped: false,
      ok: results.every((r) => r.ok),
      sourceCount: results.length,
      stored: results.reduce((n, r) => n + (r.stored || 0), 0),
      sources: results,
      rounds,
    }
  } finally {
    if (lock) await releaseLock(lock)
  }
}
