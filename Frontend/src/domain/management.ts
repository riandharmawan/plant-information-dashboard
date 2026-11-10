/** What the management Stock Overview reads from /api/v1/portfolio/stock. */

export type TankStatus = 'ok' | 'near-full' | 'over' | 'empty' | 'no-data'

export type CommodityClass = 'crude' | 'refined' | 'byproduct' | 'biodiesel' | 'glycerin' | 'chemical' | 'other'

/** The order is the order of the legend and of the colours, so a class keeps its colour everywhere. */
export const CLASS_ORDER: readonly CommodityClass[] = ['crude', 'refined', 'byproduct', 'biodiesel', 'glycerin', 'chemical', 'other']

export interface PortfolioTank {
  tankId: string
  productName: string
  stockGroup: string | null
  commodityClass: CommodityClass
  quantityKg: number | null
  capacityKg: number | null
  fillRatio: number | null
  temperatureC: number | null
  status: TankStatus
  readingAt: string | null
}

export interface ClassTotals {
  code: CommodityClass
  quantityKg: number
  capacityKg: number
  capacityTotalKg: number
  fillRatio: number | null
  tanks: number
  reporting: number
}

export interface PortfolioSite {
  id: string
  name: string
  companyName: string | null
  timezone: string
  kind: 'live' | 'rounds'
  day: string | null
  asOf: string | null
  ageMinutes: number | null
  ageDays: number | null
  stale: boolean
  quantityKg: number
  capacityKg: number
  capacityTotalKg: number
  fillRatio: number | null
  tanksTotal: number
  tanksReporting: number
  counts: Record<TankStatus, number>
  changeKg: number | null
  changeTanks: number | null
  classes: ClassTotals[]
  tanks: PortfolioTank[]
}

export type AttentionItem =
  | { kind: 'near-full' | 'over' | 'empty' | 'no-data'; count: number; tanks: Array<{ siteId: string; tankId: string }> }
  | { kind: 'stale'; count: number; sites: string[] }

export interface PortfolioSummary {
  nearFull: number
  quantityKg: number
  capacityKg: number
  capacityTotalKg: number
  fillRatio: number | null
  tanksTotal: number
  tanksReporting: number
  sitesTotal: number
  sitesFresh: number
  counts: Record<TankStatus, number>
  changeKg: number | null
  changeSites: number
  attention: AttentionItem[]
}

export interface PortfolioPayload {
  generatedAt: string
  portfolio: PortfolioSummary
  sites: PortfolioSite[]
  failed: Array<{ id: string; name: string }>
}

export interface TankHistoryPoint {
  recordedOn: string
  roundIndex: number
  quantityKg: number | null
  capacityKg: number | null
  fillRatio: number | null
}

/** Tonnes with thousands separators and no decimals: 55,849. */
export function formatTonnes(kg: number | null, locale: string): string {
  if (kg == null) return '—'
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(kg / 1000)
}

/** A signed change in tonnes: +412 or −96. */
export function formatSignedTonnes(kg: number, locale: string): string {
  const tonnes = Math.round(kg / 1000)
  const sign = tonnes > 0 ? '+' : tonnes < 0 ? '−' : ''
  return `${sign}${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.abs(tonnes))}`
}

export function formatPercent(ratio: number | null, locale: string, digits = 1): string {
  if (ratio == null) return '—'
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(ratio * 100)}%`
}

/** The totals of one commodity class across every site. */
export function classAcrossSites(sites: PortfolioSite[], code: CommodityClass): ClassTotals {
  const total: ClassTotals = { code, quantityKg: 0, capacityKg: 0, capacityTotalKg: 0, fillRatio: null, tanks: 0, reporting: 0 }
  for (const site of sites) {
    const row = site.classes.find((item) => item.code === code)
    if (!row) continue
    total.quantityKg += row.quantityKg
    total.capacityKg += row.capacityKg
    total.capacityTotalKg += row.capacityTotalKg
    total.tanks += row.tanks
    total.reporting += row.reporting
  }
  total.fillRatio = total.capacityKg > 0 ? total.quantityKg / total.capacityKg : null
  return total
}

export function compareTankIds(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true })
}
