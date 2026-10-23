import { Router } from 'express'
import { requireAuth, requirePermission } from '../access.js'
import { query } from '../db.js'

const router = Router({ mergeParams: true })

const RECENT_DAYS = 30

/** Every utility form, including the two with no submissions, so the board can show them. */
const FORMS = [
  { code: 'F/UTI-001', name: 'Operational Boiler Daily Report Taihu 15 TPH', area: 'boiler', place: 'Control Room', daily: true },
  { code: 'F/UTI-002', name: 'Operational Boiler Taihu 15 t/h Daily Report (Local)', area: 'boiler', place: 'Local', daily: true },
  { code: 'utility-wuxi-15tph', name: 'Operational Boiler Daily Report Wuxi 15 TPH', area: 'boiler', place: 'Wuxi', daily: false },
  { code: 'F/UTI-005', name: 'Logbook Pemakaian Chemical Boiler', area: 'boiler', place: null, daily: false },
  { code: 'F/UTI-010', name: 'Logsheet Batu Bara', area: 'coal', place: null, daily: true },
  { code: 'F/UTI-004', name: 'Form Pemakaian Bahan Bakar Taihu', area: 'coal', place: null, daily: true },
  { code: 'F/UTI-012', name: 'Laporan Analisa Air Boiler', area: 'water', place: null, daily: true },
  { code: 'F/WTP-001', name: 'Laporan Analisa Air WTP & WWTP', area: 'water', place: null, daily: true },
  { code: 'F/WTP-006', name: 'Realization & Verification Cleaning RO', area: 'water', place: null, daily: false },
  { code: 'F/WWTP-001', name: 'WWTP Operational', area: 'effluent', place: null, daily: true },
  { code: 'F/UTI-011(a)', name: 'Wheel loader checklist', area: 'loader', place: null, daily: true },
  { code: 'F/UTI-011(b)', name: 'Wheel loader fuel and hour meter', area: 'loader', place: null, daily: true },
  { code: 'utility-meter-listrik', name: 'Monitoring Display Meter Listrik', area: 'power', place: null, daily: false },
]

const READING_FORMS = ['F/UTI-012', 'F/WTP-001', 'F/WWTP-001']
const BOILER_FORMS = ['F/UTI-001', 'F/UTI-002']

const ISO = /^\d{4}-\d{2}-\d{2}$/

function num(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isoOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(iso, days) {
  const [year, month, day] = iso.split('-').map(Number)
  return isoOf(new Date(year, month - 1, day + days))
}

function allowedSite(req, res) {
  if (!req.sessionUser.sites.some((site) => site.id === req.params.siteId)) {
    res.status(403).json({ error: 'forbidden' })
    return false
  }
  return true
}

/** Same window as the QC pages: the last 30 days ending today, clipped to the data. */
function resolveRange(dates, from, to) {
  if (ISO.test(from ?? '') && ISO.test(to ?? '')) return from <= to ? { from, to } : { from: to, to: from }
  const first = dates[0] ?? isoOf(new Date())
  const last = dates[dates.length - 1] ?? first
  const today = isoOf(new Date())
  const end = today < first ? last : today < last ? today : last
  const start = addDays(end, -(RECENT_DAYS - 1))
  return { from: start < first ? first : start, to: end }
}

function cleanTag(text) {
  return text == null ? null : text.replace(/u00b0/g, '°').replace(/\s+/g, ' ').trim()
}

function unitOf(rest) {
  const unit = rest.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
  return unit && !/\d/.test(unit) ? unit : null
}

/** Reads `10.5 - 11.5`, `20-40`, `150 s/d 550 rpm`, `max 50`, `<2500 (ppm)`, `960 max °C`, `min 2.5`. */
export function parseLimit(spec) {
  if (!spec) return null
  const text = spec.replace(/(\d),(\d)/g, '$1.$2').trim()
  if (/\bx\b/i.test(text)) return null
  const number = '(-?\\d+(?:\\.\\d+)?)'
  const between = text.match(new RegExp(`^${number}\\s*(?:-|s/d)\\s*\\+?\\s*${number}(.*)$`, 'i'))
  if (between && !/\d/.test(between[3])) {
    return { min: Number(between[1]), max: Number(between[2]), unit: unitOf(between[3]) }
  }
  const max = text.match(new RegExp(`^(?:max\\s*|<\\s*)${number}(.*)$`, 'i')) ?? text.match(new RegExp(`^${number}\\s*max\\b(.*)$`, 'i'))
  if (max && !/\d/.test(max[2])) return { min: null, max: Number(max[1]), unit: unitOf(max[2]) }
  const min = text.match(new RegExp(`^(?:min\\s*|>\\s*)${number}(.*)$`, 'i'))
  if (min && !/\d/.test(min[2])) return { min: Number(min[1]), max: null, unit: unitOf(min[2]) }
  return null
}

/** Splits a printed tag into its name and the spec written beside it, either after `:` or in the last brackets. */
export function describeTag(raw) {
  const tag = cleanTag(raw)
  if (!tag) return { tag: null, name: null, spec: null, unit: null, min: null, max: null }
  let name = tag
  let spec = null
  let unit = null
  const colon = tag.indexOf(':')
  if (colon > 0) {
    name = tag.slice(0, colon).replace(/\.\s*$/, '').trim()
    spec = tag.slice(colon + 1).trim() || null
    const trailing = spec?.match(/\(([^()]*)\)\s*$/)
    if (trailing) unit = unitOf(trailing[1])
  } else {
    const bracket = tag.match(/^(.*)\(([^()]*)\)([^()]*)$/)
    if (bracket && bracket[1].trim()) {
      name = bracket[1].trim()
      spec = bracket[2].trim() || null
      if (spec) unit = unitOf(spec)
    }
  }
  const limit = parseLimit(spec)
  return {
    tag,
    name,
    spec,
    unit: limit ? limit.unit : unit,
    min: limit?.min ?? null,
    max: limit?.max ?? null,
  }
}

function reading(row) {
  return {
    date: row.recorded_on,
    form: row.form_code,
    time: row.observed_time,
    shift: row.shift_text,
    group: row.group_text,
    ...describeTag(row.tag_text),
    value: num(row.numeric_value),
    text: row.text_value,
    valueUnit: row.unit,
    remark: row.remark,
  }
}

const DAY_JOIN = `
  FROM utility_days u
  JOIN logsheet_submissions s ON s.id = u.submission_id
  JOIN logsheet_definitions d ON d.id = s.definition_id`

async function loadDates(siteId) {
  const result = await query('SELECT DISTINCT recorded_on FROM utility_days WHERE site_id = $1 ORDER BY 1', [siteId])
  return result.rows.map((row) => row.recorded_on)
}

function coalDays(rows) {
  const days = new Map()
  for (const row of rows) {
    const day = days.get(row.recorded_on) ?? { date: row.recorded_on, buckets: null, steamKg: null, ratio: null, incomingKg: null, faba: 0 }
    const tag = row.tag_text ?? ''
    const group = row.group_text ?? ''
    const value = num(row.numeric_value)
    const add = (key) => { if (value != null) day[key] = (day[key] ?? 0) + value }
    if (group === 'Konsumsi Batu Bara' && /\(Bucket\)/i.test(tag)) add('buckets')
    else if (group === 'Steam Distribusi') add('steamKg')
    else if (group === 'Rasio' && value != null) day.ratio = value
    else if (/^B\. ?Bara Masuk/i.test(tag)) add('incomingKg')
    else if (group === 'Pengangkutan Faba' && (row.text_value || value != null)) day.faba += 1
    days.set(row.recorded_on, day)
  }
  return [...days.values()]
}

router.get('/', requireAuth, requirePermission('utility', 'view'), async (req, res, next) => {
  try {
    if (!allowedSite(req, res)) return
    const siteId = req.params.siteId
    const dates = await loadDates(siteId)
    const { from, to } = resolveRange(dates, req.query.from, req.query.to)
    const range = [siteId, from, to]
    const inRange = 'u.site_id = $1 AND u.recorded_on BETWEEN $2 AND $3'

    const [days, coal, boiler, runs, checks, materials, water, jobs] = await Promise.all([
      query(
        `SELECT u.recorded_on, d.form_code, u.place_text, u.shift_banner,
                (EXISTS (SELECT 1 FROM utility_readings r WHERE r.day_id = u.id)
                 OR EXISTS (SELECT 1 FROM utility_material_uses m WHERE m.day_id = u.id)
                 OR EXISTS (SELECT 1 FROM utility_loader_runs l WHERE l.day_id = u.id)
                 OR EXISTS (SELECT 1 FROM utility_checks c WHERE c.day_id = u.id)
                 OR EXISTS (SELECT 1 FROM utility_jobs j WHERE j.day_id = u.id)) AS has_rows
         ${DAY_JOIN}
         WHERE ${inRange}
         ORDER BY u.recorded_on`,
        range,
      ),
      query(
        `SELECT u.recorded_on, r.group_text, r.tag_text, r.numeric_value, r.text_value
         ${DAY_JOIN}
         JOIN utility_readings r ON r.day_id = u.id
         WHERE ${inRange} AND d.form_code = 'F/UTI-010'
         ORDER BY u.recorded_on, r.row_index`,
        range,
      ),
      query(
        `SELECT d.form_code, u.recorded_on, r.group_text, r.tag_text,
                MIN(r.numeric_value) AS low, MAX(r.numeric_value) AS high, COUNT(r.numeric_value) AS count
         ${DAY_JOIN}
         JOIN utility_readings r ON r.day_id = u.id
         WHERE ${inRange} AND d.form_code = ANY($4) AND r.numeric_value IS NOT NULL AND r.tag_text IS NOT NULL
         GROUP BY 1, 2, 3, 4
         ORDER BY 2`,
        [...range, BOILER_FORMS],
      ),
      query(
        `SELECT u.recorded_on, l.shift_text, l.hour_start, l.hour_end, l.hours_total, l.fuel_liters, l.oil_liters, l.remark
         FROM utility_days u JOIN utility_loader_runs l ON l.day_id = u.id
         WHERE ${inRange}
         ORDER BY u.recorded_on, l.row_index`,
        range,
      ),
      query(
        `SELECT u.recorded_on, c.item_text, c.result
         FROM utility_days u JOIN utility_checks c ON c.day_id = u.id
         WHERE ${inRange}
         ORDER BY u.recorded_on, c.row_index`,
        range,
      ),
      query(
        `SELECT u.recorded_on, m.group_text, m.material_text, m.lot, m.received_qty, m.used_qty, m.remaining_qty, m.operator, m.remark
         FROM utility_days u JOIN utility_material_uses m ON m.day_id = u.id
         WHERE ${inRange}
         ORDER BY u.recorded_on, m.row_index`,
        range,
      ),
      query(
        `SELECT u.recorded_on, d.form_code, r.observed_time, r.shift_text, r.group_text, r.tag_text,
                r.numeric_value, r.text_value, r.unit, r.remark
         ${DAY_JOIN}
         JOIN utility_readings r ON r.day_id = u.id
         WHERE ${inRange} AND d.form_code = ANY($4)
         ORDER BY u.recorded_on, d.form_code, r.row_index`,
        [...range, READING_FORMS],
      ),
      query(
        `SELECT u.recorded_on, j.id, j.period_text, j.performed_on, j.done_by,
                COALESCE((SELECT json_agg(json_build_object('item', c.item_text, 'result', c.result) ORDER BY c.id)
                          FROM utility_job_checks c WHERE c.job_id = j.id), '[]') AS checks
         FROM utility_days u JOIN utility_jobs j ON j.day_id = u.id
         WHERE u.site_id = $1 AND u.recorded_on <= $2
         ORDER BY COALESCE(j.performed_on, u.recorded_on) DESC, j.id DESC`,
        [siteId, to],
      ),
    ])

    const forms = FORMS.map((form) => {
      const own = days.rows.filter((row) => row.form_code === form.code)
      return {
        ...form,
        logged: own.filter((row) => row.has_rows).map((row) => row.recorded_on),
        empty: own.filter((row) => !row.has_rows).map((row) => row.recorded_on),
        latest: own.at(-1)?.recorded_on ?? null,
        latestShifts: own.at(-1)?.shift_banner ?? null,
      }
    })

    res.json({
      from,
      to,
      dates,
      forms,
      coal: coalDays(coal.rows),
      boiler: boiler.rows.map((row) => ({
        form: row.form_code,
        date: row.recorded_on,
        group: row.group_text,
        ...describeTag(row.tag_text),
        low: num(row.low),
        high: num(row.high),
        count: Number(row.count),
      })),
      loaderRuns: runs.rows.map((row) => ({
        date: row.recorded_on,
        shift: row.shift_text,
        hourStart: num(row.hour_start),
        hourEnd: num(row.hour_end),
        hoursTotal: num(row.hours_total),
        fuel: num(row.fuel_liters),
        oil: num(row.oil_liters),
        remark: row.remark,
      })),
      checks: checks.rows.map((row) => ({ date: row.recorded_on, item: row.item_text, result: row.result })),
      chemicals: materials.rows.map((row) => ({
        date: row.recorded_on,
        group: row.group_text,
        material: row.material_text,
        lot: row.lot,
        received: num(row.received_qty),
        used: num(row.used_qty),
        remaining: num(row.remaining_qty),
        operator: row.operator,
        remark: row.remark,
      })),
      readings: water.rows.map(reading),
      jobs: jobs.rows.map((row) => ({
        date: row.recorded_on,
        period: row.period_text,
        performedOn: row.performed_on,
        doneBy: row.done_by,
        checks: row.checks,
      })),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/day', requireAuth, requirePermission('utility', 'view'), async (req, res, next) => {
  try {
    if (!allowedSite(req, res)) return
    const form = String(req.query.form || '')
    const date = String(req.query.date || '')
    if (!form || !ISO.test(date)) return res.status(400).json({ error: 'form_and_date_required' })
    const result = await query(
      `SELECT u.recorded_on, d.form_code, u.place_text, u.shift_banner,
              r.observed_time, r.shift_text, r.group_text, r.tag_text,
              r.numeric_value, r.text_value, r.unit, r.remark
       ${DAY_JOIN}
       LEFT JOIN utility_readings r ON r.day_id = u.id
       WHERE u.site_id = $1 AND d.form_code = $2 AND u.recorded_on = $3
       ORDER BY r.row_index`,
      [req.params.siteId, form, date],
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'not_found' })
    const first = result.rows[0]
    res.json({
      form,
      date,
      place: first.place_text,
      shifts: first.shift_banner,
      readings: result.rows.filter((row) => row.observed_time != null || row.tag_text != null || row.shift_text != null).map(reading),
    })
  } catch (error) {
    next(error)
  }
})

export default router
