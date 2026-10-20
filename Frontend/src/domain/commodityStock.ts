import type { TankLive } from './types.ts'

/**
 * Same groups as the "UTILIZE OF COMMODITY" block on the stock report.
 * Each percent is that group's quantity divided by its capacity.
 * IV 64 is kept apart from olein, matching the report.
 * The report leaves the last label blank; its formula is the PFAD total.
 */
const GROUPS = ['CPO', 'RBDPO', 'OLEIN', 'RBDPS', 'IV 64', 'PMF', 'PFAD'] as const

export type StockGroup = (typeof GROUPS)[number]

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

export function stockGroupFor(tank: Pick<TankLive, 'tankId' | 'productName'>): StockGroup | null {
  return REPORT_TANKS[tank.tankId] ?? stockGroupOf(tank.productName)
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

export function commodityStock(tanks: TankLive[]): CommodityStockRow[] {
  const totals = new Map<StockGroup, { quantityKg: number; capacityKg: number }>()
  for (const code of GROUPS) totals.set(code, { quantityKg: 0, capacityKg: 0 })

  for (const tank of tanks) {
    const code = stockGroupFor(tank)
    if (!code || tank.capacityKg == null) continue
    const bucket = totals.get(code)
    if (!bucket) continue
    bucket.capacityKg += tank.capacityKg
    bucket.quantityKg += tank.quantityKg ?? 0
  }

  return GROUPS.map((code) => {
    const bucket = totals.get(code) ?? { quantityKg: 0, capacityKg: 0 }
    const hasCapacity = bucket.capacityKg > 0
    return {
      code,
      quantityKg: hasCapacity ? bucket.quantityKg : null,
      capacityKg: hasCapacity ? bucket.capacityKg : null,
      utilization: hasCapacity ? bucket.quantityKg / bucket.capacityKg : null,
    }
  })
}
