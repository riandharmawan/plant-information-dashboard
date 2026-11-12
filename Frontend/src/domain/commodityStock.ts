import { parameter } from './format.ts'
import type { TankLive } from './types.ts'

/**
 * Same groups as the "UTILIZE OF COMMODITY" block on the stock report.
 * Each percent is that group's quantity divided by its capacity.
 * IV 64 is kept apart from olein, matching the report.
 * The report leaves the last label blank; its formula is the PFAD total.
 */
const GROUPS: readonly string[] = ['CPO', 'RBDPO', 'OLEIN', 'RBDPS', 'IV 64', 'PMF', 'PFAD']

/**
 * A commodity card. The seven above are the stock report's groups for a logsheet site. A tank read by
 * a gauge system brings its own group, which follows the product the gauge assigns to it.
 */
export type StockGroup = string

/**
 * Tank blocks on the 13 Oct 2026 stock report. The lab name on a card can
 * differ (T.02 is IV 64 on the report and RPL/RPOL on the certificate).
 */
const REPORT_TANKS: Record<string, StockGroup> = {
  T11: 'CPO',
  T12: 'CPO',
  T13: 'CPO',
  T14: 'CPO',
  T25: 'CPO',
  T26: 'CPO',
  T27: 'CPO',
  T03: 'RBDPO',
  T07: 'RBDPO',
  T22: 'RBDPO',
  T23: 'RBDPO',
  T24: 'RBDPO',
  T29: 'RBDPO',
  T01: 'OLEIN',
  T08: 'OLEIN',
  T28: 'OLEIN',
  T15: 'RBDPS',
  T21: 'RBDPS',
  T02: 'IV 64',
  T20: 'PMF',
  T04: 'PFAD',
  T05: 'PFAD',
  T16: 'PFAD',
}

export interface CommodityStockRow {
  code: StockGroup
  quantityKg: number | null
  capacityKg: number | null
  /** Quantity divided by capacity. Null when the group has no capacity. */
  utilization: number | null
  /** Tanks in the group that have a capacity. */
  tankCount: number
  /** Tanks in the group with stock above zero. */
  holdingTanks: number
  /** Simple means over the holding tanks. Null when none has a value. */
  avgTemperatureC: number | null
  avgFfa: number | null
  avgMi: number | null
  /** Lovibond colour over the tanks holding stock: the average, and the range behind it. */
  colourR: ColourStat | null
  colourY: ColourStat | null
}

export interface ColourStat {
  average: number
  min: number
  max: number
  count: number
}

export function stockGroupOf(productName: string): StockGroup | null {
  const name = productName.toUpperCase()
  if (!name.trim() || name.includes('SLUDGE')) return null
  if (name.includes('PFAD')) return 'PFAD'
  if (name.includes('PMF')) return 'PMF'
  if (name.includes('IV64') || name.includes('IV 64')) return 'IV 64'
  if (name.includes('RBDPS') || name.includes('RPS')) return 'RBDPS'
  if (name.includes('OLEIN') || name.includes('RPOL') || name.includes('RPL')) return 'OLEIN'
  if (name.includes('RBDPO') || name.includes('RPO')) return 'RBDPO'
  if (name.includes('CPO')) return 'CPO'
  return null
}

/** A tank read by a gauge system says so, and then its own group is the only one that counts. */
function isGauged(tank: Pick<TankLive, 'readingKind'>): boolean {
  return tank.readingKind === 'live' || tank.readingKind === 'round'
}

export function stockGroupFor(tank: Pick<TankLive, 'tankId' | 'productName' | 'readingKind' | 'stockGroup'>): StockGroup | null {
  if (isGauged(tank)) return tank.stockGroup ?? null
  return REPORT_TANKS[tank.tankId] ?? stockGroupOf(tank.productName)
}

/**
 * The cards to show. A logsheet site always shows the report's seven. When tanks come from a gauge
 * system, the cards are the groups those tanks are in: the report's groups first, in their order,
 * then the rest with the most capacity first.
 */
function cardCodes(tanks: TankLive[]): StockGroup[] {
  if (!tanks.some(isGauged)) return [...GROUPS]
  const capacity = new Map<StockGroup, number>()
  for (const tank of tanks) {
    const code = stockGroupFor(tank)
    if (code) capacity.set(code, (capacity.get(code) ?? 0) + (tank.capacityKg ?? 0))
  }
  const known = GROUPS.filter((code) => capacity.has(code))
  const others = [...capacity.keys()]
    .filter((code) => !GROUPS.includes(code))
    .sort((left, right) => (capacity.get(right) ?? 0) - (capacity.get(left) ?? 0) || left.localeCompare(right))
  return [...known, ...others]
}

export function commoditySources(tanks: TankLive[], code: StockGroup): TankLive[] {
  return tanks
    .filter((tank) => stockGroupFor(tank) === code && tank.capacityKg != null)
    .sort((left, right) => compareTankIds(left.tankId, right.tankId))
}

function compareTankIds(left: string, right: string): number {
  const leftNumber = /^T(\d+)$/.exec(left)
  const rightNumber = /^T(\d+)$/.exec(right)
  if (leftNumber && rightNumber) return Number(leftNumber[1]) - Number(rightNumber[1])
  if (leftNumber) return -1
  if (rightNumber) return 1
  return left.localeCompare(right)
}

interface Bucket {
  quantityKg: number
  capacityKg: number
  tankCount: number
  holding: TankLive[]
}

export function commodityStock(tanks: TankLive[]): CommodityStockRow[] {
  const totals = new Map<StockGroup, Bucket>()
  const codes = cardCodes(tanks)
  for (const code of codes) totals.set(code, { quantityKg: 0, capacityKg: 0, tankCount: 0, holding: [] })

  for (const tank of tanks) {
    const code = stockGroupFor(tank)
    if (!code || tank.capacityKg == null) continue
    const bucket = totals.get(code)
    if (!bucket) continue
    bucket.capacityKg += tank.capacityKg
    bucket.quantityKg += tank.quantityKg ?? 0
    bucket.tankCount += 1
    if (tank.quantityKg != null && tank.quantityKg > 0) bucket.holding.push(tank)
  }

  return codes.map((code) => {
    const bucket = totals.get(code) ?? { quantityKg: 0, capacityKg: 0, tankCount: 0, holding: [] }
    const hasCapacity = bucket.capacityKg > 0
    return {
      code,
      quantityKg: hasCapacity ? bucket.quantityKg : null,
      capacityKg: hasCapacity ? bucket.capacityKg : null,
      utilization: hasCapacity ? bucket.quantityKg / bucket.capacityKg : null,
      tankCount: bucket.tankCount,
      holdingTanks: bucket.holding.length,
      avgTemperatureC: mean(bucket.holding.map((tank) => tank.temperatureC)),
      avgFfa: mean(bucket.holding.map((tank) => parameter(tank.quality?.parameters, 'FFA'))),
      avgMi: mean(bucket.holding.map((tank) => parameter(tank.quality?.parameters, 'MI'))),
      colourR: colourStat(bucket.holding.map((tank) => parameter(tank.quality?.parameters, 'COLOR_R'))),
      colourY: colourStat(bucket.holding.map((tank) => parameter(tank.quality?.parameters, 'COLOR_Y'))),
    }
  })
}

function colourStat(values: Array<number | null | undefined>): ColourStat | null {
  const nums = values.filter((value): value is number => value != null && !Number.isNaN(value))
  if (nums.length === 0) return null
  return { average: nums.reduce((sum, value) => sum + value, 0) / nums.length, min: Math.min(...nums), max: Math.max(...nums), count: nums.length }
}

function mean(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((value): value is number => value != null && !Number.isNaN(value))
  if (nums.length === 0) return null
  return nums.reduce((sum, value) => sum + value, 0) / nums.length
}
