import { parameter } from '../../domain/format.ts'
import { stockOf } from '../../domain/tankStock.ts'
import type { LabHistoryPoint, SoundingPoint } from '../../domain/types.ts'

export type HistoryKind = 'measured' | 'gap'

export type HistoryMetric =
  | 'level'
  | 'quantity'
  | 'emptySpace'
  | 'loadable'
  | 'levelTank'
  | 'temperature'
  | 'ffa'
  | 'moisture'

export interface HistoryDay {
  day: string
  value: number | null
  kind: HistoryKind
}

export function isLabMetric(metric: HistoryMetric): boolean {
  return metric === 'ffa' || metric === 'moisture'
}

function nextDay(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, (day || 1) + 1)
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0')
  const nextDate = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${nextMonth}-${nextDate}`
}

function daysFrom(start: string, end: string): string[] {
  if (!start || !end || start > end) return []
  const days: string[] = []
  let cursor = start
  while (cursor <= end && days.length < 400) {
    days.push(cursor)
    cursor = nextDay(cursor)
  }
  return days
}

function soundingValue(tankId: string, point: SoundingPoint, metric: HistoryMetric): number | null {
  if (metric === 'level') return point.soundingLevelM
  if (metric === 'temperature') return point.temperatureC
  const stock = stockOf(tankId, point.soundingLevelM, point.temperatureC, point.operationalStatus)
  if (metric === 'quantity') return stock.quantityKg
  if (metric === 'emptySpace') return stock.emptySpaceKg
  if (metric === 'loadable') return stock.loadableKg
  if (metric === 'levelTank') return stock.levelRatio == null ? null : stock.levelRatio * 100
  return null
}

/** One point per calendar day. A day without a source row stays empty. */
export function historySeries(
  tankId: string,
  points: SoundingPoint[],
  start: string,
  end: string,
  metric: HistoryMetric,
): HistoryDay[] {
  const byDay = new Map<string, SoundingPoint>()
  for (const point of points) {
    if (point.recordedOn) byDay.set(point.recordedOn, point)
  }

  return daysFrom(start, end).map((day) => {
    const point = byDay.get(day)
    if (!point) return { day, value: null, kind: 'gap' }
    const value = soundingValue(tankId, point, metric)
    if (value == null) return { day, value: null, kind: 'gap' }
    return { day, value, kind: 'measured' }
  })
}

/** Lab results stay on their analysis day. Other days in the range stay empty. */
export function labHistorySeries(points: LabHistoryPoint[], start: string, end: string, code: string): HistoryDay[] {
  const byDay = new Map<string, number>()
  for (const point of points) {
    const day = point.analysisDate
    if (!day) continue
    const value = parameter(point.parameters, code)
    if (value == null) continue
    byDay.set(day, value)
  }

  return daysFrom(start, end).map((day) => {
    const value = byDay.get(day)
    if (value == null) return { day, value: null, kind: 'gap' }
    return { day, value, kind: 'measured' }
  })
}

export interface CommodityDayReading {
  soundingLevelM: number | null
  quantityKg: number | null
  emptySpaceKg: number | null
  loadableKg: number | null
  levelRatio: number | null
  temperatureC: number | null
  operationalStatus: string
}

/** Total quantity of the tanks in one commodity. A day with no sounding stays empty. */
export function commodityQuantitySeries(
  histories: Array<{ tankId: string; points: SoundingPoint[] }>,
  start: string,
  end: string,
): HistoryDay[] {
  const byTank = histories.map((history) => {
    const byDay = new Map<string, SoundingPoint>()
    for (const point of history.points) {
      if (point.recordedOn) byDay.set(point.recordedOn, point)
    }
    return { tankId: history.tankId, byDay }
  })

  return daysFrom(start, end).map((day) => {
    let total = 0
    let measured = false
    for (const history of byTank) {
      const point = history.byDay.get(day)
      if (!point) continue
      const stock = stockOf(history.tankId, point.soundingLevelM, point.temperatureC, point.operationalStatus)
      if (stock.quantityKg == null) continue
      measured = true
      total += stock.quantityKg
    }
    if (!measured) return { day, value: null, kind: 'gap' }
    return { day, value: total, kind: 'measured' }
  })
}

/** One tank's stock figures on a sounding day. Null when that tank has no row that day. */
export function commodityDayReading(tankId: string, points: SoundingPoint[], day: string): CommodityDayReading | null {
  const point = points.find((row) => row.recordedOn === day)
  if (!point) return null
  const stock = stockOf(tankId, point.soundingLevelM, point.temperatureC, point.operationalStatus)
  return {
    soundingLevelM: point.soundingLevelM,
    quantityKg: stock.quantityKg,
    emptySpaceKg: stock.emptySpaceKg,
    loadableKg: stock.loadableKg,
    levelRatio: stock.levelRatio,
    temperatureC: point.temperatureC,
    operationalStatus: point.operationalStatus,
  }
}
