import XLSX from 'xlsx'

const PLANTS = {
  'Refinery 150 MTD': { code: 'refinery150', name: 'Refinery 150' },
  'Refinery 500 MTD': { code: 'refinery500', name: 'Refinery 500' },
}

const RAW = [
  ['lab.ffa', 4],
  ['lab.moisture', 5],
  ['lab.dobi', 6],
  ['lab.iv', 7],
  ['lab.pv', 8],
  ['lab.av', 9],
  ['lab.totox', 10],
  ['lab.color_r', 11],
  ['lab.color_y', 12],
  ['lab.color_b', 13],
]
const BLEACH = [
  ['lab.color_r', 14],
  ['lab.color_y', 15],
  ['lab.color_wb', 16],
]
const FINISHED = [
  ['lab.ffa', 19],
  ['lab.moisture', 20],
  ['lab.iv', 21],
  ['lab.pv', 22],
  ['lab.color_r', 23],
  ['lab.color_y', 24],
  ['lab.color_wb', 25],
]
const BYPRODUCT = [
  ['lab.ffa', 29],
  ['lab.moisture', 30],
]
const EARTH = [
  ['lab.moisture', 32],
  ['lab.oc', 33],
]

function cell(row, index) {
  const text = String(row[index] ?? '').trim()
  if (!text || text === '-') return ''
  return text
}

function number(row, index) {
  const text = cell(row, index)
  if (!text) return null
  const value = Number(text.replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

function parameters(row, pairs) {
  const result = {}
  for (const [code, index] of pairs) {
    const value = number(row, index)
    if (value != null) result[code] = value
  }
  return result
}

function stream(commodity, destination, params, remark) {
  const filled = commodity || destination || remark || Object.keys(params).length > 0
  if (!filled) return null
  return {
    commodity: commodity || null,
    destination: destination || null,
    remark: remark || null,
    parameters: params,
  }
}

export function parseRefineryWorkbook(bytes, expectedDay) {
  const workbook = XLSX.read(bytes, { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: false, defval: '' })
  const banner = rows.map((row) => String(row[0] ?? '')).find((line) => /Date of Report/.test(line)) ?? ''
  const plantLine = rows.map((row) => String(row[0] ?? '')).find((line) => /^Plant\s*:/.test(line)) ?? ''
  const productionDate = banner.match(/Date of Production\s*:\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null
  const reportDate = banner.match(/Date of Report\s*:\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null
  const declaredOils = banner.match(/Oil Type\s*:\s*(.+)$/)?.[1]?.trim() ?? ''
  const plantText = plantLine.replace(/^Plant\s*:\s*/, '').trim()
  const plant = PLANTS[plantText]
  if (!plant) return { skipped: true, reason: `unmapped plant: ${plantText}` }
  if (!productionDate || productionDate !== expectedDay) return { skipped: true, reason: 'production date mismatch' }
  const headerAt = rows.findIndex((row) => String(row[0] ?? '').trim() === 'Time')
  const data = rows.slice(headerAt + 2).filter((row) => /^\d{1,2}:\d{2}/.test(String(row[0] ?? '').trim()))
  const readings = data.map((row, index) => {
    const breakText = cell(row, 17)
    const bleachParams = parameters(row, BLEACH)
    if (breakText) bleachParams['lab.break_test'] = breakText
    return {
      rowIndex: index,
      time: String(row[0]).trim(),
      fromTank: cell(row, 1) || null,
      flowRate: number(row, 2),
      remark: cell(row, 34) || null,
      streams: {
        raw_material: stream(cell(row, 3), '', parameters(row, RAW), ''),
        bleaching_oil: stream('', '', bleachParams, ''),
        finished_good: stream(cell(row, 18), cell(row, 26), parameters(row, FINISHED), cell(row, 27)),
        by_product: stream(cell(row, 28), cell(row, 31), parameters(row, BYPRODUCT), ''),
        spent_earth: stream('', '', parameters(row, EARTH), ''),
      },
    }
  })
  if (readings.length === 0) return { skipped: true, reason: 'no readings' }
  return {
    productionDate,
    reportDate,
    processUnit: plant.code,
    processUnitName: plant.name,
    declaredOils,
    readings,
  }
}
