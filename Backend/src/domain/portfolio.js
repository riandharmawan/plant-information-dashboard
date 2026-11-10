/**
 * The management view of tanks and stock: one summary per site, built from the same tank rows Live Ops
 * shows, so the two always agree. Pure functions only, so they can be tested without a database.
 */
import { COMMODITY_CLASSES, commodityClassOf } from './commodityClass.js'

export const NEAR_FULL = 0.9
/** Above this a tank holds more than it should, which points at a wrong capacity or reading. */
export const OVER_FULL = 1.02
const LIVE_STALE_MINUTES = 60
const ROUNDS_STALE_DAYS = 2
const STATUSES = ['ok', 'near-full', 'over', 'empty', 'no-data']

/**
 * ok, near-full, over (more than full, check the data), empty, or no-data (the gauge or logsheet gave
 * nothing usable). A tank with no data is never counted as empty.
 */
export function tankStatus(tank, nearFull = NEAR_FULL) {
  if (tank.quantityKg == null) return 'no-data'
  if (tank.operationalStatus === 'Empty' || tank.quantityKg <= 0) return 'empty'
  if (tank.fillRatio != null && tank.fillRatio > OVER_FULL) return 'over'
  if (tank.fillRatio != null && tank.fillRatio >= nearFull) return 'near-full'
  return 'ok'
}

/**
 * A spare slot on a gauge (no product, no capacity, no reading) is not a tank in use. It would only add
 * "no data" noise, so the overview leaves it out. A tank with a faulty gauge still has a capacity or a
 * product, so it stays.
 */
export function isInUse(tank) {
  return (
    tank.capacityKg != null ||
    tank.quantityKg != null ||
    Boolean(tank.productName && String(tank.productName).trim()) ||
    Boolean(tank.stockGroup)
  )
}

/** Where a tank's figures come from: the tank gauging system (ATG) or the operators' logsheets. */
export function sourceOf(tank) {
  return tank.readingKind === 'live' || tank.readingKind === 'round' ? 'atg' : 'logsheet'
}

export function slimTank(tank, nearFull = NEAR_FULL) {
  return {
    tankId: tank.tankId,
    source: sourceOf(tank),
    productName: tank.productName ?? '',
    stockGroup: tank.stockGroup ?? null,
    commodityClass: commodityClassOf(tank.productName, tank.stockGroup),
    quantityKg: tank.quantityKg ?? null,
    capacityKg: tank.capacityKg ?? null,
    fillRatio: tank.fillRatio ?? null,
    temperatureC: tank.temperatureC ?? null,
    status: tankStatus(tank, nearFull),
    readingAt: tank.readingAt ?? null,
  }
}

function emptyTotals() {
  return { quantityKg: 0, capacityKg: 0, capacityTotalKg: 0, tanks: 0, reporting: 0 }
}

function emptyCounts() {
  return Object.fromEntries(STATUSES.map((status) => [status, 0]))
}

function addTank(totals, tank) {
  totals.tanks += 1
  if (tank.capacityKg != null) totals.capacityTotalKg += tank.capacityKg
  if (tank.quantityKg != null) totals.reporting += 1
  // Fill is stock over capacity for the tanks that have both, so a tank with no data does not drag it down.
  if (tank.quantityKg != null && tank.capacityKg != null) {
    totals.quantityKg += tank.quantityKg
    totals.capacityKg += tank.capacityKg
  }
}

const fillOf = (totals) => (totals.capacityKg > 0 ? totals.quantityKg / totals.capacityKg : null)

/** Total stock of the tanks that report in both lists, to compare one day with another like for like. */
export function sameTankDelta(now, before) {
  const earlier = new Map(before.filter((t) => t.quantityKg != null).map((t) => [t.tankId, t.quantityKg]))
  let current = 0
  let previous = 0
  let used = 0
  const reporting = now.filter((t) => t.quantityKg != null).length
  for (const tank of now) {
    if (tank.quantityKg == null || !earlier.has(tank.tankId)) continue
    current += tank.quantityKg
    previous += earlier.get(tank.tankId)
    used += 1
  }
  // Less than half the tanks to compare means the change would mislead.
  if (used === 0 || used < reporting / 2) return null
  return { deltaKg: current - previous, tanks: used }
}

/**
 * @param {{ id: string, name: string, companyName?: string, timezone: string }} site
 * @param {object[]} tanks the rows Live Ops shows for the site
 * @param {{ day: string|null, live: boolean, now?: Date, previous?: object[]|null, nearFull?: number }} context
 */
export function summariseSite(site, tanks, context) {
  const nearFull = context.nearFull ?? NEAR_FULL
  const now = context.now ?? new Date()
  const used = tanks.filter(isInUse)
  const slim = used.map((tank) => slimTank(tank, nearFull))

  const total = emptyTotals()
  const byClass = new Map(COMMODITY_CLASSES.map((code) => [code, emptyTotals()]))
  const counts = emptyCounts()
  for (const tank of slim) {
    addTank(total, tank)
    addTank(byClass.get(tank.commodityClass), tank)
    counts[tank.status] += 1
  }

  const times = slim.map((t) => (t.readingAt ? new Date(t.readingAt).getTime() : null)).filter((n) => n != null)
  const newest = times.length ? new Date(Math.max(...times)) : null
  const ageMinutes = context.live && newest ? Math.round((now.getTime() - newest.getTime()) / 60000) : null
  const ageDays =
    !context.live && context.day ? Math.floor((now.getTime() - new Date(`${context.day}T12:00:00Z`).getTime()) / 86400000) : null
  const stale = context.live ? newest == null || ageMinutes > LIVE_STALE_MINUTES : ageDays == null || ageDays >= ROUNDS_STALE_DAYS

  const change = context.previous ? sameTankDelta(used, context.previous) : null

  return {
    id: site.id,
    name: site.name,
    companyName: site.companyName ?? null,
    timezone: site.timezone,
    kind: context.live ? 'live' : 'rounds',
    // A site read by a gauge system says so on its tanks. Anything else is filled from logsheets.
    source: used.some((tank) => sourceOf(tank) === 'atg') ? 'atg' : 'logsheet',
    day: context.day ?? null,
    asOf: context.live ? (newest ? newest.toISOString() : null) : (context.day ?? null),
    ageMinutes,
    ageDays,
    stale,
    quantityKg: total.quantityKg,
    capacityKg: total.capacityKg,
    capacityTotalKg: total.capacityTotalKg,
    fillRatio: fillOf(total),
    tanksTotal: total.tanks,
    tanksReporting: total.reporting,
    counts,
    changeKg: change?.deltaKg ?? null,
    changeTanks: change?.tanks ?? null,
    classes: COMMODITY_CLASSES.map((code) => {
      const t = byClass.get(code)
      return {
        code,
        quantityKg: t.quantityKg,
        capacityKg: t.capacityKg,
        capacityTotalKg: t.capacityTotalKg,
        fillRatio: fillOf(t),
        tanks: t.tanks,
        reporting: t.reporting,
      }
    }).filter((row) => row.tanks > 0),
    tanks: slim,
  }
}

/** Everything across the sites: totals, and what needs attention, grouped so the screen can list it briefly. */
export function summarisePortfolio(sites, nearFull = NEAR_FULL) {
  const total = emptyTotals()
  const counts = emptyCounts()
  let changeKg = 0
  let changeSites = 0
  for (const site of sites) {
    total.quantityKg += site.quantityKg
    total.capacityKg += site.capacityKg
    total.capacityTotalKg += site.capacityTotalKg
    total.tanks += site.tanksTotal
    total.reporting += site.tanksReporting
    for (const key of STATUSES) counts[key] += site.counts[key]
    if (site.changeKg != null) {
      changeKg += site.changeKg
      changeSites += 1
    }
  }
  const attention = []
  for (const kind of ['near-full', 'over', 'empty', 'no-data']) {
    const tanks = sites.flatMap((site) =>
      site.tanks.filter((t) => t.status === kind).map((t) => ({ siteId: site.id, tankId: t.tankId })),
    )
    if (tanks.length) attention.push({ kind, count: tanks.length, tanks })
  }
  const staleSites = sites.filter((site) => site.stale)
  if (staleSites.length) attention.push({ kind: 'stale', count: staleSites.length, sites: staleSites.map((site) => site.id) })
  return {
    nearFull,
    quantityKg: total.quantityKg,
    capacityKg: total.capacityKg,
    capacityTotalKg: total.capacityTotalKg,
    fillRatio: fillOf(total),
    tanksTotal: total.tanks,
    tanksReporting: total.reporting,
    sitesTotal: sites.length,
    sitesFresh: sites.length - staleSites.length,
    counts,
    changeKg: changeSites > 0 ? changeKg : null,
    changeSites,
    attention,
  }
}
