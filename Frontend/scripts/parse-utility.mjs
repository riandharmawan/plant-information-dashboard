import path from 'node:path'
import XLSX from 'xlsx'

export const utilityForms = [
  { id: '2877806f-02dc-4332-8a18-1d515c531001', formCode: 'F/UTI-001', name: 'Operational Boiler Daily Report Taihu 15 TPH', assetCode: 'taihu-15tph', kind: 'hourly' },
  { id: 'f9db0b0c-6518-4ca7-80dc-f5763521857f', formCode: 'F/UTI-002', name: 'Operational Boiler Taihu 15 t/h Daily Report (Local)', assetCode: 'taihu-15tph', kind: 'hourly' },
  { id: '3538d238-442b-4add-9f9d-ce14aae06ba8', formCode: 'utility-wuxi-15tph', name: 'Operational Boiler Daily Report Wuxi 15 TPH', assetCode: 'wuxi-15tph', kind: 'hourly' },
  { id: '0a1b0c28-1780-43d9-8c79-46b9ce2a82b1', formCode: 'F/UTI-004', name: 'Form Pemakaian Bahan Bakar Taihu', assetCode: 'taihu-15tph', kind: 'fuel' },
  { id: '232ca732-aae1-49e9-937e-80d3d0f156bd', formCode: 'F/UTI-005', name: 'Logbook Pemakaian Chemical Boiler', assetCode: 'taihu-15tph', kind: 'chemical' },
  { id: 'cc2e0682-4681-4ef9-a13d-3a51dd786c86', formCode: 'utility-meter-listrik', name: 'Monitoring Display Meter Listrik', assetCode: null, kind: 'none' },
  { id: '1d5bb87a-74f1-41a5-b692-ad210107a0d6', formCode: 'F/UTI-010', name: 'Logsheet Batu Bara', assetCode: 'taihu-15tph', kind: 'coal' },
  { id: '8faf8a0f-7938-405b-8caf-c6cb3763c247', formCode: 'F/UTI-011(a)', name: 'Wheel loader checklist', assetCode: 'wheel-loader', kind: 'checks' },
  { id: 'f49949cb-4e6d-4958-a7df-9c40e89b90fd', formCode: 'F/UTI-011(b)', name: 'Wheel loader fuel and hour meter', assetCode: 'wheel-loader', kind: 'loader' },
  { id: '834ce78e-3eed-4f3b-bef4-af84dc50728e', formCode: 'F/UTI-012', name: 'Laporan Analisa Air Boiler', assetCode: null, kind: 'lab' },
  { id: '767e5297-f861-4a65-ab27-cbb0d07f8253', formCode: 'F/WTP-001', name: 'Laporan Analisa Air WTP & WWTP', assetCode: null, kind: 'lab' },
  { id: '305c8641-93d0-4c55-9d71-28ee9d7eeee3', formCode: 'F/WTP-006', name: 'Realization & Verification Cleaning RO', assetCode: null, kind: 'job' },
  { id: '0826ff96-b12d-42db-ad59-93bea313e4da', formCode: 'F/WWTP-001', name: 'WWTP Operational', assetCode: 'wwtp', kind: 'sections' },
]

const formById = new Map(utilityForms.map((form) => [form.id, form]))

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function cellText(value) {
  const raw = text(value)
  if (!raw || raw === '-' || raw === '—' || raw === '–') return null
  return raw
}

function parseNumber(raw) {
  let source = String(raw ?? '').trim()
  if (!source) return null
  const hasComma = source.includes(',')
  const hasDot = source.includes('.')
  if (hasComma && hasDot) source = source.replace(/\./g, '').replace(',', '.')
  else if (hasComma) source = source.replace(',', '.')
  else if (hasDot) {
    const match = source.match(/^(-?\d+)\.(\d+)$/)
    if (match && match[2].length === 3) source = match[1] + match[2]
  }
  if (!/^-?\d+(\.\d+)?$/.test(source)) return null
  const parsed = Number(source)
  return Number.isFinite(parsed) ? parsed : null
}

function readingValue(value) {
  const raw = cellText(value)
  if (!raw) return null
  if (/^(yes|v|x)$/i.test(raw) || raw.includes('/')) {
    return { numericValue: null, textValue: raw, unit: null }
  }
  const suffixed = raw.match(/^(-?\d[\d.,]*)(?:\s+|(?=%|jam|jm))(.+)$/i)
  const numberPart = suffixed ? suffixed[1] : raw
  const unit = suffixed && /[A-Za-z%°]/.test(suffixed[2]) ? suffixed[2] : null
  const numeric = parseNumber(numberPart)
  if (numeric != null) return { numericValue: numeric, textValue: null, unit }
  return { numericValue: null, textValue: raw, unit: null }
}

function sheetRows(file) {
  const workbook = XLSX.readFile(file, { cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })
}

function bannerFields(rows) {
  const line = rows.map((row) => row.map(text).filter(Boolean).join(' ')).find((item) => /Place\s*:|Shift\s*:/i.test(item)) ?? ''
  const place = line.match(/Place\s*:\s*(.*?)\s*(?:Shift\s*:|Date\s*:|$)/i)?.[1]?.trim()
  const shift = line.match(/Shift\s*:\s*(.*?)\s*(?:Date\s*:|$)/i)?.[1]?.trim()
  const clean = (value) => (!value || value === '-' ? null : value)
  return { placeText: clean(place), shiftBanner: clean(shift) }
}

function isStop(value) {
  return /^1\.\s/.test(value) || /^dokumen ini/i.test(value)
}

function pushReading(readings, fields) {
  const value = fields.value
  const remark = cellText(fields.remark)
  if (!value && !remark) return
  if (!fields.tagText && !value && !remark) return
  readings.push({
    rowIndex: readings.length,
    observedTime: fields.observedTime ?? null,
    shiftText: fields.shiftText ?? null,
    groupText: fields.groupText ?? null,
    tagText: fields.tagText ?? null,
    numericValue: value?.numericValue ?? null,
    textValue: value?.textValue ?? null,
    unit: value?.unit ?? null,
    remark,
  })
}

function parseHourly(rows) {
  const headerAt = rows.findIndex((row) => row.some((cell) => /tag description|description/i.test(text(cell)) && /result/i.test(row.map(text).join(' '))))
  const readings = []
  if (headerAt < 0) return readings
  const groups = []
  let group = null
  const groupRow = rows[headerAt - 1] ?? []
  const header = rows[headerAt]
  for (let column = 1; column < header.length; column += 3) {
    if (!/description/i.test(text(header[column]))) continue
    const named = text(groupRow[column])
    if (named && !/^time$/i.test(named)) group = named
    groups.push({ column, group })
  }
  let observedTime = null
  for (const row of rows.slice(headerAt + 1)) {
    const label = text(row[0])
    if (isStop(label)) break
    if (/no data available/i.test(label)) continue
    if (/^\d{1,2}:\d{2}$/.test(label)) observedTime = label
    if (!observedTime) continue
    for (const item of groups) {
      const tag = cellText(row[item.column])
      const value = readingValue(row[item.column + 1])
      const remark = row[item.column + 2]
      if (!tag && !value && !cellText(remark)) continue
      pushReading(readings, { observedTime, groupText: item.group, tagText: tag, value, remark })
    }
  }
  return readings
}

function parseFuel(rows) {
  const headerAt = rows.findIndex((row) => /^jam$/i.test(text(row[0])) && /batu bara/i.test(text(row[1])))
  const readings = []
  if (headerAt < 0) return readings
  const tags = ['Batu Bara', 'Steam', 'Speed', 'Flori']
  for (const row of rows.slice(headerAt + 1)) {
    const label = text(row[0])
    if (isStop(label) || /^jam$/i.test(label)) continue
    if (!/^\d{1,2}:\d{2}$/.test(label)) continue
    tags.forEach((tag, index) => {
      const value = readingValue(row[index + 1])
      if (!value) return
      pushReading(readings, { observedTime: label, tagText: tag, value, remark: row[5] })
    })
  }
  return readings
}

function parseChemical(rows) {
  const materials = []
  let group = null
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const label = text(row[0])
    if (isStop(label)) break
    if (/^jenis chemical/i.test(label)) continue
    const next = text(rows[index + 1]?.[0])
    if (/^jenis chemical/i.test(next)) {
      group = cellText(label)
      continue
    }
    if (!group || !cellText(label)) continue
    const received = parseNumber(cellText(row[2]) ?? '')
    const used = parseNumber(cellText(row[3]) ?? '')
    const remaining = parseNumber(cellText(row[4]) ?? '')
    const lot = cellText(row[1])
    const operator = cellText(row[5])
    const remark = cellText(row[6])
    if (received == null && used == null && remaining == null && !lot && !operator && !remark) continue
    materials.push({
      rowIndex: materials.length,
      groupText: group,
      materialText: cellText(label),
      lot,
      receivedQty: received,
      usedQty: used,
      remainingQty: remaining,
      operator,
      remark,
    })
  }
  return materials
}

function parseCoal(rows) {
  const headerAt = rows.findIndex((row) => /^shift$/i.test(text(row[0])) && row.some((cell) => /bucket|kg/i.test(text(cell))))
  const readings = []
  if (headerAt < 1) return readings
  const groups = []
  let group = null
  for (let column = 1; column < rows[headerAt].length; column += 1) {
    const named = text(rows[headerAt - 1][column])
    if (named) group = named
    groups[column] = group
  }
  for (const row of rows.slice(headerAt + 1)) {
    const shift = cellText(row[0])
    if (!shift || isStop(shift) || /^shift$/i.test(shift)) continue
    if (!/^shift\b/i.test(shift)) break
    for (let column = 1; column < row.length; column += 1) {
      const tag = cellText(rows[headerAt][column]) || groups[column]
      pushReading(readings, {
        shiftText: shift,
        groupText: groups[column],
        tagText: tag,
        value: readingValue(row[column]),
      })
    }
  }
  return readings
}

function markResult(yesCell, noCell) {
  const yes = text(yesCell)
  const no = text(noCell)
  const checked = (value) => /✓|√|✔/.test(value)
  if (checked(yes)) return 'yes'
  if (checked(no)) return 'no'
  return null
}

function parseChecks(rows) {
  const headerAt = rows.findIndex((row) => /deskripsi/i.test(text(row[0])) && /^yes$/i.test(text(row[1])))
  const checks = []
  if (headerAt < 0) return checks
  for (const row of rows.slice(headerAt + 1)) {
    const item = cellText(row[0])
    if (!item || isStop(item)) break
    const result = markResult(row[1], row[2])
    if (!result) continue
    checks.push({ rowIndex: checks.length, itemText: item, result })
  }
  return checks
}

function parseLoader(rows) {
  const headerAt = rows.findIndex((row) => /^shift$/i.test(text(row[0])) && /hour meter|solar/i.test(row.map(text).join(' ')))
  const runs = []
  if (headerAt < 0) return runs
  for (const row of rows.slice(headerAt + 1)) {
    const shift = cellText(row[0])
    if (isStop(shift ?? '')) break
    if (!shift || /^awal$|^akhir$/i.test(text(row[1])) || /^shift$/i.test(shift)) continue
    if (!/^shift\b/i.test(shift)) continue
    runs.push({
      rowIndex: runs.length,
      shiftText: shift,
      hourStart: parseNumber(cellText(row[1]) ?? ''),
      hourEnd: parseNumber(cellText(row[2]) ?? ''),
      hoursTotal: parseNumber(cellText(row[3]) ?? ''),
      fuelLiters: parseNumber(cellText(row[4]) ?? ''),
      oilLiters: parseNumber(cellText(row[5]) ?? ''),
      remark: cellText(row[6]),
    })
  }
  return runs
}

function parseLab(rows) {
  const headerAt = rows.findIndex((row) => row.some((cell) => /jenis analisa/i.test(text(cell))))
  const readings = []
  if (headerAt < 1) return readings
  const header = rows[headerAt]
  const groupRow = rows[headerAt - 1]
  const blocks = []
  for (let column = 0; column < header.length; column += 4) {
    if (!/jenis analisa/i.test(text(header[column + 1]))) continue
    blocks.push({ column, group: cellText(groupRow[column]) })
  }
  const lastShift = new Map()
  for (const row of rows.slice(headerAt + 1)) {
    if (isStop(text(row[0]))) break
    for (const block of blocks) {
      const shift = cellText(row[block.column]) || lastShift.get(block.column) || null
      if (cellText(row[block.column])) lastShift.set(block.column, shift)
      const tag = cellText(row[block.column + 1])
      if (!tag || /^jenis analisa/i.test(tag)) continue
      pushReading(readings, {
        shiftText: shift,
        groupText: block.group,
        tagText: tag,
        value: readingValue(row[block.column + 2]),
        remark: row[block.column + 3],
      })
    }
  }
  return readings
}

function parseJob(rows) {
  const headerAt = rows.findIndex((row) => /^months$/i.test(text(row[0])) && /date/i.test(text(row[1])))
  const jobs = []
  if (headerAt < 0) return jobs
  const headers = rows[headerAt]
  for (const row of rows.slice(headerAt + 1)) {
    const period = cellText(row[0])
    if (!period || isStop(period)) break
    if (/^months$/i.test(period)) continue
    const performed = cellText(row[1])
    const checks = []
    for (let column = 3; column < headers.length; column += 1) {
      const item = cellText(headers[column])
      const result = markResult(row[column], '')
      if (!item || !result) continue
      checks.push({ itemText: item, result })
    }
    jobs.push({
      rowIndex: jobs.length,
      periodText: period,
      performedOn: /^\d{4}-\d{2}-\d{2}$/.test(performed ?? '') ? performed : null,
      doneBy: cellText(row[2]),
      checks,
    })
  }
  return jobs
}

function parseSections(rows) {
  const readings = []
  let group = null
  let open = false
  for (const row of rows) {
    const label = text(row[0])
    if (isStop(label)) break
    if (/^parameter$/i.test(label) && /^report$/i.test(text(row[1]))) {
      open = true
      continue
    }
    const value = readingValue(row[1])
    const remark = cellText(row[2])
    if (!value && !remark && label && label === label.toUpperCase() && label.length < 40) {
      group = cellText(label)
      open = false
      continue
    }
    if (!open || !group) continue
    const tag = cellText(label)
    if (!tag) continue
    pushReading(readings, { groupText: group, tagText: tag, value, remark: row[2] })
  }
  return readings
}

export function parseUtilityFile(file, recordedOn) {
  const id = path.basename(file).match(/^UTILITY_([0-9a-f]{8})_/i)?.[1]
  const form = utilityForms.find((item) => item.id.startsWith(id ?? ''))
  if (!form) throw new Error(`No utility form for ${path.basename(file)}`)
  const rows = sheetRows(file)
  const banner = bannerFields(rows)
  const day = {
    recordedOn,
    assetCode: form.assetCode,
    placeText: banner.placeText,
    shiftBanner: banner.shiftBanner,
    readings: [],
    materials: [],
    loaderRuns: [],
    checks: [],
    jobs: [],
  }
  if (form.kind === 'hourly') day.readings = parseHourly(rows)
  if (form.kind === 'fuel') day.readings = parseFuel(rows)
  if (form.kind === 'chemical') day.materials = parseChemical(rows)
  if (form.kind === 'coal') day.readings = parseCoal(rows)
  if (form.kind === 'checks') day.checks = parseChecks(rows)
  if (form.kind === 'loader') day.loaderRuns = parseLoader(rows)
  if (form.kind === 'lab') day.readings = parseLab(rows)
  if (form.kind === 'job') day.jobs = parseJob(rows)
  if (form.kind === 'sections') day.readings = parseSections(rows)
  return { form, day }
}

export function formForId(id) {
  return formById.get(id) ?? null
}
