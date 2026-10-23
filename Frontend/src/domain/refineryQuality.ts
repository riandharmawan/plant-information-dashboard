import file from '../data/refineryQuality.json'

export type StreamKey = 'raw_material' | 'bleaching_oil' | 'finished_good' | 'by_product' | 'spent_earth'

export type QualityStream = {
  commodity: string | null
  destination: string | null
  remark: string | null
  parameters: Record<string, number | string>
}

export type QualityReading = {
  rowIndex: number
  time: string
  fromTank: string | null
  flowRate: number | null
  remark: string | null
  streams: Record<StreamKey, QualityStream | null>
}

export type QualityDay = {
  productionDate: string
  reportDate: string | null
  processUnit: string
  processUnitName: string
  declaredOils: string
  readings: QualityReading[]
}

export type ReadingRow = {
  time: string
  fromTank: string | null
  flowRate: number | null
  feedOil: string | null
  feedFfa: number | null
  feedMoisture: number | null
  feedDobi: number | null
  finishedOil: string | null
  finishedFfa: number | null
  colorR: number | null
  colorY: number | null
  toTank: string | null
  remark: string | null
}

export type StreamLine = {
  stream: StreamKey
  hoursWithResult: number
  figure: string | null
  note: string | null
}

export type RefinerySnapshot = {
  productionDate: string | null
  reportDate: string | null
  processUnit: string | null
  processUnitName: string | null
  declaredOils: string
  hoursLogged: number
  figures: {
    finishedFfa: { oil: string; low: number; high: number } | null
    feedFfa: { oil: string; value: number; time: string } | null
    byproductFfa: { value: number; time: string } | null
  }
  streams: StreamLine[]
  oils: string[]
  readings: ReadingRow[]
}

export type HistoryPoint = {
  productionDate: string
  low: number
  high: number
  count: number
}

export type SpotMark = {
  index: number
  time: string
  value: number
}

export type HourlySheet = {
  productionDate: string
  oil: string
  points: Array<{
    time: string
    finishedFfa: number | null
    finishedOil?: string | null
    fromTank?: string | null
    toTank?: string | null
  }>
  feed: SpotMark[]
  bleach: SpotMark[]
  byproduct: SpotMark[]
  spentEarth: SpotMark[]
}

const STREAMS: StreamKey[] = ['raw_material', 'bleaching_oil', 'finished_good', 'by_product', 'spent_earth']

export const REFINERY_DAYS = file.days as QualityDay[]

export function refineryDates(): string[] {
  return [...new Set(REFINERY_DAYS.map((day) => day.productionDate))].sort()
}

function num(value: number | string | undefined): number | null {
  return typeof value === 'number' ? value : null
}

function show(value: number): string {
  return String(Number(value.toFixed(3)))
}

function band(values: number[]): { low: number; high: number } | null {
  if (values.length === 0) return null
  return { low: Math.min(...values), high: Math.max(...values) }
}

function bandText(values: number[]): string | null {
  const span = band(values)
  if (!span) return null
  return span.low === span.high ? show(span.low) : `${show(span.low)}–${show(span.high)}`
}

function inSpan(day: string, from: string, to: string): boolean {
  const start = from <= to ? from : to
  const end = from <= to ? to : from
  return day >= start && day <= end
}

function readingRow(reading: QualityReading): ReadingRow {
  const raw = reading.streams.raw_material
  const finished = reading.streams.finished_good
  return {
    time: reading.time,
    fromTank: reading.fromTank,
    flowRate: reading.flowRate,
    feedOil: raw?.commodity ?? null,
    feedFfa: num(raw?.parameters['lab.ffa']),
    feedMoisture: num(raw?.parameters['lab.moisture']),
    feedDobi: num(raw?.parameters['lab.dobi']),
    finishedOil: finished?.commodity ?? null,
    finishedFfa: num(finished?.parameters['lab.ffa']),
    colorR: num(finished?.parameters['lab.color_r']),
    colorY: num(finished?.parameters['lab.color_y']),
    toTank: finished?.destination ?? null,
    remark: reading.remark,
  }
}

function valuesOf(day: QualityDay, stream: StreamKey, code: string, oil?: string): number[] {
  const values: number[] = []
  for (const reading of day.readings) {
    const item = reading.streams[stream]
    if (!item) continue
    if (oil && item.commodity !== oil) continue
    const value = num(item.parameters[code])
    if (value != null) values.push(value)
  }
  return values
}

function firstSample(day: QualityDay, stream: StreamKey, code: string): { value: number; time: string; oil: string | null } | null {
  for (const reading of day.readings) {
    const item = reading.streams[stream]
    const value = num(item?.parameters[code])
    if (item && value != null) return { value, time: reading.time, oil: item.commodity }
  }
  return null
}

function declaredMissing(day: QualityDay): string[] {
  const present = new Set<string>()
  for (const reading of day.readings) {
    for (const stream of STREAMS) {
      const name = reading.streams[stream]?.commodity
      if (name) present.add(name)
    }
  }
  return day.declaredOils
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item && !present.has(item))
}

export function snapshotFor(from: string, to: string, unit = 'refinery150'): RefinerySnapshot {
  const days = REFINERY_DAYS.filter((day) => day.processUnit === unit && inSpan(day.productionDate, from, to))
  const day = days.reduce<QualityDay | null>((latest, item) => {
    if (!latest || item.productionDate > latest.productionDate) return item
    return latest
  }, null)
  if (!day) {
    return {
      productionDate: null,
      reportDate: null,
      processUnit: null,
      processUnitName: null,
      declaredOils: '',
      hoursLogged: 0,
      figures: { finishedFfa: null, feedFfa: null, byproductFfa: null },
      streams: STREAMS.map((stream) => ({ stream, hoursWithResult: 0, figure: null, note: null })),
      oils: [],
      readings: [],
    }
  }
  const readings = day.readings.map(readingRow)
  const finishedByOil = new Map<string, number[]>()
  for (const row of readings) {
    if (!row.finishedOil || row.finishedFfa == null) continue
    const list = finishedByOil.get(row.finishedOil) ?? []
    list.push(row.finishedFfa)
    finishedByOil.set(row.finishedOil, list)
  }
  const primaryOil = [...finishedByOil.entries()].sort((left, right) => right[1].length - left[1].length)[0]
  const feed = firstSample(day, 'raw_material', 'lab.ffa')
  const byproduct = firstSample(day, 'by_product', 'lab.ffa')
  const missing = declaredMissing(day)
  const streams = STREAMS.map((stream) => {
    const hoursWithResult = day.readings.filter((reading) => reading.streams[stream]).length
    let figure: string | null = null
    if (stream === 'finished_good' && primaryOil) figure = `FFA ${bandText(primaryOil[1])}`
    if (stream === 'raw_material' && feed) figure = `FFA ${show(feed.value)}`
    if (stream === 'by_product' && byproduct) figure = `FFA ${show(byproduct.value)}`
    if (stream === 'bleaching_oil') {
      const colour = bandText(valuesOf(day, stream, 'lab.color_r'))
      if (colour) figure = `R ${colour}`
    }
    if (stream === 'spent_earth') {
      const oil = bandText(valuesOf(day, stream, 'lab.oc'))
      if (oil) figure = `OC ${oil}`
    }
    return {
      stream,
      hoursWithResult,
      figure,
      note: stream === 'raw_material' && missing.length > 0 ? missing.join(', ') : null,
    }
  })
  const oils = [...new Set(readings.flatMap((row) => [row.feedOil, row.finishedOil].filter((item): item is string => Boolean(item))))]
  return {
    productionDate: day.productionDate,
    reportDate: day.reportDate,
    processUnit: day.processUnit,
    processUnitName: day.processUnitName,
    declaredOils: day.declaredOils,
    hoursLogged: day.readings.length,
    figures: {
      finishedFfa: primaryOil ? { oil: primaryOil[0], ...band(primaryOil[1])! } : null,
      feedFfa: feed && feed.oil ? { oil: feed.oil, value: feed.value, time: feed.time } : null,
      byproductFfa: byproduct ? { value: byproduct.value, time: byproduct.time } : null,
    },
    streams,
    oils,
    readings,
  }
}

export function finishedOilFor(from: string, to: string, selected: string[] | null, unit = 'refinery150'): string | null {
  const counts = new Map<string, number>()
  for (const day of REFINERY_DAYS) {
    if (day.processUnit !== unit || !inSpan(day.productionDate, from, to)) continue
    for (const reading of day.readings) {
      const name = reading.streams.finished_good?.commodity
      const ffa = num(reading.streams.finished_good?.parameters['lab.ffa'])
      if (!name || ffa == null) continue
      if (selected && !selected.includes(name)) continue
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null
}

export function oilsInRange(from: string, to: string, unit = 'refinery150'): string[] {
  const names = new Set<string>()
  for (const day of REFINERY_DAYS) {
    if (day.processUnit !== unit || !inSpan(day.productionDate, from, to)) continue
    for (const reading of day.readings) {
      const feed = reading.streams.raw_material?.commodity
      const finished = reading.streams.finished_good?.commodity
      if (feed) names.add(feed)
      if (finished) names.add(finished)
    }
  }
  return [...names]
}

function marks(day: QualityDay, stream: StreamKey, code: string): SpotMark[] {
  const list: SpotMark[] = []
  day.readings.forEach((reading, index) => {
    const value = num(reading.streams[stream]?.parameters[code])
    if (value != null) list.push({ index, time: reading.time, value })
  })
  return list
}

export function hourlyFor(date: string, oil: string, unit = 'refinery150'): HourlySheet | null {
  const day = REFINERY_DAYS.find((item) => item.processUnit === unit && item.productionDate === date)
  if (!day) return null
  return {
    productionDate: date,
    oil,
    points: day.readings.map((reading) => {
      const finished = reading.streams.finished_good
      const sameOil = finished?.commodity === oil
      return {
        time: reading.time,
        finishedFfa: sameOil ? num(finished?.parameters['lab.ffa']) : null,
        finishedOil: finished?.commodity ?? null,
        fromTank: reading.fromTank,
        toTank: finished?.destination ?? null,
      }
    }),
    feed: marks(day, 'raw_material', 'lab.ffa'),
    bleach: marks(day, 'bleaching_oil', 'lab.color_r'),
    byproduct: marks(day, 'by_product', 'lab.ffa'),
    spentEarth: marks(day, 'spent_earth', 'lab.oc'),
  }
}

export function historyFor(from: string, to: string, oil: string, parameter: string, stream: StreamKey, unit = 'refinery150'): HistoryPoint[] {
  return REFINERY_DAYS
    .filter((day) => day.processUnit === unit && inSpan(day.productionDate, from, to))
    .map((day) => {
      const values = valuesOf(day, stream, parameter, oil)
      const span = band(values)
      if (!span) return null
      return { productionDate: day.productionDate, low: span.low, high: span.high, count: values.length }
    })
    .filter((point): point is HistoryPoint => point != null)
}

export type LedgerRow = {
  date: string
  feedOil: string | null
  feedFfa: string | null
  feedMoisture: string | null
  feedDobi: string | null
  finishedOil: string | null
  finishedFfa: string | null
  colour: string | null
  toTank: string | null
  byproductFfa: string | null
  byproductMoisture: string | null
}

export function ledgerFor(from: string, to: string, dates: string[], unit = 'refinery150'): LedgerRow[] {
  return dates.filter((date) => inSpan(date, from, to)).flatMap((date) => {
    const day = REFINERY_DAYS.find((item) => item.processUnit === unit && item.productionDate === date)
    if (!day) {
      return [{
        date,
        feedOil: null,
        feedFfa: null,
        feedMoisture: null,
        feedDobi: null,
        finishedOil: null,
        finishedFfa: null,
        colour: null,
        toTank: null,
        byproductFfa: null,
        byproductMoisture: null,
      }]
    }
    const feedOil = [...new Set(day.readings.map((reading) => reading.streams.raw_material?.commodity).filter(Boolean))].join(', ')
    const feedFfa = firstSample(day, 'raw_material', 'lab.ffa')
    const feedMoisture = firstSample(day, 'raw_material', 'lab.moisture')
    const feedDobi = firstSample(day, 'raw_material', 'lab.dobi')
    const byFfa = firstSample(day, 'by_product', 'lab.ffa')
    const byMoisture = firstSample(day, 'by_product', 'lab.moisture')
    const oils = [...new Set(day.readings.map((reading) => reading.streams.finished_good?.commodity).filter((item): item is string => Boolean(item)))]
    const rows = (oils.length > 0 ? oils : [null]).map((oil) => {
      const rowsForOil = day.readings.filter((reading) => !oil || reading.streams.finished_good?.commodity === oil)
      const ffa = rowsForOil.map((reading) => num(reading.streams.finished_good?.parameters['lab.ffa'])).filter((value): value is number => value != null)
      const red = rowsForOil.map((reading) => num(reading.streams.finished_good?.parameters['lab.color_r'])).filter((value): value is number => value != null)
      const yellow = rowsForOil.map((reading) => num(reading.streams.finished_good?.parameters['lab.color_y'])).filter((value): value is number => value != null)
      const tanks = [...new Set(rowsForOil.map((reading) => reading.streams.finished_good?.destination).filter((item): item is string => Boolean(item)))]
      return {
        date,
        feedOil: feedOil || null,
        feedFfa: feedFfa ? show(feedFfa.value) : null,
        feedMoisture: feedMoisture ? show(feedMoisture.value) : null,
        feedDobi: feedDobi ? show(feedDobi.value) : null,
        finishedOil: oil,
        finishedFfa: bandText(ffa),
        colour: bandText(red) || bandText(yellow) ? `R ${bandText(red) ?? '-'} · Y ${bandText(yellow) ?? '-'}` : null,
        toTank: tanks.join(', ') || null,
        byproductFfa: byFfa ? show(byFfa.value) : null,
        byproductMoisture: byMoisture ? show(byMoisture.value) : null,
      }
    })
    return rows
  })
}
