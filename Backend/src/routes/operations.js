import { Router } from 'express'
import { query } from '../db.js'
import { loadCatalog } from '../catalog.js'
import { stockFromProfile } from '../domain/stock.js'
import { assessStorage, oilFamilyOf, presentLogistics, presentTank } from '../domain/present.js'

const router = Router()

function num(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function compareTanks(a, b) {
  const aTank = /^T\d+$/.test(a)
  const bTank = /^T\d+$/.test(b)
  if (aTank && bTank) return Number(a.slice(1)) - Number(b.slice(1))
  if (aTank) return -1
  if (bTank) return 1
  return a.localeCompare(b)
}

async function siteOf(siteId) {
  const result = await query(
    `SELECT s.id, s.name, s.timezone, c.name AS company_name
     FROM sites s JOIN companies c ON c.id = s.company_id
     WHERE s.id = $1`,
    [siteId],
  )
  return result.rows[0] ?? null
}

function soundingFrom(row) {
  return {
    roundIndex: row.round_index,
    recordedOn: row.recorded_on,
    tankId: row.tank_code,
    productName: row.product_name ?? '',
    soundingLevelM: num(row.level_m),
    temperatureC: num(row.temperature_c),
    operationalStatus: row.operational_status ?? '',
  }
}

const LAB_LABEL = {
  'lab.ffa': ['FFA', 'FFA', '%'],
  'lab.moisture': ['MI', 'M&I', '%'],
  'lab.color_r': ['R', 'R', ''],
  'lab.color_y': ['Y', 'Y', ''],
  'lab.iv': ['IV', 'IV', ''],
  'lab.pv': ['PV', 'PV', ''],
  'lab.dobi': ['DOBI', 'DOBI', ''],
  'lab.totox': ['Totox', 'Totox', ''],
}

function labFrom(row) {
  return {
    tankId: row.tank_code,
    productName: row.product_name ?? '',
    analysisDate: row.analysis_date,
    snapshotOn: row.snapshot_on,
    temperatureC: num(row.temperature_c),
    parameters: (row.tests ?? []).flatMap((test) => {
      const label = LAB_LABEL[test.canonical_code]
      if (!label || test.numeric_value == null) return []
      return [{ code: label[0], label: label[1], value: num(test.numeric_value), unit: label[2] }]
    }),
  }
}

async function certificateLabs(siteId) {
  const result = await query(
    `SELECT t.code AS tank_code, c.oil AS product_name, c.analysis_date, c.snapshot_on, c.temperature_c,
            p.canonical_code, p.numeric_value
     FROM storage_certificates c
     JOIN tanks t ON t.id = c.tank_id
     LEFT JOIN certificate_parameters p ON p.certificate_id = c.id
     WHERE c.site_id = $1
     ORDER BY c.snapshot_on, t.code`,
    [siteId],
  )
  const grouped = new Map()
  for (const row of result.rows) {
    const key = `${row.tank_code}|${row.snapshot_on}|${row.analysis_date}`
    if (!grouped.has(key)) grouped.set(key, { ...row, tests: [] })
    if (row.canonical_code) grouped.get(key).tests.push(row)
  }
  return [...grouped.values()]
}

function certificateAsOf(rows, day) {
  return rows
    .filter((lab) => lab.analysisDate && day && lab.analysisDate <= day)
    .sort((left, right) => (left.analysisDate ?? '').localeCompare(right.analysisDate ?? ''))
    .at(-1) ?? null
}

router.get('/sites', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT s.id, s.name, s.timezone, c.name AS "companyName"
       FROM sites s JOIN companies c ON c.id = s.company_id
       ORDER BY s.name`,
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
})

router.get('/sites/:siteId', async (req, res, next) => {
  try {
    const site = await siteOf(req.params.siteId)
    if (!site) return res.status(404).json({ error: 'Site not found' })
    res.json({
      companyName: site.company_name,
      siteName: site.name,
      timezone: site.timezone,
    })
  } catch (error) {
    next(error)
  }
})

router.get('/sites/:siteId/snapshot', async (req, res, next) => {
  try {
    const site = await siteOf(req.params.siteId)
    if (!site) return res.status(404).json({ error: 'Site not found' })
    const soundings = await query(
      `SELECT recorded_on, round_index FROM soundings WHERE site_id = $1`,
      [site.id],
    )
    const labs = await query(
      `SELECT snapshot_on, analysis_date FROM storage_certificates WHERE site_id = $1`,
      [site.id],
    )
    const logistics = await query(
      `SELECT sampled_on FROM logistics_events WHERE site_id = $1`,
      [site.id],
    )
    const dates = [...new Set(soundings.rows.map((row) => row.recorded_on).filter(Boolean))].sort()
    const activity = new Set()
    for (const row of soundings.rows) if (row.recorded_on) activity.add(row.recorded_on)
    for (const row of labs.rows) {
      if (row.snapshot_on) activity.add(row.snapshot_on)
      if (row.analysis_date) activity.add(row.analysis_date)
    }
    for (const row of logistics.rows) if (row.sampled_on) activity.add(row.sampled_on)
    const rounds = new Set(soundings.rows.map((row) => row.round_index))
    const period = dates.length ? `${dates[0]} – ${dates[dates.length - 1]}` : null
    res.json({
      dataSource: 'api',
      soundingAsOf: dates.at(-1) ?? null,
      soundingDates: dates,
      periodLabel: period,
      dataDates: [...activity].sort(),
      roundCount: rounds.size,
    })
  } catch (error) {
    next(error)
  }
})

router.get('/sites/:siteId/live/tanks', async (req, res, next) => {
  try {
    const site = await siteOf(req.params.siteId)
    if (!site) return res.status(404).json({ error: 'Site not found' })
    const from = req.query.from || null
    const to = req.query.to || null
    const soundings = await query(
      `SELECT t.code AS tank_code, s.recorded_on, s.round_index, s.product_name,
              s.level_m, s.temperature_c, s.operational_status
       FROM soundings s JOIN tanks t ON t.id = s.tank_id
       WHERE s.site_id = $1
       ORDER BY s.recorded_on, s.round_index`,
      [site.id],
    )
    const labs = { rows: await certificateLabs(site.id) }
    const dates = [...new Set(soundings.rows.map((row) => row.recorded_on).filter(Boolean))].sort()
    const day = req.query.on === undefined || req.query.on === ''
      ? dates.at(-1) ?? null
      : req.query.on
    const known = new Set([
      ...soundings.rows.map((row) => row.tank_code),
      ...labs.rows.map((row) => row.tank_code),
    ])
    const thatDay = new Map()
    for (const row of soundings.rows) {
      if (row.recorded_on === day) thatDay.set(row.tank_code, soundingFrom(row))
    }
    const catalog = await loadCatalog()
    const tanks = [...known].map((tankId) => {
      const sounding = thatDay.get(tankId) ?? {
        roundIndex: 0,
        recordedOn: day,
        tankId,
        productName: '',
        soundingLevelM: null,
        temperatureC: null,
        operationalStatus: '',
      }
      const lab = certificateAsOf(labs.rows.filter((row) => row.tank_code === tankId).map(labFrom), sounding.recordedOn)
      const profile = catalog.profiles.get(tankId)
      const stock = profile
        ? stockFromProfile(profile, catalog.tables, sounding.soundingLevelM, sounding.temperatureC, sounding.operationalStatus)
        : { capacityKg: null, quantityKg: null, emptySpaceKg: null, loadableKg: null, levelRatio: null }
      return presentTank(sounding, lab, stock, site.timezone)
    })
    tanks.sort((a, b) => compareTanks(a.tankId, b.tankId))
    res.json(tanks)
  } catch (error) {
    next(error)
  }
})

function currentLab(rows, from, to) {
  const filtered = rows.filter((lab) => {
    if (!from && !to) return true
    const day = lab.analysisDate
    if (day == null) return false
    if (from && day < from) return false
    if (to && day > to) return false
    return true
  })
  return filtered
    .sort((a, b) => {
      const analysis = (a.analysisDate ?? '').localeCompare(b.analysisDate ?? '')
      if (analysis !== 0) return analysis
      return (a.snapshotOn ?? '').localeCompare(b.snapshotOn ?? '')
    })
    .at(-1)
}

router.get('/sites/:siteId/live/logistics', async (req, res, next) => {
  try {
    const site = await siteOf(req.params.siteId)
    if (!site) return res.status(404).json({ error: 'Site not found' })
    const result = await query(
      `SELECT id, mode, name, commodity, direction, target_label, ffa, moisture,
              sampled_on, remark, sample_breach, detail_lines
       FROM logistics_events WHERE site_id = $1`,
      [site.id],
    )
    const rows = result.rows.map((row) => presentLogistics({
      id: row.id,
      mode: row.mode,
      name: row.name,
      commodity: row.commodity,
      direction: row.direction,
      targetLabel: row.target_label,
      ffa: num(row.ffa),
      moisture: num(row.moisture),
      sampledOn: row.sampled_on,
      remark: row.remark,
      sampleBreach: row.sample_breach,
      detailLines: row.detail_lines ?? [],
    }))
    rows.sort((a, b) => {
      if (a.routingLocked !== b.routingLocked) return a.routingLocked ? -1 : 1
      if (a.mode !== b.mode) return a.mode === 'vessel' ? -1 : 1
      return (b.sampledOn ?? '').localeCompare(a.sampledOn ?? '')
    })
    res.json(rows)
  } catch (error) {
    next(error)
  }
})

router.get('/sites/:siteId/tanks/:tankId/soundings', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT s.recorded_on, s.round_index, s.level_m, s.temperature_c, s.operational_status
       FROM soundings s JOIN tanks t ON t.id = s.tank_id
       WHERE s.site_id = $1 AND t.code = $2
       ORDER BY s.recorded_on, s.round_index`,
      [req.params.siteId, req.params.tankId],
    )
    res.json(result.rows.map((row) => ({
      roundIndex: row.round_index,
      recordedOn: row.recorded_on,
      soundingLevelM: num(row.level_m),
      temperatureC: num(row.temperature_c),
      operationalStatus: row.operational_status ?? '',
      storageVerdict: 'spec-pending',
    })))
  } catch (error) {
    next(error)
  }
})

router.get('/sites/:siteId/tanks/:tankId/labs', async (req, res, next) => {
  try {
    const site = await siteOf(req.params.siteId)
    if (!site) return res.status(404).json({ error: 'Site not found' })
    const result = { rows: (await certificateLabs(site.id)).filter((row) => row.tank_code === req.params.tankId) }
    const byAnalysis = new Map()
    for (const row of result.rows) {
      const lab = labFrom({ ...row, tank_code: req.params.tankId })
      byAnalysis.set(lab.analysisDate ?? lab.snapshotOn ?? req.params.tankId, lab)
    }
    const series = [...byAnalysis.values()].sort((a, b) => (a.analysisDate ?? '').localeCompare(b.analysisDate ?? ''))
    res.json(series.map((lab) => {
      const quality = assessStorage(oilFamilyOf(lab.productName), lab.parameters, lab.analysisDate, site.timezone)
      return {
        snapshotOn: lab.snapshotOn,
        analysisDate: lab.analysisDate,
        parameters: quality.parameters,
        storageVerdict: quality.storageVerdict,
      }
    }))
  } catch (error) {
    next(error)
  }
})

router.get('/sites/:siteId/analytics/summary', async (req, res, next) => {
  try {
    const siteId = req.params.siteId
    const tankId = req.query.tankId || null
    const soundings = await query(
      `SELECT t.code AS tank_code, s.recorded_on, s.round_index, s.level_m, s.temperature_c
       FROM soundings s JOIN tanks t ON t.id = s.tank_id
       WHERE s.site_id = $1 AND ($2::text IS NULL OR t.code = $2)
       ORDER BY s.recorded_on, s.round_index`,
      [siteId, tankId],
    )
    let rows = soundings.rows
    if (!tankId) {
      const byTank = new Map()
      for (const row of rows) {
        const previous = byTank.get(row.tank_code)
        if (!previous || (row.recorded_on ?? '') >= (previous.recorded_on ?? '')) byTank.set(row.tank_code, row)
      }
      rows = [...byTank.values()]
    }
    const logistics = await query(
      `SELECT commodity, direction, ffa, moisture, sample_breach FROM logistics_events WHERE site_id = $1`,
      [siteId],
    )
    const judged = logistics.rows
      .map((row) => presentLogistics({
        id: '',
        mode: 'truck',
        name: '',
        commodity: row.commodity,
        direction: row.direction,
        targetLabel: null,
        ffa: num(row.ffa),
        moisture: num(row.moisture),
        sampledOn: null,
        remark: null,
        sampleBreach: row.sample_breach,
        detailLines: [],
      }))
      .filter((item) => item.oilFamily === 'CPO' && item.verdict !== 'spec-pending')
    const passed = judged.filter((item) => item.verdict === 'pass').length
    res.json({
      tankId,
      averageLevelM: average(rows.map((row) => num(row.level_m))),
      averageTempC: average(rows.map((row) => num(row.temperature_c))),
      throughputTon: null,
      approvalRate: tankId || judged.length === 0 ? null : passed / judged.length,
      approvalScope: tankId || judged.length === 0 ? null : 'inbound-cpo',
    })
  } catch (error) {
    next(error)
  }
})

router.get('/sites/:siteId/analytics/movements', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT commodity, direction FROM analytics_movements WHERE site_id = $1`,
      [req.params.siteId],
    )
    const totals = new Map()
    for (const movement of result.rows) {
      const row = totals.get(movement.commodity) ?? {
        commodity: movement.commodity,
        inbound: 0,
        outbound: 0,
        unknown: 0,
      }
      if (movement.direction === 'inbound') row.inbound += 1
      else if (movement.direction === 'outbound') row.outbound += 1
      else row.unknown += 1
      totals.set(movement.commodity, row)
    }
    const body = [...totals.values()].sort(
      (a, b) => (b.inbound + b.outbound + b.unknown) - (a.inbound + a.outbound + a.unknown),
    )
    res.json(body)
  } catch (error) {
    next(error)
  }
})

function average(values) {
  const nums = values.filter((value) => value != null)
  if (nums.length === 0) return null
  return nums.reduce((sum, value) => sum + value, 0) / nums.length
}

export default router
