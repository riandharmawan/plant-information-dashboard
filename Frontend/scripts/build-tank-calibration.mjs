import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const here = path.dirname(fileURLToPath(import.meta.url))
const docs = path.resolve(here, '../../Docs')
const outFile = path.resolve(here, '../src/data/tankCalibration.json')

const soundingFile = path.join(docs, 'HITUNGAN SOUNDING PH.xlsx')
const stockFile = path.join(docs, 'Stock Tanki Oktober 2026.xlsx')

const DENSITY_GROUPS = {
  A: { id: 'cpo', tempCol: 'A', densityCol: 'B', startRow: 12 },
  K: { id: 'rpo', tempCol: 'K', densityCol: 'M', startRow: 11 },
  Q: { id: 'olein', tempCol: 'Q', densityCol: 'S', startRow: 11 },
  W: { id: 'rps', tempCol: 'W', densityCol: 'Y', startRow: 11 },
  AI: { id: 'pfad', tempCol: 'AI', densityCol: 'AK', startRow: 11 },
}

function colIndex(letter) {
  return XLSX.utils.decode_col(letter)
}

function cell(sheet, row, col) {
  return sheet[XLSX.utils.encode_cell({ r: row - 1, c: col })]
}

function numberAt(sheet, row, col) {
  const value = cell(sheet, row, col)?.v
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function columnValues(sheet, letter, startRow, endRow) {
  const col = colIndex(letter)
  const values = []
  for (let row = startRow; row <= endRow; row += 1) {
    values.push(numberAt(sheet, row, col))
  }
  return values
}

function canonicalTank(value) {
  const match = String(value ?? '').match(/t\.?\s*0*(\d+)/i)
  if (!match) return null
  return `T${match[1].padStart(2, '0')}`
}

function parseVolumeFormula(formula) {
  if (!formula) return null
  const match = formula.match(/Tabel Tank'!\$?([A-Z]+)\$?(\d*):\$?([A-Z]+)\$?(\d*)\s*,\s*2(?:\s*,\s*(FALSE|TRUE))?/i)
  if (!match) return null
  return {
    heightCol: match[1],
    startRow: match[2] ? Number(match[2]) : 1,
    volumeCol: match[3],
    endRow: match[4] ? Number(match[4]) : null,
    approximate: match[5] ? match[5].toUpperCase() !== 'FALSE' : !/FALSE/i.test(formula),
  }
}

function parseRingFormula(formula) {
  if (!formula) return null
  const index = formula.match(/INDEX\('[^']*Tabel Tank'!\$?([A-Z]+)\$(\d+):\$?[A-Z]+\$(\d+)/i)
  const band = formula.match(/SUMPRODUCT\(\(.*?>='[^']*Tabel Tank'!\$?([A-Z]+)\$(\d+):\$?[A-Z]+\$(\d+)\).*?<=.*?Tabel Tank'!\$?([A-Z]+)\$(\d+)/i)
  const anchor = formula.match(/-ROW\('[^']*Tabel Tank'!\$?[A-Z]+\$(\d+)\)/i)
  if (!index || !band || !anchor) return null
  return {
    volumeCol: index[1],
    volumeStart: Number(index[2]),
    volumeEnd: Number(index[3]),
    lowCol: band[1],
    lowStart: Number(band[2]),
    lowEnd: Number(band[3]),
    highCol: band[4],
    highStart: Number(band[5]),
    anchorRow: Number(anchor[1]),
  }
}

function parseUllage(formula) {
  const lk = formula?.match(/k lk",\s*(\d+)\s*-/i)
  const lb = formula?.match(/k lb",\s*(\d+)\s*-/i)
  return {
    ullageLkMm: lk ? Number(lk[1]) : null,
    ullageLbMm: lb ? Number(lb[1]) : null,
  }
}

function densityGroupOf(formula) {
  const match = formula?.match(/DENSITY!\$([A-Z]+)\$/i)
  if (!match) return null
  return DENSITY_GROUPS[match[1].toUpperCase()]?.id ?? null
}

function readDensity(sheet) {
  const density = {}
  for (const group of Object.values(DENSITY_GROUPS)) {
    const tempCol = colIndex(group.tempCol)
    const densityCol = colIndex(group.densityCol)
    const pairs = []
    for (let row = group.startRow; row <= 120; row += 1) {
      const temp = numberAt(sheet, row, tempCol)
      const value = numberAt(sheet, row, densityCol)
      if (temp == null || value == null) continue
      pairs.push([temp, value])
    }
    density[group.id] = pairs
  }
  return density
}

function readCapacities(workbook) {
  const sheet = workbook.Sheets['13 OKTOBER 2026']
  const capacities = new Map()
  const range = XLSX.utils.decode_range(sheet['!ref'])
  for (let row = 1; row <= range.e.r + 1; row += 1) {
    const tankId = canonicalTank(cell(sheet, row, 0)?.v)
    const label = String(cell(sheet, row, 0)?.v ?? '')
    if (!tankId || /total/i.test(label)) continue
    const capacityKg = numberAt(sheet, row, 4)
    const bottomStockKg = numberAt(sheet, row, 9)
    if (capacityKg == null) continue
    capacities.set(tankId, { capacityKg, bottomStockKg: bottomStockKg ?? 0 })
  }
  return capacities
}

function readVolume(sheet, spec) {
  const endRow = spec.endRow ?? XLSX.utils.decode_range(sheet['!ref']).e.r + 1
  const heightCol = colIndex(spec.heightCol)
  const volumeCol = colIndex(spec.volumeCol)
  const pairs = []
  for (let row = spec.startRow; row <= endRow; row += 1) {
    const height = numberAt(sheet, row, heightCol)
    const liters = numberAt(sheet, row, volumeCol)
    if (height == null || liters == null) continue
    pairs.push([Math.round(height * 1000) / 1000, liters])
  }
  return pairs
}

function buildTanks(soundingWb, capacities) {
  const daily = soundingWb.Sheets['13 Oktober 2026']
  const table = soundingWb.Sheets['Tabel Tank']
  const tanks = []
  for (let row = 4; row <= 27; row += 1) {
    const tankId = canonicalTank(cell(daily, row, 0)?.v)
    if (!tankId) continue
    const iFormula = cell(daily, row, 8)?.f ?? ''
    const lFormula = cell(daily, row, 11)?.f ?? ''
    const nFormula = cell(daily, row, 13)?.f ?? ''
    const pFormula = cell(daily, row, 15)?.f ?? ''
    const ullage = parseUllage(iFormula)
    const volumeSpec = parseVolumeFormula(lFormula)
    const ringSpec = parseRingFormula(nFormula)
    const stock = capacities.get(tankId)
    const tank = {
      tankId,
      capacityKg: stock?.capacityKg ?? null,
      bottomStockKg: stock?.bottomStockKg ?? null,
      dipOffsetMm: numberAt(daily, row, 7) ?? 0,
      tableTempC: numberAt(daily, row, 6),
      ullageLkMm: ullage.ullageLkMm,
      ullageLbMm: ullage.ullageLbMm,
      densityGroup: densityGroupOf(pFormula),
      volumeApprox: false,
      volume: [],
      ringVolumes: [],
      ringBands: [],
    }
    if (volumeSpec) {
      tank.volumeApprox = volumeSpec.approximate
      tank.volume = readVolume(table, volumeSpec)
    }
    if (ringSpec) {
      tank.ringVolumes = columnValues(table, ringSpec.volumeCol, ringSpec.volumeStart, ringSpec.volumeEnd)
      const highCol = colIndex(ringSpec.highCol)
      const lowCol = colIndex(ringSpec.lowCol)
      for (let bandRow = ringSpec.lowStart; bandRow <= ringSpec.lowEnd; bandRow += 1) {
        const low = numberAt(table, bandRow, lowCol)
        const high = numberAt(table, bandRow + (ringSpec.highStart - ringSpec.lowStart), highCol)
        if (low == null || high == null) continue
        tank.ringBands.push([low, high, bandRow - ringSpec.anchorRow])
      }
    }
    tanks.push(tank)
  }
  return tanks
}

function trunc2(value) {
  return Math.trunc(value * 100) / 100
}

function lookupVolume(pairs, key, approximate) {
  const roundedKey = Math.round(key * 100) / 100
  if (!approximate) {
    const hit = pairs.find(([height]) => Math.abs(height - roundedKey) < 0.0005)
    return hit ? hit[1] : null
  }
  let best = null
  for (const [height, liters] of pairs) {
    if (height <= roundedKey + 0.0005 && (best == null || height > best[0])) best = [height, liters]
  }
  return best ? best[1] : null
}

function lookupDensity(table, tempC) {
  const hit = table.find(([temp]) => temp === tempC)
  return hit ? hit[1] : null
}

export function quantityKg(profile, density, levelM, tempC, method) {
  const normalized = String(method ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (normalized === 'empty') return 0
  if (levelM == null || tempC == null || profile.tableTempC == null || !profile.densityGroup) return null
  if (profile.volume.length === 0) return null
  const soundingMm = Math.round(levelM * 1000)
  let totalMm = null
  if (normalized === 'isi lk' || normalized === 'isi lkr') totalMm = soundingMm + profile.dipOffsetMm
  else if (normalized === 'isi lb') totalMm = soundingMm
  else if (normalized === 'k lk' && profile.ullageLkMm != null) totalMm = profile.ullageLkMm - soundingMm
  else if (normalized === 'k lb' && profile.ullageLbMm != null) totalMm = profile.ullageLbMm - soundingMm
  else return null
  const tableKey = trunc2(totalMm / 1000)
  const tableLiters = lookupVolume(profile.volume, tableKey, profile.volumeApprox)
  if (tableLiters == null) return null
  const roundedMm = Math.round(totalMm)
  const digit = Math.abs(roundedMm) % 10
  let ring = 0
  if (digit !== 0 && profile.ringVolumes.length > 0) {
    let offset = 0
    for (const [low, high, bandOffset] of profile.ringBands) {
      if (roundedMm >= low && roundedMm <= high) offset += bandOffset
    }
    const index = offset * 10 + digit
    ring = index >= 1 && index <= profile.ringVolumes.length ? (profile.ringVolumes[index - 1] ?? 0) : 0
  }
  const densityValue = lookupDensity(density[profile.densityGroup] ?? [], tempC)
  if (densityValue == null) return null
  const liters = tableLiters + ring
  const factor = 1 + 0.0000348 * (tempC - profile.tableTempC)
  return Math.round(liters * densityValue * factor)
}

function verify(soundingWb, tanks, density) {
  const daily = soundingWb.Sheets['13 Oktober 2026']
  const byId = new Map(tanks.map((tank) => [tank.tankId, tank]))
  const lines = []
  for (let row = 4; row <= 27; row += 1) {
    const tankId = canonicalTank(cell(daily, row, 0)?.v)
    if (!tankId) continue
    const profile = byId.get(tankId)
    const expected = numberAt(daily, row, 20)
    const computed = quantityKg(profile, density, numberAt(daily, row, 3), numberAt(daily, row, 5), cell(daily, row, 2)?.v)
    const delta = expected == null || computed == null ? null : computed - expected
    lines.push(`${tankId} expected ${expected} computed ${computed} delta ${delta}`)
  }
  return lines
}

const soundingWb = XLSX.readFile(soundingFile, { cellFormula: true })
const stockWb = XLSX.readFile(stockFile, { cellFormula: true })
const density = readDensity(soundingWb.Sheets.DENSITY)
const tanks = buildTanks(soundingWb, readCapacities(stockWb))
const payload = { coefficient: 0.0000348, density, tanks }
fs.writeFileSync(outFile, JSON.stringify(payload))
console.log(`wrote ${tanks.length} tanks to ${outFile} (${fs.statSync(outFile).size} bytes)`)
for (const line of verify(soundingWb, tanks, density)) console.log(line)
