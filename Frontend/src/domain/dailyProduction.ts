import logsheets from '../data/logsheets.json'
import { commodityStock } from './commodityStock.ts'
import { presentTank, type RawSounding } from './present.ts'

export type Qty = number | null

export interface PlantDay {
  feed: Qty
  product: Qty
  coproduct: Qty
  beBags: Qty
  pa: Qty
  powerKwh: Qty
  gasMmBtu: Qty
  steam: Qty
  water: Qty
  compressor: Qty
  /** Same-day yield is meaningful only when product and co-product come from today's feed. */
  yieldApplicable: boolean
}

export interface ProductionDay {
  id: string
  refinery500: PlantDay
  refinery150: PlantDay
  fract400: PlantDay
  fract500: PlantDay
  separator: PlantDay
}

const empty = (): PlantDay => ({
  feed: null,
  product: null,
  coproduct: null,
  beBags: null,
  pa: null,
  powerKwh: null,
  gasMmBtu: null,
  steam: null,
  water: null,
  compressor: null,
  yieldApplicable: true,
})

function refinery(values: Partial<PlantDay>): PlantDay {
  return { ...empty(), yieldApplicable: true, ...values }
}

function fractionation(values: Partial<PlantDay>): PlantDay {
  return { ...empty(), yieldApplicable: false, ...values }
}

/**
 * Tonnes and utility readings taken from F/RFA-004(A) and F/RFA-004(B).
 * Duplicate rows that repeat the same flowmeter span are kept once.
 * Refinery 500 is the larger flowmeter; Refinery 150 is the smaller one.
 * PFAD to T.16 follows Refinery 500; PFAD to T.05 follows Refinery 150.
 */
export const PRODUCTION_DAYS: ProductionDay[] = [
  {
    id: '2026-10-06',
    refinery500: refinery({
      feed: 392,
      product: 375,
      coproduct: 16.25,
      beBags: 5,
      pa: 214.6,
      powerKwh: 5095.051,
      gasMmBtu: 42.4928,
      steam: 62911.7,
    }),
    refinery150: refinery({
      feed: 120.503,
      product: 115,
      coproduct: 8.3,
      beBags: 1.5,
      pa: 65.4,
      powerKwh: 3028.851,
      gasMmBtu: 35.2464,
      steam: 28430.9,
    }),
    fract400: fractionation({
      feed: 62,
      product: 162,
      coproduct: 76.33,
    }),
    fract500: empty(),
    separator: empty(),
  },
  {
    id: '2026-10-07',
    refinery500: refinery({
      feed: 415,
      product: 395,
      coproduct: 19.17,
      beBags: 5,
      pa: 207.2,
      powerKwh: 5271.828,
      gasMmBtu: 45.2592,
      steam: 62003.9,
    }),
    refinery150: refinery({
      feed: 125.723,
      product: 117,
      coproduct: 8.5,
      beBags: 1.5,
      pa: 65.4,
      powerKwh: 3144.101,
      gasMmBtu: 37.1952,
      steam: 28430.9,
    }),
    fract400: fractionation({}),
    fract500: empty(),
    separator: empty(),
  },
  {
    id: '2026-10-08',
    refinery500: refinery({}),
    refinery150: refinery({}),
    fract400: fractionation({}),
    fract500: empty(),
    separator: empty(),
  },
]

export const LOGGED_DAYS_ID = 'logged-days'

const PLANT_KEYS = ['refinery500', 'refinery150', 'fract400', 'fract500', 'separator'] as const
export type PlantKey = (typeof PLANT_KEYS)[number]

const SUM_FIELDS = ['feed', 'product', 'coproduct', 'beBags', 'pa', 'powerKwh', 'gasMmBtu', 'steam', 'water', 'compressor'] as const

function sumQty(values: Qty[]): Qty {
  const present = values.filter((value): value is number => value != null)
  if (present.length === 0) return null
  return present.reduce((total, value) => total + value, 0)
}

export function dayHasData(day: ProductionDay): boolean {
  return PLANT_KEYS.some((key) => SUM_FIELDS.some((field) => day[key][field] != null))
}

/** Calendar days that contain at least one logsheet figure. */
export const DATA_DATES: string[] = PRODUCTION_DAYS.filter(dayHasData).map((day) => day.id)

function blankDay(id: string): ProductionDay {
  return {
    id,
    refinery500: empty(),
    refinery150: empty(),
    fract400: fractionation({}),
    fract500: empty(),
    separator: empty(),
  }
}

/** Inclusive sum of every logged day from start through end. Yield is recomputed by the caller. */
export function productionForRange(start: string, end: string, source: readonly ProductionDay[] = PRODUCTION_DAYS): ProductionDay {
  const from = start <= end ? start : end
  const to = start <= end ? end : start
  const days = source.filter((day) => day.id >= from && day.id <= to)
  const total = blankDay(`${from}:${to}`)
  for (const key of PLANT_KEYS) {
    const next = key === 'fract400' || key === 'fract500' ? fractionation({}) : empty()
    for (const field of SUM_FIELDS) {
      next[field] = sumQty(days.map((day) => day[key][field]))
    }
    next.yieldApplicable = key === 'refinery500' || key === 'refinery150' || key === 'separator'
    total[key] = next
  }
  return total
}

export function loggedDaysTotal(): ProductionDay {
  const first = PRODUCTION_DAYS[0]?.id
  const last = PRODUCTION_DAYS[PRODUCTION_DAYS.length - 1]?.id
  if (!first || !last) return blankDay(LOGGED_DAYS_ID)
  return { ...productionForRange(first, last), id: LOGGED_DAYS_ID }
}

export function ratio(part: Qty, whole: Qty): Qty {
  if (part == null || whole == null || whole === 0) return null
  return part / whole
}

export function lossOf(plant: PlantDay): Qty {
  if (!plant.yieldApplicable) return null
  if (plant.feed == null || plant.product == null || plant.coproduct == null) return null
  return plant.feed - plant.product - plant.coproduct
}

export function productYield(plant: PlantDay): Qty {
  if (!plant.yieldApplicable) return null
  return ratio(plant.product, plant.feed)
}

export function coproductYield(plant: PlantDay): Qty {
  if (!plant.yieldApplicable) return null
  return ratio(plant.coproduct, plant.feed)
}

export function lossYield(plant: PlantDay): Qty {
  if (!plant.yieldApplicable) return null
  return ratio(lossOf(plant), plant.feed)
}

export type StockCode = 'CPO' | 'RBDPO' | 'PFAD' | 'OLEIN' | 'RBDPS'

const SOUNDINGS = (logsheets as { soundings: RawSounding[] }).soundings

function blankStock(): Record<StockCode, number | null> {
  return { CPO: null, RBDPO: null, PFAD: null, OLEIN: null, RBDPS: null }
}

function stockKg(rows: RawSounding[]): Record<StockCode, number | null> {
  const stock = commodityStock(rows.map((row) => presentTank(row, undefined, new Date())))
  const result = blankStock()
  for (const row of stock) {
    if (row.code in result) result[row.code as StockCode] = row.quantityKg
  }
  return result
}

/** Last round of each tank, using the same kilogram path as closing. */
function latestRound(rows: RawSounding[]): RawSounding[] {
  const byTank = new Map<string, RawSounding>()
  for (const row of rows) {
    const current = byTank.get(row.tankId)
    if (!current || row.roundIndex >= current.roundIndex) byTank.set(row.tankId, row)
  }
  return [...byTank.values()]
}

/** Calendar day before an ISO date. */
export function dayBefore(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, day || 1)
  date.setDate(date.getDate() - 1)
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0')
  const nextDay = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`
}

/** Latest sounding per tank, converted with the same stockOf path Live Ops uses. */
export function closingStockKg(): Record<StockCode, number | null> {
  return stockKg(latestRound(SOUNDINGS))
}

/**
 * Opening for a report range: the latest round on this date, in kilograms.
 * A date with no sounding stays blank.
 */
export function openingStockKg(on: string): Record<StockCode, number | null> {
  const rows = SOUNDINGS.filter((row) => row.recordedOn === on)
  if (rows.length === 0) return blankStock()
  return stockKg(latestRound(rows))
}
