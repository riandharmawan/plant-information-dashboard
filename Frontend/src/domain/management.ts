/** What the management Stock Overview reads from /api/v1/portfolio/stock. */

import type { DataSource } from './dataSource.ts'

export type TankStatus = 'ok' | 'near-full' | 'over' | 'empty' | 'no-data'

export type CommodityClass = 'cpo' | 'refined' | 'pfad' | 'pome' | 'pkfad' | 'rpome' | 'fame' | 'glycerin' | 'limbah' | 'chemical' | 'sludge' | 'cpko' | 'other'

/** The order is the order of the legend and of the colours, so a class keeps its colour everywhere. */
export const CLASS_ORDER: readonly CommodityClass[] = ['cpo', 'refined', 'pfad', 'pome', 'pkfad', 'rpome', 'fame', 'glycerin', 'limbah', 'chemical', 'sludge', 'cpko', 'other']

export interface PortfolioTank {
  tankId: string
  source: DataSource
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
  source: DataSource
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

/* ------------------------------------------------------------------ what the hover cards report */

export const FILL_BIN_LABELS = ['<25%', '25–50%', '50–75%', '75–90%', '≥90%'] as const

/** How many tanks sit in each band of fill, so a site's average is seen next to its spread. */
export function fillSpread(tanks: PortfolioTank[], nearFull: number): number[] {
  const bins = [0, 0, 0, 0, 0]
  for (const tank of tanks) {
    if (tank.fillRatio == null) continue
    const ratio = tank.fillRatio
    bins[ratio < 0.25 ? 0 : ratio < 0.5 ? 1 : ratio < 0.75 ? 2 : ratio < nearFull ? 3 : 4] += 1
  }
  return bins
}

/** The tanks closest to full, which is where the risk is. */
export function closestToFull(tanks: PortfolioTank[], count: number): PortfolioTank[] {
  return tanks
    .filter((tank) => tank.fillRatio != null)
    .sort((a, b) => (b.fillRatio ?? 0) - (a.fillRatio ?? 0) || compareTankIds(a.tankId, b.tankId))
    .slice(0, count)
}

/** Capacity that is not in the fill level because the tank has no reading. */
export function uncountedCapacity(site: Pick<PortfolioSite, 'capacityTotalKg' | 'capacityKg' | 'counts'>): { capacityKg: number; tanks: number } {
  return { capacityKg: Math.max(0, site.capacityTotalKg - site.capacityKg), tanks: site.counts['no-data'] }
}

/* ------------------------------------------------------------------ products inside a class */

/**
 * Classes that gather several products and can be opened up into them. Other stays as it is: it holds what we cannot name. The page shows them grouped, or
 * split into products with one switch. A class with a single product, such as CPO, has nothing to open.
 */
export const EXPANDABLE: ReadonlySet<CommodityClass> = new Set<CommodityClass>(['refined', 'chemical', 'glycerin'])

/**
 * The product a tank holds, tidied so the same product reads the same at every site. Outside Refined oils a
 * trailing number is a gauge's tank-group suffix (METHANOL 3, SM PURE 6), not part of the product.
 */
export function productOf(tank: Pick<PortfolioTank, 'productName' | 'stockGroup' | 'commodityClass'>): string {
  const raw = (tank.productName || tank.stockGroup || '').toUpperCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  if (!raw || raw === '-') return 'UNNAMED'
  if (/^IV ?64$/.test(raw)) return 'IV 64'
  const tidy = tank.commodityClass === 'refined' ? raw : raw.replace(/\s+\d+$/, '')
  return tidy || raw
}

/** The colour of each class, which a product's shade is taken from. */
const CLASS_BASE: Partial<Record<CommodityClass, string>> = {
  refined: '#eb6834',
  chemical: '#1d9bd1',
  glycerin: '#008300',
  other: '#8a9692',
}

/** Hand-picked shades for the known refined products, so each keeps the same shade at every site. */
const REFINED_TINTS: Array<{ background: string; dark: boolean }> = [
  { background: '#eb6834', dark: true },
  { background: '#f4a06f', dark: true },
  { background: '#c9501f', dark: false },
  { background: '#f7bf9f', dark: true },
  { background: '#a8420f', dark: false },
  { background: '#e07a45', dark: true },
  { background: '#d9622b', dark: false },
  { background: '#f9d2bd', dark: true },
]
const KNOWN_REFINED = ['RBDPO', 'RBDPL', 'OLEIN', 'RBDPS', 'RBDPKO', 'IV 64', 'PMF']
const LIGHTNESS = [0.4, 0.55, 0.7, 0.8, 0.48, 0.62, 0.34, 0.86]

function shadeOf(base: string, lightness: number): { background: string; dark: boolean } {
  const r = parseInt(base.slice(1, 3), 16) / 255
  const g = parseInt(base.slice(3, 5), 16) / 255
  const b = parseInt(base.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let hue = 0
  if (delta > 0) {
    if (max === r) hue = ((g - b) / delta) % 6
    else if (max === g) hue = (b - r) / delta + 2
    else hue = (r - g) / delta + 4
    hue *= 60
    if (hue < 0) hue += 360
  }
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(max + min - 1))
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const offset = lightness - chroma / 2
  const [red, green, blue] =
    hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x] : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x]
  const hex = (value: number) => Math.round((value + offset) * 255).toString(16).padStart(2, '0')
  return { background: `#${hex(red)}${hex(green)}${hex(blue)}`, dark: lightness > 0.55 }
}

/**
 * A shade of the class colour for a product. The name written on the segment is what identifies the product,
 * so the shades only need to tell neighbours apart, and a product keeps its shade at every site.
 */
export function tintOf(product: string, code: CommodityClass): { background: string; dark: boolean } {
  if (code === 'refined') {
    const known = KNOWN_REFINED.indexOf(product)
    if (known >= 0) return REFINED_TINTS[known]
  }
  let hash = 0
  for (const char of product) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const base = CLASS_BASE[code] ?? CLASS_BASE.other ?? '#8a9692'
  if (code === 'refined') return REFINED_TINTS[hash % REFINED_TINTS.length]
  return shadeOf(base, LIGHTNESS[hash % LIGHTNESS.length])
}

export interface ProductTotals {
  key: string
  quantityKg: number
  capacityKg: number
  capacityTotalKg: number
  fillRatio: number | null
  tanks: number
  reporting: number
}

/** A class's tanks added up product by product, largest stock first. */
export function productTotals(tanks: PortfolioTank[]): ProductTotals[] {
  const byProduct = new Map<string, ProductTotals>()
  for (const tank of tanks) {
    const key = productOf(tank)
    const row = byProduct.get(key) ?? { key, quantityKg: 0, capacityKg: 0, capacityTotalKg: 0, fillRatio: null, tanks: 0, reporting: 0 }
    row.tanks += 1
    if (tank.capacityKg != null) row.capacityTotalKg += tank.capacityKg
    if (tank.quantityKg != null) row.reporting += 1
    if (tank.quantityKg != null && tank.capacityKg != null) {
      row.quantityKg += tank.quantityKg
      row.capacityKg += tank.capacityKg
    }
    byProduct.set(key, row)
  }
  return [...byProduct.values()]
    .map((row) => ({ ...row, fillRatio: row.capacityKg > 0 ? row.quantityKg / row.capacityKg : null }))
    .sort((a, b) => b.quantityKg - a.quantityKg || a.key.localeCompare(b.key))
}
