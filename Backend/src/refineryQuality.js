const STREAMS = ['raw_material', 'bleaching_oil', 'finished_good', 'by_product', 'spent_earth']

function show(value) {
  return String(Number(value.toFixed(3)))
}

function band(values) {
  if (values.length === 0) return null
  return { low: Math.min(...values), high: Math.max(...values) }
}

function bandText(values) {
  const span = band(values)
  if (!span) return null
  return span.low === span.high ? show(span.low) : `${show(span.low)}–${show(span.high)}`
}

function num(value) {
  return typeof value === 'number' ? value : null
}

function inSpan(day, from, to) {
  if (!from && !to) return true
  const start = !from || !to || from <= to ? (from || day) : to
  const end = !from || !to || from <= to ? (to || day) : from
  return day >= start && day <= end
}

function readingRow(reading) {
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

function valuesOf(day, stream, code, oil) {
  const values = []
  for (const reading of day.readings) {
    const item = reading.streams[stream]
    if (!item) continue
    if (oil && item.commodity !== oil) continue
    const value = num(item.parameters[code])
    if (value != null) values.push(value)
  }
  return values
}

function firstSample(day, stream, code) {
  for (const reading of day.readings) {
    const item = reading.streams[stream]
    const value = num(item?.parameters[code])
    if (item && value != null) return { value, time: reading.time, oil: item.commodity }
  }
  return null
}

export function snapshotFromDays(days, from, to) {
  const matched = days.filter((day) => inSpan(day.productionDate, from, to))
  const day = matched.reduce((latest, item) => (!latest || item.productionDate > latest.productionDate ? item : latest), null)
  if (!day) {
    return {
      productionDate: null,
      reportDate: null,
      processUnit: null,
      processUnitName: null,
      declaredOils: '',
      importedAt: null,
      hoursLogged: 0,
      figures: { finishedFfa: null, feedFfa: null, byproductFfa: null },
      streams: STREAMS.map((stream) => ({ stream, hoursWithResult: 0, figure: null })),
      oils: [],
      readings: [],
    }
  }
  const readings = day.readings.map(readingRow)
  const finishedByOil = new Map()
  for (const row of readings) {
    if (!row.finishedOil || row.finishedFfa == null) continue
    const list = finishedByOil.get(row.finishedOil) ?? []
    list.push(row.finishedFfa)
    finishedByOil.set(row.finishedOil, list)
  }
  const primary = [...finishedByOil.entries()].sort((left, right) => right[1].length - left[1].length)[0]
  const feed = firstSample(day, 'raw_material', 'lab.ffa')
  const byproduct = firstSample(day, 'by_product', 'lab.ffa')
  return {
    productionDate: day.productionDate,
    reportDate: day.reportDate,
    processUnit: day.processUnit,
    processUnitName: day.processUnitName,
    declaredOils: day.declaredOils,
    importedAt: day.importedAt,
    hoursLogged: day.readings.length,
    figures: {
      finishedFfa: primary ? { oil: primary[0], ...band(primary[1]) } : null,
      feedFfa: feed?.oil ? { oil: feed.oil, value: feed.value, time: feed.time } : null,
      byproductFfa: byproduct ? { value: byproduct.value, time: byproduct.time } : null,
    },
    streams: STREAMS.map((stream) => {
      const hoursWithResult = day.readings.filter((reading) => reading.streams[stream]).length
      let figure = null
      if (stream === 'finished_good' && primary) figure = `FFA ${bandText(primary[1])}`
      if (stream === 'raw_material' && feed) figure = `FFA ${show(feed.value)}`
      if (stream === 'by_product' && byproduct) figure = `FFA ${show(byproduct.value)}`
      return { stream, hoursWithResult, figure, note: null }
    }),
    oils: [...new Set(readings.flatMap((row) => [row.feedOil, row.finishedOil].filter(Boolean)))],
    readings,
  }
}

export function finishedOilFromDays(days, selected) {
  const counts = new Map()
  for (const day of days) {
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

export function hourlyFromDays(days, date, oil) {
  const day = days.find((item) => item.productionDate === date)
  if (!day || !oil) return null
  const marks = (stream, code) => {
    const list = []
    day.readings.forEach((reading, index) => {
      const value = num(reading.streams[stream]?.parameters[code])
      if (value != null) list.push({ index, time: reading.time, value })
    })
    return list
  }
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
        fromTank: reading.fromTank ?? null,
        toTank: finished?.destination ?? null,
      }
    }),
    feed: marks('raw_material', 'lab.ffa'),
    bleach: marks('bleaching_oil', 'lab.color_r'),
    byproduct: marks('by_product', 'lab.ffa'),
    spentEarth: marks('spent_earth', 'lab.oc'),
  }
}

function sampleText(day, stream, code) {
  const sample = firstSample(day, stream, code)
  return sample ? show(sample.value) : null
}

export function ledgerFromDays(days) {
  return days.flatMap((day) => {
    const feedOil = [...new Set(day.readings.map((reading) => reading.streams.raw_material?.commodity).filter(Boolean))].join(', ')
    const byFfa = sampleText(day, 'by_product', 'lab.ffa')
    const oils = [...new Set(day.readings.map((reading) => reading.streams.finished_good?.commodity).filter(Boolean))]
    return (oils.length > 0 ? oils : [null]).map((oil) => {
      const rows = day.readings.filter((reading) => !oil || reading.streams.finished_good?.commodity === oil)
      const ffa = rows.map((reading) => num(reading.streams.finished_good?.parameters['lab.ffa'])).filter((value) => value != null)
      const red = rows.map((reading) => num(reading.streams.finished_good?.parameters['lab.color_r'])).filter((value) => value != null)
      const yellow = rows.map((reading) => num(reading.streams.finished_good?.parameters['lab.color_y'])).filter((value) => value != null)
      const tanks = [...new Set(rows.map((reading) => reading.streams.finished_good?.destination).filter(Boolean))]
      return {
        date: day.productionDate,
        feedOil: feedOil || null,
        feedFfa: sampleText(day, 'raw_material', 'lab.ffa'),
        feedMoisture: sampleText(day, 'raw_material', 'lab.moisture'),
        feedDobi: sampleText(day, 'raw_material', 'lab.dobi'),
        finishedOil: oil,
        finishedFfa: bandText(ffa),
        colour: red.length || yellow.length ? `R ${bandText(red) ?? '-'} · Y ${bandText(yellow) ?? '-'}` : null,
        toTank: tanks.join(', ') || null,
        byproductFfa: byFfa,
      }
    })
  })
}

export function historyFromDays(days, from, to, oil, parameter, stream) {
  return days
    .filter((day) => inSpan(day.productionDate, from, to))
    .map((day) => {
      const values = valuesOf(day, stream, parameter, oil)
      const span = band(values)
      if (!span) return null
      return { productionDate: day.productionDate, low: span.low, high: span.high, count: values.length }
    })
    .filter(Boolean)
}
