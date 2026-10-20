import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const here = path.dirname(fileURLToPath(import.meta.url))
const docs = path.resolve(here, '../../Docs')
const outFile = path.resolve(here, '../src/data/logsheets.json')

function sheetRows(file) {
  const workbook = XLSX.readFile(file, { cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })
}

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function blob(rows) {
  return rows.flat().map(text).filter(Boolean).join(' ')
}

function parseNumber(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  let raw = text(value)
  if (!raw || raw === '-' || raw === '—' || raw === '✓' || raw === '√') return null
  raw = raw.replace(/\s/g, '').replace(/\.$/, '')
  const commas = (raw.match(/,/g) || []).length
  const dots = (raw.match(/\./g) || []).length
  if (commas === 1 && dots >= 1) raw = raw.replace(/\./g, '').replace(',', '.')
  else if (commas === 1) raw = raw.replace(',', '.')
  else if (dots > 1) raw = raw.replace(/\./g, '')
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function canonicalTank(value) {
  const raw = text(value)
  const numbered = raw.match(/^t\.?\s*0*(\d+)\b/i)
  if (numbered) return `T${numbered[1].padStart(2, '0')}`
  return raw.toUpperCase()
}

function isoFromId(value) {
  const match = text(value).match(/(\d{2})-(\d{2})-(\d{4})/)
  if (!match) return null
  return `${match[3]}-${match[2]}-${match[1]}`
}

function latestIso(values) {
  return values.map(isoFromId).filter(Boolean).sort().at(-1) ?? null
}

function listFiles(dir) {
  return fs.readdirSync(dir).filter((name) => name.toLowerCase().endsWith('.xlsx')).map((name) => path.join(dir, name))
}

function parseSoundings() {
  const files = listFiles(path.join(docs, 'exports', 'storage-tank-sounding'))
    .map((file) => {
      const match = path.basename(file).match(/F-TNF-003_(\d{4}-\d{2}-\d{2})\.xlsx/i)
      return match ? { file, date: match[1] } : null
    })
    .filter((item) => item != null)
    .sort((a, b) => a.date.localeCompare(b.date))

  const soundings = []
  for (const [dayIndex, { file, date }] of files.entries()) {
    const rows = sheetRows(file)
    const headerAt = rows.findIndex((row) => row.some((cell) => /nama tangki/i.test(text(cell))))
    const byTank = new Map()
    for (const row of rows.slice(headerAt + 1)) {
      const tankId = canonicalTank(row[1])
      if (!tankId || /leader|sect|dokumen/i.test(text(row[0]))) continue
      if (!/^T\d+$/.test(tankId) && !/BAK /.test(tankId)) continue
      byTank.set(tankId, {
        roundIndex: dayIndex + 1,
        recordedOn: date,
        tankId,
        productName: text(row[2]),
        soundingLevelM: parseNumber(row[3]),
        temperatureC: parseNumber(row[4]),
        operationalStatus: text(row[5]).toUpperCase(),
      })
    }
    soundings.push(...byTank.values())
  }

  const first = files[0]?.date
  const last = files.at(-1)?.date
  const periodLabel = first && last ? `${first} – ${last}` : null
  return { periodLabel, soundings }
}

const LAB_CODES = [
  ['ffa', 'FFA', '%'],
  ['moisture', 'MI', '%'],
  ['lovibond color r', 'COLOR_R', ''],
  ['lovibond color y', 'COLOR_Y', ''],
  ['iv', 'IV', ''],
  ['pv', 'PV', ''],
  ['slip', 'SMP', '°C'],
  ['cloud', 'CP', '°C'],
  ['anv', 'ANV', ''],
  ['caroten', 'CAROTENE', ''],
  ['^p$', 'P', ''],
  ['dobi', 'DOBI', ''],
  ['totox', 'TOTOX', ''],
]

function columnCode(label) {
  const name = text(label).toLowerCase()
  if (!name || name === 'odor') return null
  const match = LAB_CODES.find(([pattern]) => new RegExp(pattern, 'i').test(name))
  return match ? { code: match[1], unit: match[2], label: text(label) } : null
}

const LAB_FIELDS = [
  ['FFA', 'FFA', 'ffa', '%'],
  ['MI', 'Moisture', 'moisture', '%'],
  ['COLOR_R', 'Lovibond Color R', 'colorR', ''],
  ['COLOR_Y', 'Lovibond Color Y', 'colorY', ''],
  ['IV', 'IV', 'iv', ''],
  ['PV', 'PV', 'pv', ''],
  ['SMP', 'Slip Melting Point', 'smp', '°C'],
  ['CP', 'Cloud Point', 'cloudPoint', '°C'],
  ['ANV', 'AnV', 'anv', ''],
  ['CAROTENE', 'β-Carotene', 'carotene', ''],
  ['P', 'P', 'phosphorus', ''],
  ['DOBI', 'DOBI', 'dobi', ''],
  ['TOTOX', 'Totox', 'totox', ''],
]

function parseLabs() {
  const labs = []
  for (const source of storageSources()) {
    const body = storageBody(source.file)
    if (!body) continue
    const snapshotOn = source.snapshotOn ?? body.snapshotOn
    for (const tank of body.tanks) {
      labs.push({
        tankId: tank.tankId,
        productName: tank.oil,
        analysisDate: tank.analysisDate,
        snapshotOn,
        temperatureC: tank.temperatureC,
        parameters: LAB_FIELDS.flatMap(([code, label, field, unit]) => {
          const value = tank[field]
          return value == null ? [] : [{ code, label, value, unit }]
        }),
      })
    }
  }
  return labs
}

function parseTrucks() {
  const file = listFiles(path.join(docs, 'QC Analyitical Result of Incoming Material By Truck'))[0]
  const rows = sheetRows(file)
  const preamble = blob(rows.slice(0, 8))
  const commodity = preamble.match(/Material\s*:\s*([A-Za-z0-9/+-]+)/)?.[1] ?? 'CPO'
  const trucks = []
  const seen = new Set()
  for (const row of rows) {
    if (!/^\d+$/.test(text(row[0]))) continue
    const name = text(row[2])
    if (!name) continue
    const sampledOn = /^\d{4}-\d{2}-\d{2}$/.test(text(row[1])) ? text(row[1]) : null
    const ffa = parseNumber(row[3])
    const moisture = parseNumber(row[4])
    const key = `${sampledOn}|${name.toUpperCase()}|${ffa}|${moisture}`
    if (seen.has(key)) continue
    seen.add(key)
    const remark = text(row[11])
    trucks.push({
      id: `truck-${trucks.length + 1}-${sampledOn}-${name}`.replace(/\s+/g, '-'),
      mode: 'truck',
      name,
      commodity,
      direction: 'inbound',
      targetLabel: remark || null,
      ffa,
      moisture,
      sampledOn,
      remark: remark || null,
      detailLines: [],
      sampleBreach: false,
    })
  }
  return trucks
}

function average(values) {
  const nums = values.filter((value) => value != null)
  if (nums.length === 0) return null
  return nums.reduce((sum, value) => sum + value, 0) / nums.length
}

function parseVessels() {
  const files = listFiles(path.join(docs, 'QC Analytical Result of Incoming Material by Vessel'))
  return files.map((file) => {
    const rows = sheetRows(file)
    const preamble = blob(rows.slice(0, 9))
    const ship = preamble.match(/Ship's Name\s*:\s*(.+?)(?:\s+Contract|$)/i)?.[1]?.trim() ?? path.basename(file)
    const commodity = preamble.match(/Material\s*:\s*([A-Za-z0-9/+-]+)/)?.[1] ?? 'CPO'
    const arrival = preamble.match(/Arrival\s*:\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null
    const ticket = preamble.match(/F\/QCO-\d+-\d+/)?.[0] ?? null
    const release = preamble.match(/Other\s*:\s*(.+)$/i)?.[1]?.trim() ?? null
    const bodyAt = rows.findIndex((row) => row.some((cell) => /palka s/i.test(text(cell))))
    const header = rows[bodyAt + 1] ?? []
    const groups = []
    header.forEach((cell, index) => {
      if (/^palka$/i.test(text(cell))) groups.push(index)
    })
    const samples = []
    for (const row of rows.slice(bodyAt + 2)) {
      if (/hasil analisa|komposit|qc shift|dokumen/i.test(blob([row]))) break
      for (const start of groups) {
        const ffa = parseNumber(row[start + 1])
        const moisture = parseNumber(row[start + 4])
        if (ffa == null && moisture == null) continue
        const palkaName = text(rows[bodyAt]?.[start] || 'Palka')
        samples.push({ palka: palkaName, ffa, moisture })
      }
    }
    const compositeAt = rows.findIndex((row) => row.some((cell) => /hasil analisa komposit/i.test(text(cell))))
    const composite = {}
    for (const row of rows.slice(compositeAt + 1, compositeAt + 16)) {
      const label = text(row[0]).toLowerCase()
      const value = parseNumber(row[1])
      if (label.startsWith('ffa')) composite.ffa = value
      if (label.startsWith('moisture')) composite.moisture = value
      if (label.startsWith('dobi')) composite.dobi = value
      if (label.startsWith('iv')) composite.iv = value
    }
    const byPalka = new Map()
    for (const sample of samples) {
      const bucket = byPalka.get(sample.palka) ?? []
      bucket.push(sample)
      byPalka.set(sample.palka, bucket)
    }
    const detailLines = [...byPalka.entries()].map(([palka, bucket]) => {
      const ffa = average(bucket.map((item) => item.ffa))
      const moisture = average(bucket.map((item) => item.moisture))
      return `${palka}: FFA ${ffa?.toFixed(3) ?? '—'}% · M&I ${moisture?.toFixed(3) ?? '—'}% · ${bucket.length} samples`
    })
    if (composite.ffa != null) detailLines.push(`Composite FFA ${composite.ffa}%`)
    if (composite.moisture != null) detailLines.push(`Composite moisture ${composite.moisture}%`)
    if (composite.dobi != null) detailLines.push(`Composite DOBI ${composite.dobi}`)
    const sampleBreach = samples.some((sample) => (sample.ffa != null && sample.ffa > 5) || (sample.moisture != null && sample.moisture > 0.5))
    return {
      id: ticket ?? `vessel-${ship}`,
      mode: 'vessel',
      name: ship,
      commodity,
      direction: 'inbound',
      targetLabel: release,
      ffa: composite.ffa ?? null,
      moisture: composite.moisture ?? null,
      sampledOn: arrival,
      remark: release,
      detailLines,
      sampleBreach,
    }
  })
}

function movementDirection(segelIn, segelOut) {
  const blank = (value) => {
    const raw = text(value).toLowerCase()
    return !raw || raw === 'empty' || raw === '-'
  }
  if (blank(segelIn) && !blank(segelOut)) return 'outbound'
  if (!blank(segelIn) && blank(segelOut)) return 'inbound'
  return 'unknown'
}

function parseMovements() {
  const files = [
    ...listFiles(path.join(docs, 'TF Storage and In-Out Report')).filter((item) => item.includes('TNF-004')),
    ...listFiles(path.join(docs, 'QC Moniotor Masuk dan Keluar Minyak (Komoditi)')),
  ]
  const seen = new Set()
  const movements = []
  for (const file of files) {
    const rows = sheetRows(file)
    const headerAt = rows.findIndex((row) => row.some((cell) => /nomor kendaraan/i.test(text(cell))))
    for (const row of rows.slice(headerAt + 2)) {
      const vehicle = text(row[0])
      if (!vehicle || /shift leader|sect|dokumen/i.test(vehicle)) continue
      const commodity = text(row[1]).toUpperCase().replace(/\s+/g, ' ').replace(/\bTOLING\b/g, 'TOLLING')
      if (!commodity) continue
      const key = [vehicle, commodity, text(row[2]), text(row[3]), text(row[4]), text(row[6]), text(row[8])].join('|').toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      movements.push({ commodity, direction: movementDirection(row[5], row[6]) })
    }
  }
  return movements
}

function blankToNull(value) {
  const raw = text(value)
  if (!raw || raw === '-' || raw === '—') return null
  return raw
}

function firstNumber(source, label) {
  const match = text(source).match(new RegExp(`${label}\\s*:\\s*([0-9]+(?:[.,][0-9]+)?)`, 'i'))
  return match ? parseNumber(match[1]) : null
}

function between(source, label, next) {
  const match = text(source).match(new RegExp(`${label}\\s*:\\s*(.+?)\\s+${next}\\s*:`, 'i'))
  return match ? match[1].trim() : null
}

function labNumber(value) {
  const parsed = parseNumber(value)
  if (parsed != null) return parsed
  const composite = text(value).match(/comp\s*=\s*([0-9]+(?:[.,][0-9]+)?)/i)
  return composite ? parseNumber(composite[1]) : null
}

function storageSources() {
  const legacy = listFiles(path.join(docs, 'QC Daily Storage Tank Analytical Result')).map((file) => ({
    file,
    snapshotOn: null,
  }))
  const exported = listFiles(path.join(docs, 'exports', 'daily-storage-tank-analytical'))
    .map((file) => {
      const match = path.basename(file).match(/^F-QCO-001_(\d{4}-\d{2}-\d{2})\.xlsx$/i)
      return match ? { file, snapshotOn: match[1] } : null
    })
    .filter((item) => item != null)
    .sort((left, right) => left.snapshotOn.localeCompare(right.snapshotOn))
  return [...legacy, ...exported]
}

function storageBody(file) {
  const rows = sheetRows(file)
  const headerAt = rows.findIndex((row) => row.some((cell) => /tank no/i.test(text(cell))))
  if (headerAt < 0) return null
  const header = rows[headerAt] ?? []
  const sub = rows[headerAt + 1] ?? []
  const columnAt = (row, pattern) => row.findIndex((cell) => pattern.test(text(cell)))
  const oilAt = columnAt(header, /oil type/i)
  const dateAt = columnAt(header, /analysis date/i)
  const capacityAt = columnAt(header, /kapasitas/i)
  const quantityAt = columnAt(header, /quantity/i)
  const emptyAt = columnAt(header, /empty space/i)
  const tempAt = columnAt(header, /suhu/i)
  const remarkAt = columnAt(header, /remark/i)
  const odorAt = columnAt(sub, /^odor$/i)
  const parameters = sub.map((cell, index) => ({ index, spec: columnCode(cell) })).filter((column) => column.spec)
  const valueOf = (row, code) => {
    const column = parameters.find((item) => item.spec.code === code)
    return column ? labNumber(row[column.index]) : null
  }
  const tanks = []
  const analysisDates = []
  for (const row of rows.slice(headerAt + 2)) {
    const tankId = canonicalTank(row[0])
    if (!/^T\d+$/.test(tankId)) continue
    const analysisDate = /^\d{4}-\d{2}-\d{2}$/.test(text(row[dateAt])) ? text(row[dateAt]) : null
    if (analysisDate) analysisDates.push(analysisDate)
    tanks.push({
      tankId,
      oil: text(row[oilAt]),
      analysisDate,
      capacity: capacityAt >= 0 ? parseNumber(row[capacityAt]) : null,
      quantity: quantityAt >= 0 ? parseNumber(row[quantityAt]) : null,
      emptySpace: emptyAt >= 0 ? parseNumber(row[emptyAt]) : null,
      temperatureC: tempAt >= 0 ? parseNumber(row[tempAt]) : null,
      ffa: valueOf(row, 'FFA'),
      moisture: valueOf(row, 'MI'),
      colorR: valueOf(row, 'COLOR_R'),
      colorY: valueOf(row, 'COLOR_Y'),
      iv: valueOf(row, 'IV'),
      pv: valueOf(row, 'PV'),
      smp: valueOf(row, 'SMP'),
      cloudPoint: valueOf(row, 'CP'),
      anv: valueOf(row, 'ANV'),
      carotene: valueOf(row, 'CAROTENE'),
      phosphorus: valueOf(row, 'P'),
      dobi: valueOf(row, 'DOBI'),
      totox: valueOf(row, 'TOTOX'),
      odor: odorAt >= 0 ? blankToNull(row[odorAt]) : null,
      remark: remarkAt >= 0 ? blankToNull(row[remarkAt]) : null,
    })
  }
  const signedOn = latestIso(rows.slice(-12).flat())
  const snapshotOn = signedOn ?? analysisDates.sort().at(-1) ?? null
  return { file, snapshotOn, maxAnalysis: analysisDates.sort().at(-1) ?? null, tanks }
}

function parseQcStorage() {
  const files = storageSources()
  const unique = []
  const seen = new Set()
  for (const source of files) {
    const body = storageBody(source.file)
    if (!body) continue
    if (source.snapshotOn) body.snapshotOn = source.snapshotOn
    const signature = JSON.stringify(body.tanks)
    if (seen.has(signature)) continue
    seen.add(signature)
    unique.push(body)
  }
  const byDate = new Map()
  for (const body of unique) {
    const key = body.snapshotOn ?? ''
    const list = byDate.get(key) ?? []
    list.push(body)
    byDate.set(key, list)
  }
  const rows = []
  for (const [snapshotOn, list] of byDate) {
    list.sort((left, right) => {
      const analysis = (left.maxAnalysis ?? '').localeCompare(right.maxAnalysis ?? '')
      if (analysis !== 0) return analysis
      return left.file.localeCompare(right.file)
    })
    list.forEach((body, index) => {
      for (const tank of body.tanks) {
        rows.push({
          ...tank,
          snapshotOn: snapshotOn || null,
          revision: index + 1,
        })
      }
    })
  }
  rows.sort((left, right) => {
    const date = (left.snapshotOn ?? '').localeCompare(right.snapshotOn ?? '')
    if (date !== 0) return date
    if (left.revision !== right.revision) return left.revision - right.revision
    return left.tankId.localeCompare(right.tankId, undefined, { numeric: true })
  })
  return rows
}

function compositeValue(rows) {
  const compositeAt = rows.findIndex((row) => row.some((cell) => /hasil analisa komposit/i.test(text(cell))))
  const composite = {
    ffa: null,
    iv: null,
    moisture: null,
    dobi: null,
    pv: null,
    anv: null,
    triene: null,
    totox: null,
    carotene: null,
    mineralOil: null,
  }
  if (compositeAt < 0) return composite
  const fields = [
    [/^ffa/, 'ffa'],
    [/^iv/, 'iv'],
    [/^moisture/, 'moisture'],
    [/^dobi/, 'dobi'],
    [/^pv/, 'pv'],
    [/^anv/, 'anv'],
    [/^trien/, 'triene'],
    [/^totox/, 'totox'],
    [/^caroten/, 'carotene'],
  ]
  for (const row of rows.slice(compositeAt + 1, compositeAt + 16)) {
    const label = text(row[0]).toLowerCase()
    if (/remark|qc shift|dokumen/i.test(label)) break
    if (/mineral oil/i.test(label)) {
      composite.mineralOil = blankToNull(row[1])
      continue
    }
    const field = fields.find(([pattern]) => pattern.test(label))
    if (field) composite[field[1]] = parseNumber(row[1])
  }
  return composite
}

function signOff(rows) {
  const at = rows.findIndex((row) => /qc shift leader/i.test(text(row[0])))
  if (at < 0) return { leader: null, leaderSigned: null, head: null, headSigned: null }
  const headAt = (rows[at] ?? []).findIndex((cell) => /qc head/i.test(text(cell)))
  const headCol = headAt >= 0 ? headAt : 8
  let leader = null
  let head = null
  let leaderSigned = null
  let headSigned = null
  for (const row of rows.slice(at + 1, at + 8)) {
    const left = text(row[0])
    const right = text(row[headCol])
    if (/dokumen|____/i.test(left)) break
    const dated = left.match(/(\d{2}-\d{2}-\d{4})/)
    if (dated) {
      leaderSigned = isoFromId(left)
      headSigned = isoFromId(right)
      break
    }
    if (left && !leader) {
      leader = left
      head = blankToNull(right)
    }
  }
  return { leader, leaderSigned, head, headSigned }
}

function parseQcVessels() {
  const files = listFiles(path.join(docs, 'QC Analytical Result of Incoming Material by Vessel'))
  return files.map((file) => {
    const rows = sheetRows(file)
    const preamble = blob(rows.slice(4, 8))
    const dobiMinMatch = preamble.match(/DOBI\s*:\s*([0-9]+(?:[.,][0-9]+)?)\s*min/i)
    const bodyAt = rows.findIndex((row) => row.some((cell) => /palka s/i.test(text(cell))))
    const header = rows[bodyAt + 1] ?? []
    const groups = []
    header.forEach((cell, index) => {
      if (/^palka$/i.test(text(cell))) groups.push(index)
    })
    const samples = []
    for (const row of rows.slice(bodyAt + 2)) {
      if (/hasil analisa|komposit|qc shift|dokumen|remarks/i.test(blob([row]))) break
      for (const start of groups) {
        const sampleNo = blankToNull(row[start])
        const ffa = parseNumber(row[start + 1])
        const iv = parseNumber(row[start + 2])
        const dobi = parseNumber(row[start + 3])
        const moisture = parseNumber(row[start + 4])
        if (ffa == null && iv == null && dobi == null && moisture == null) continue
        samples.push({
          palka: text(rows[bodyAt]?.[start] || 'Palka'),
          sampleNo,
          ffa,
          iv,
          dobi,
          moisture,
        })
      }
    }
    const release = preamble.match(/Other\s*:\s*(.+)$/i)?.[1]?.trim() ?? null
    return {
      id: preamble.match(/F\/QCO-\d+-\d+/)?.[0] ?? path.basename(file),
      ship: preamble.match(/Ship's Name\s*:\s*(.+?)(?:\s+Contract|$)/i)?.[1]?.trim() ?? null,
      supplier: blankToNull(between(preamble, 'Supplier', "Ship's Name")),
      commodity: preamble.match(/Material\s*:\s*([A-Za-z0-9/+-]+)/)?.[1] ?? 'CPO',
      arrival: preamble.match(/Arrival\s*:\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null,
      quantityLabel: between(preamble, 'Quantity', 'Supplier'),
      contractNo: blankToNull(between(preamble, 'Contract/\\s*D\\.O Nomor', 'FFA')),
      ffaMax: firstNumber(preamble, 'FFA'),
      moistureMax: firstNumber(preamble, 'M&I'),
      dobiMin: dobiMinMatch ? parseNumber(dobiMinMatch[1]) : null,
      release: blankToNull(release),
      samples,
      composite: compositeValue(rows),
      ...signOff(rows),
    }
  }).sort((left, right) => (left.arrival ?? '').localeCompare(right.arrival ?? ''))
}

function parseQcTrucks() {
  const file = listFiles(path.join(docs, 'QC Analyitical Result of Incoming Material By Truck'))[0]
  const rows = sheetRows(file)
  const preamble = blob(rows.slice(4, 7))
  const headerAt = rows.findIndex((row) => row.some((cell) => /police no/i.test(text(cell))))
  const sub = rows[headerAt + 1] ?? []
  const columnAt = (pattern) => sub.findIndex((cell) => pattern.test(text(cell)))
  const ffaAt = columnAt(/^ffa/i)
  const moistureAt = columnAt(/moisture/i)
  const ivAt = columnAt(/^iv/i)
  const dobiAt = columnAt(/^dobi/i)
  const pvAt = columnAt(/^pv/i)
  const colorRAt = columnAt(/colour r/i)
  const colorYAt = columnAt(/colour y/i)
  const header = rows[headerAt] ?? []
  const analystAt = header.findIndex((cell) => /analis/i.test(text(cell)))
  const remarkAt = header.findIndex((cell) => /remark/i.test(text(cell)))
  const trucks = []
  const seen = new Set()
  for (const row of rows.slice(headerAt + 2)) {
    if (!/^\d+$/.test(text(row[0]))) continue
    const policeNo = text(row[2])
    if (!policeNo) continue
    const sampledOn = /^\d{4}-\d{2}-\d{2}$/.test(text(row[1])) ? text(row[1]) : null
    const ffa = ffaAt >= 0 ? parseNumber(row[ffaAt]) : null
    const moisture = moistureAt >= 0 ? parseNumber(row[moistureAt]) : null
    const key = `${sampledOn}|${policeNo.toUpperCase()}|${ffa}|${moisture}`
    if (seen.has(key)) continue
    seen.add(key)
    trucks.push({
      sampleNo: text(row[0]),
      sampledOn,
      policeNo,
      ffa,
      moisture,
      iv: ivAt >= 0 ? parseNumber(row[ivAt]) : null,
      dobi: dobiAt >= 0 ? parseNumber(row[dobiAt]) : null,
      pv: pvAt >= 0 ? parseNumber(row[pvAt]) : null,
      colorR: colorRAt >= 0 ? parseNumber(row[colorRAt]) : null,
      colorY: colorYAt >= 0 ? parseNumber(row[colorYAt]) : null,
      analyst: analystAt >= 0 ? blankToNull(row[analystAt]) : null,
      remark: remarkAt >= 0 ? blankToNull(row[remarkAt]) : null,
    })
  }
  return {
    supplier: blankToNull(between(preamble, 'Supplier', 'Material')),
    material: preamble.match(/Material\s*:\s*([A-Za-z0-9/+-]+)/)?.[1] ?? 'CPO',
    vessel: between(preamble, 'Vessel', 'Arrival Date'),
    arrival: preamble.match(/Arrival Date\s*:\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null,
    contractNo: blankToNull(between(preamble, 'Contract\\s*/\\s*DO', 'FFA')),
    ffaMax: firstNumber(preamble, 'FFA'),
    moistureMax: firstNumber(preamble, 'M&I'),
    rows: trucks,
  }
}

function parseQcMovements() {
  const qcDir = path.join(docs, 'QC Moniotor Masuk dan Keluar Minyak (Komoditi)')
  const files = [
    ...listFiles(qcDir),
    ...listFiles(path.join(docs, 'TF Storage and In-Out Report')).filter((item) => item.includes('TNF-004')),
  ]
  const seen = new Set()
  const rowsOut = []
  let periodStart = null
  let periodEnd = null
  for (const file of files) {
    const rows = sheetRows(file)
    if (!periodStart) {
      const period = blob(rows.slice(0, 6)).match(/(\d{2}-\d{2}-\d{4})\s*s\/d\s*(\d{2}-\d{2}-\d{4})/)
      if (period) {
        periodStart = isoFromId(period[1])
        periodEnd = isoFromId(period[2])
      }
    }
    const headerAt = rows.findIndex((row) => row.some((cell) => /nomor kendaraan/i.test(text(cell))))
    for (const row of rows.slice(headerAt + 2)) {
      const vehicle = text(row[0])
      if (!vehicle || /shift leader|sect|dokumen/i.test(vehicle)) continue
      const commodity = text(row[1])
      if (!commodity) continue
      const record = {
        vehicle,
        commodity,
        timeIn: blankToNull(row[2]),
        timeOut: blankToNull(row[3]),
        customer: blankToNull(row[4]),
        sealIn: blankToNull(row[5]),
        sealOut: blankToNull(row[6]),
        operator: blankToNull(row[7]),
        remark: blankToNull(row[8]),
      }
      const key = Object.values(record).join('|').toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      rowsOut.push(record)
    }
  }
  return { periodStart, periodEnd, rows: rowsOut }
}

const sounding = parseSoundings()
const labs = parseLabs()
const logistics = [...parseVessels(), ...parseTrucks()]
const movements = parseMovements()
const payload = {
  periodLabel: sounding.periodLabel,
  soundings: sounding.soundings,
  labs,
  logistics,
  movements,
}
fs.writeFileSync(outFile, JSON.stringify(payload))
const qcFile = path.resolve(here, '../src/data/qc.json')
const qcPayload = {
  storage: parseQcStorage(),
  vessels: parseQcVessels(),
  trucks: parseQcTrucks(),
  movements: parseQcMovements(),
}
fs.writeFileSync(qcFile, JSON.stringify(qcPayload))
const rounds = new Set(payload.soundings.map((row) => row.roundIndex))
console.log(JSON.stringify({
  file: outFile,
  bytes: fs.statSync(outFile).size,
  rounds: rounds.size,
  soundings: payload.soundings.length,
  labs: payload.labs.length,
  logistics: payload.logistics.length,
  vessels: payload.logistics.filter((row) => row.mode === 'vessel').map((row) => row.name),
  trucks: payload.logistics.filter((row) => row.mode === 'truck').length,
  rejected: payload.logistics.filter((row) => row.ffa != null && row.ffa > 5).map((row) => `${row.name} ${row.ffa}`),
  movements: payload.movements.length,
  periodLabel: payload.periodLabel,
  qc: {
    file: qcFile,
    bytes: fs.statSync(qcFile).size,
    storage: qcPayload.storage.length,
    snapshots: [...new Set(qcPayload.storage.map((row) => `${row.snapshotOn}#${row.revision}`))],
    vessels: qcPayload.vessels.map((row) => `${row.id} ${row.ship} mi ${row.moistureMax} samples ${row.samples.length}`),
    trucks: qcPayload.trucks.rows.length,
    truckLimits: [qcPayload.trucks.ffaMax, qcPayload.trucks.moistureMax, qcPayload.trucks.vessel],
    gate: [qcPayload.movements.periodStart, qcPayload.movements.periodEnd, qcPayload.movements.rows.length],
  },
}, null, 2))
