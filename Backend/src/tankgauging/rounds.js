/**
 * Turn gauge readings into daily rounds in soundings, at the same times a logsheet round is taken.
 * The existing Live Ops, history and charts read soundings, so a gauged site shows up there with
 * no change to those screens.
 *
 * A round is written once, from the sample nearest to its time, when that time has passed.
 * A day or two of missed rounds are filled in on the next run.
 */

export const DEFAULT_ROUND_TIMES = '06:30,14:30'
export const DEFAULT_TOLERANCE_MIN = 30

export function parseRoundTimes(text) {
  const out = []
  for (const part of String(text ?? '').split(',')) {
    const match = /^\s*([01]?\d|2[0-3]):([0-5]\d)\s*$/.exec(part)
    if (match) out.push(`${match[1].padStart(2, '0')}:${match[2]}`)
  }
  return [...new Set(out)].sort()
}

function offsetMinutes(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const value = (type) => Number(parts.find((p) => p.type === type).value)
  const asUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'))
  return (asUtc - utcMs) / 60000
}

/** The instant at which a wall-clock time occurs in a timezone. */
export function zonedTimeToUtc(date, time, timeZone) {
  const [y, m, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, h, mi)
  const first = guess - offsetMinutes(guess, timeZone) * 60000
  return new Date(guess - offsetMinutes(first, timeZone) * 60000)
}

/** The calendar date, as yyyy-mm-dd, of an instant in a timezone. */
export function localDate(instant, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant)
}

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function loadRoundSettings(db, siteId) {
  const r = await db.query('SELECT round_times, round_tolerance_min FROM tank_gauging_settings WHERE site_id = $1', [siteId])
  const row = r.rows[0]
  const times = parseRoundTimes(row?.round_times ?? DEFAULT_ROUND_TIMES)
  return {
    roundTimes: times.length ? times : parseRoundTimes(DEFAULT_ROUND_TIMES),
    toleranceMin: Number(row?.round_tolerance_min ?? DEFAULT_TOLERANCE_MIN),
  }
}

export async function saveRoundSettings(db, siteId, { roundTimes, toleranceMin }, userId) {
  const times = parseRoundTimes(roundTimes)
  if (times.length === 0) {
    const error = new Error('Enter at least one time as HH:MM, separated by commas')
    error.status = 400
    throw error
  }
  const tolerance = Number(toleranceMin ?? DEFAULT_TOLERANCE_MIN)
  if (!Number.isInteger(tolerance) || tolerance < 1 || tolerance > 240) {
    const error = new Error('The tolerance must be between 1 and 240 minutes')
    error.status = 400
    throw error
  }
  await db.query(
    `INSERT INTO tank_gauging_settings (site_id, round_times, round_tolerance_min, updated_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (site_id) DO UPDATE SET round_times = EXCLUDED.round_times,
       round_tolerance_min = EXCLUDED.round_tolerance_min, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
    [siteId, times.join(','), tolerance, userId ?? null],
  )
  return { roundTimes: times, toleranceMin: tolerance }
}

const BAD_STATUS = new Set(['NODATA', 'FAIL', 'INVALIDDATA'])

function parameterOf(sample, id) {
  const list = sample.raw_payload?.parameterlist
  return Array.isArray(list) ? list.find((p) => Number(p.id) === id) ?? null : null
}

function number(value) {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * The values of a sample that can be trusted for a round. A parameter the unit marks as no data,
 * failed or invalid is left out, because the unit still sends a number for it (a level of 0, a
 * density of -1). INIT and Manual values are kept: the units report real figures with those.
 * A sample stored without its parameter list is taken as it is.
 */
export function roundValues(sample) {
  const pick = (id, column) => {
    const parameter = parameterOf(sample, id)
    if (parameter && BAD_STATUS.has(String(parameter.statusString || '').toUpperCase().replace(/s+/g, ''))) return null
    return number(sample[column])
  }
  let massTon = pick(730, 'total_mass')
  let densityKgM3 = pick(628, 'observed_density_kg_m3')
  let volumeLitre = pick(717, 'total_observed_volume')
  if (massTon != null && massTon < 0) massTon = null
  if (densityKgM3 != null && densityKgM3 <= 0) densityKgM3 = null
  if (volumeLitre != null && volumeLitre < 0) volumeLitre = null
  return { levelMm: pick(622, 'level_mm'), temperatureC: pick(625, 'temperature_c'), massTon, densityKgM3, volumeLitre }
}

/**
 * Whether a round is worth writing. A level of 0 with no mass and no temperature next to it is a unit
 * reporting nothing, not an empty tank, so it is skipped.
 */
export function hasEvidence(values) {
  if (values.levelMm == null && values.massTon == null) return false
  if (values.levelMm === 0 && values.massTon == null && values.temperatureC == null) return false
  return true
}

/** 'Empty' when the tank reads empty, otherwise 'ATG'. */
export function roundStatus(values) {
  if ((values.massTon != null && values.massTon <= 0) || (values.levelMm != null && values.levelMm <= 0)) return 'Empty'
  return 'ATG'
}

/**
 * Write the rounds that are due and not yet written, for yesterday and today in the site's timezone.
 * @returns {Promise<{ written: number, missing: number, due: number }>}
 */
export async function writeRounds(db, siteId, now = new Date()) {
  const site = await db.query('SELECT timezone FROM sites WHERE id = $1', [siteId])
  if (!site.rows[0]) throw new Error(`Site ${siteId} does not exist`)
  const timeZone = site.rows[0].timezone
  const { roundTimes, toleranceMin } = await loadRoundSettings(db, siteId)

  const tanks = await db.query(
    `SELECT t.id, t.plant_id FROM tanks t JOIN plants p ON p.id = t.plant_id
     WHERE p.site_id = $1 AND t.source = 'atg'`,
    [siteId],
  )
  if (tanks.rows.length === 0) return { written: 0, missing: 0, due: 0 }

  const today = localDate(now, timeZone)
  const dates = [addDays(today, -1), today]
  const due = []
  for (const date of dates) {
    roundTimes.forEach((time, index) => {
      const target = zonedTimeToUtc(date, time, timeZone)
      if (target <= now) due.push({ date, roundIndex: index + 1, target })
    })
  }
  if (due.length === 0) return { written: 0, missing: 0, due: 0 }

  const have = await db.query(
    `SELECT tank_id, recorded_on, round_index FROM soundings WHERE tank_id = ANY($1::text[]) AND recorded_on = ANY($2::date[])`,
    [tanks.rows.map((t) => t.id), dates],
  )
  const exists = new Set(have.rows.map((r) => `${r.tank_id}|${r.recorded_on}|${r.round_index}`))

  let written = 0
  let missing = 0
  for (const tank of tanks.rows) {
    for (const slot of due) {
      if (exists.has(`${tank.id}|${slot.date}|${slot.roundIndex}`)) continue
      const pick = await db.query(
        `SELECT * FROM tank_gauging_samples
         WHERE tank_id = $1 AND sampled_at BETWEEN $2::timestamptz - make_interval(mins => $3) AND $2::timestamptz + make_interval(mins => $3)
         ORDER BY ABS(EXTRACT(EPOCH FROM (sampled_at - $2::timestamptz))) LIMIT 1`,
        [tank.id, slot.target.toISOString(), toleranceMin],
      )
      const sample = pick.rows[0]
      const values = sample ? roundValues(sample) : null
      if (!values || !hasEvidence(values)) {
        missing += 1
        continue
      }
      const result = await db.query(
        `INSERT INTO soundings (
           site_id, plant_id, tank_id, submission_id, recorded_on, round_index, product_name, level_m,
           temperature_c, operational_status, source, mass_kg, density_kg_m3, volume_litre, sampled_at
         ) VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,'atg',$10,$11,$12,$13)
         ON CONFLICT (tank_id, recorded_on, round_index) DO NOTHING`,
        [
          siteId,
          tank.plant_id,
          tank.id,
          slot.date,
          slot.roundIndex,
          sample.product_name ?? '',
          values.levelMm == null ? null : values.levelMm / 1000,
          values.temperatureC,
          roundStatus(values),
          values.massTon == null ? null : values.massTon * 1000,
          values.densityKgM3,
          values.volumeLitre,
          sample.sampled_at,
        ],
      )
      written += result.rowCount
    }
  }
  return { written, missing, due: due.length }
}
