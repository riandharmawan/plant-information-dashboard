/**
 * The live view of a gauged site: each tank's latest reading and what the gauge says about the tank.
 * Live Ops shows this for today and the daily rounds for earlier days, so a site shows data as soon as
 * it is polled and does not wait for a round time.
 */
import { hasEvidence, roundStatus, roundValues } from './rounds.js'

const num = (value) => {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Every gauged tank of a site with its latest reading and detail. Tanks never polled have empty readings. */
export async function loadGaugedTanks(db, siteId) {
  const result = await db.query(
    `SELECT t.id, t.code, t.name, t.stock_group, t.sort_order,
            l.product_name, l.level_mm, l.temperature_c, l.total_mass, l.observed_density_kg_m3,
            l.total_observed_volume, l.status_text, l.raw_payload, l.fetched_at, l.recorded_at,
            i.max_capacity_litre, i.tank_state, i.tank_height_mm
     FROM tanks t
     JOIN plants p ON p.id = t.plant_id
     LEFT JOIN tank_gauging_latest l ON l.tank_id = t.id
     LEFT JOIN tank_gauging_info i ON i.tank_id = t.id
     WHERE p.site_id = $1 AND t.source = 'atg'
     ORDER BY t.sort_order, t.code`,
    [siteId],
  )
  return result.rows
}

/** The newest time any gauged tank of the site was read, or null when none was. */
export function newestReading(rows) {
  const times = rows.map((row) => row.fetched_at).filter(Boolean).map((value) => new Date(value).getTime())
  return times.length ? new Date(Math.max(...times)) : null
}

/**
 * A sounding in the shape Live Ops already reads, made from the latest reading.
 * A reading with nothing trustworthy in it shows as NO DATA with blank figures.
 */
export function liveSounding(row, recordedOn) {
  const values = roundValues(row)
  const usable = hasEvidence(values)
  return {
    roundIndex: 0,
    recordedOn,
    tankId: row.code,
    productName: row.product_name ?? '',
    soundingLevelM: usable && values.levelMm != null ? values.levelMm / 1000 : null,
    temperatureC: usable ? values.temperatureC : null,
    operationalStatus: usable ? roundStatus(values) : 'NO DATA',
    massKg: usable && values.massTon != null ? values.massTon * 1000 : null,
    densityKgM3: usable ? values.densityKgM3 : null,
    volumeLitre: usable ? values.volumeLitre : null,
    tankPk: row.id,
  }
}

/** What Live Ops needs to know about a gauged tank beyond its reading. */
export function gaugeMeta(row, kind, readingAt) {
  return {
    stockGroup: row.stock_group ?? null,
    readingKind: kind,
    readingAt: readingAt ? new Date(readingAt).toISOString() : null,
    capacityLitre: num(row.max_capacity_litre),
    tankState: row.tank_state ?? null,
  }
}
