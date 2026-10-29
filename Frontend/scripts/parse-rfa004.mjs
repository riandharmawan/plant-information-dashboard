import path from 'node:path'
import XLSX from 'xlsx'

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function cellText(value) {
  const raw = text(value)
  if (!raw || raw === '-' || raw === '—' || raw === '–') return null
  return raw
}

function cellNumber(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const raw = text(value).replace(/\s/g, '')
  if (!raw || raw === '-' || raw === '—' || raw === '–') return null
  if (/^-?\d+$/.test(raw) || /^-?\d+\.\d+$/.test(raw)) return Number(raw)
  if (/^-?\d+,\d+$/.test(raw)) return Number(raw.replace(',', '.'))
  return null
}

function sheetRows(file) {
  const workbook = XLSX.readFile(file, { cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })
}

function processUnit(plantLine) {
  const plant = plantLine.match(/Plant\s*:\s*(.+)$/i)?.[1] ?? plantLine
  if (/ref\s*150/i.test(plant)) return 'refinery150'
  if (/ref\s*500/i.test(plant)) return 'refinery500'
  if (/frac/i.test(plant) && /400/.test(plant)) return 'fractionation400'
  if (/frac/i.test(plant) && /500/.test(plant)) return 'fractionation500'
  return null
}

function isShift(value) {
  return /^(?:long\s+)?shift\b/i.test(value) && !/^shift$/i.test(value)
}

function banner(rows) {
  return rows.map((row) => text(row[0])).find((cell) => /Plant\s*:/i.test(cell)) ?? ''
}

function pushUtility(utilities, rowIndex, shiftText, code, quantity, flowStart, flowEnd, unit) {
  if (quantity == null && flowStart == null && flowEnd == null) return
  utilities.push({
    rowIndex,
    shiftText,
    canonicalCode: code,
    quantity,
    flowStart,
    flowEnd,
    unit,
  })
}

export function parseRfa004A(file, productionDate) {
  const rows = sheetRows(file)
  const plantText = banner(rows)
  const unit = processUnit(plantText)
  if (!unit) throw new Error(`No process unit in ${path.basename(file)}`)
  let section = ''
  const flows = []
  const materials = []
  const utilities = []
  const remarks = []
  const flowIndex = { feed: 0, product: 0, coproduct: 0 }
  let earthRow = 0
  let acidRow = 0
  let utilityIndex = 0
  let remarkIndex = 0
  for (const row of rows) {
    const label = text(row[0])
    if (/^CPO\/RPO/i.test(label)) { section = 'feed'; continue }
    if (/^RBDPO\/RRBDPO/i.test(label)) { section = 'product'; continue }
    if (/^PFAD/i.test(label)) { section = 'coproduct'; continue }
    if (/BLEACHING EARTH/i.test(label)) { section = 'earth'; continue }
    if (/PHOSPHORIC/i.test(label)) { section = 'acid'; continue }
    if (/^REMARK/i.test(label)) { section = 'remark'; continue }
    if (/^UTILITY/i.test(label)) { section = 'utility'; continue }
    if (/^leader|^dokumen|^_{3,}/i.test(label)) { section = ''; continue }
    if (section === 'feed' && isShift(label)) {
      flows.push({
        block: 'feed',
        rowIndex: flowIndex.feed,
        shiftText: cellText(label),
        fromTankText: cellText(row[1]),
        commodityText: cellText(row[2]),
        startedAt: cellText(row[3]),
        flowStart: cellNumber(row[4]),
        endedAt: cellText(row[5]),
        flowEnd: cellNumber(row[6]),
        quantity: cellNumber(row[7]),
        unit: 'tonnes',
        destinationText: null,
      })
      flowIndex.feed += 1
    }
    if ((section === 'product' || section === 'coproduct') && isShift(label) && !/^jam$/i.test(text(row[1]))) {
      flows.push({
        block: section,
        rowIndex: flowIndex[section],
        shiftText: cellText(label),
        commodityText: null,
        fromTankText: null,
        startedAt: cellText(row[1]),
        flowStart: cellNumber(row[2]),
        endedAt: cellText(row[3]),
        flowEnd: cellNumber(row[4]),
        quantity: cellNumber(row[5]),
        unit: null,
        destinationText: cellText(row[6]),
      })
      flowIndex[section] += 1
    }
    if (section === 'earth' && isShift(label)) {
      const rowIndex = earthRow
      earthRow += 1
      const slots = [
        [1, row[1], row[2], row[3]],
        [2, row[4], row[5], row[6]],
        [3, row[7], row[8], row[9]],
      ]
      for (const [slot, bags, lot, grade] of slots) {
        const quantity = cellNumber(bags)
        const lotText = cellText(lot)
        const gradeText = cellText(grade)
        if (quantity == null && !lotText && !gradeText) continue
        materials.push({
          shiftText: cellText(label),
          material: 'bleaching_earth',
          rowIndex,
          slot,
          quantity,
          tankVolume: null,
          totalQuantity: slot === 1 ? cellNumber(row[10]) : null,
          unit: 'bags',
          lot: lotText,
          grade: gradeText,
        })
      }
    }
    if (section === 'acid' && isShift(label) && !/penggunaan/i.test(text(row[1]))) {
      const quantity = cellNumber(row[1])
      const tankVolume = cellNumber(row[2])
      const totalQuantity = cellNumber(row[3])
      const lot = cellText(row[4])
      if (quantity == null && tankVolume == null && totalQuantity == null && !lot) continue
      const rowIndex = acidRow
      acidRow += 1
      materials.push({
        shiftText: cellText(label),
        material: 'phosphoric_acid',
        rowIndex,
        slot: 1,
        quantity,
        tankVolume,
        totalQuantity,
        unit: null,
        lot,
        grade: null,
      })
    }
    if (section === 'remark' && isShift(label)) {
      const remark = cellText(row[1])
      if (!remark) continue
      remarks.push({
        rowIndex: remarkIndex,
        sectionText: 'Section 1',
        shiftText: cellText(label),
        remark,
      })
      remarkIndex += 1
    }
    if (section === 'utility' && (isShift(label) || [1, 2, 3, 4, 5, 6, 7].some((index) => cellNumber(row[index]) != null))) {
      if (/^shift$/i.test(label) || /^total/i.test(label) || /^section/i.test(label)) continue
      const shiftText = cellText(label)
      pushUtility(utilities, utilityIndex, shiftText, 'steam', cellNumber(row[1]), null, null, null)
      pushUtility(utilities, utilityIndex, shiftText, 'power', cellNumber(row[4]), cellNumber(row[2]), cellNumber(row[3]), 'kWh')
      pushUtility(utilities, utilityIndex, shiftText, 'gas', cellNumber(row[7]), cellNumber(row[5]), cellNumber(row[6]), 'mmBtu')
      utilityIndex += 1
    }
  }
  return { productionDate, processUnit: unit, plantText, flows, materials, utilities, remarks }
}

export function parseRfa004B(file, productionDate) {
  const rows = sheetRows(file)
  const plantText = banner(rows)
  const unit = processUnit(plantText)
  if (!unit) throw new Error(`No process unit in ${path.basename(file)}`)
  let section = ''
  const flows = []
  const utilities = []
  const remarks = []
  const flowIndex = { feed: 0, product: 0, coproduct: 0 }
  let utilityIndex = 0
  let remarkIndex = 0
  for (const row of rows) {
    const label = text(row[0])
    if (/^RBDPO\/ROL/i.test(label)) { section = 'feed'; continue }
    if (/^OLEIN/i.test(label)) { section = 'product'; continue }
    if (/^STEARIN/i.test(label)) { section = 'coproduct'; continue }
    if (/^REMARK/i.test(label)) { section = 'remark'; continue }
    if (/^UTILITY/i.test(label)) { section = 'utility'; continue }
    if (/^TOTAL/i.test(label) || /^leader|^dokumen|^_{3,}/i.test(label)) { section = ''; continue }
    if (section === 'feed' && isShift(label)) {
      flows.push({
        block: 'feed',
        rowIndex: flowIndex.feed,
        shiftText: cellText(label),
        fromTankText: cellText(row[2]),
        commodityText: cellText(row[3]),
        startedAt: cellText(row[4]),
        flowStart: cellNumber(row[5]),
        endedAt: cellText(row[6]),
        flowEnd: cellNumber(row[7]),
        quantity: cellNumber(row[8]),
        unit: 'tonnes',
        destinationText: null,
      })
      flowIndex.feed += 1
    }
    if (section === 'product' && isShift(label)) {
      flows.push({
        block: 'product',
        rowIndex: flowIndex.product,
        shiftText: cellText(label),
        commodityText: null,
        fromTankText: null,
        startedAt: cellText(row[2]),
        flowStart: cellNumber(row[3]),
        endedAt: cellText(row[4]),
        flowEnd: cellNumber(row[5]),
        quantity: cellNumber(row[6]),
        unit: null,
        destinationText: cellText(row[7]),
      })
      flowIndex.product += 1
    }
    if (section === 'coproduct' && isShift(label) && !/^jam$/i.test(text(row[1]))) {
      flows.push({
        block: 'coproduct',
        rowIndex: flowIndex.coproduct,
        shiftText: cellText(label),
        commodityText: null,
        fromTankText: null,
        startedAt: cellText(row[1]),
        flowStart: cellNumber(row[2]),
        endedAt: cellText(row[3]),
        flowEnd: cellNumber(row[4]),
        quantity: cellNumber(row[5]),
        unit: null,
        destinationText: cellText(row[6]),
      })
      flowIndex.coproduct += 1
    }
    if (section === 'remark') {
      const remark = cellText(row[1])
      if (!remark) continue
      remarks.push({
        rowIndex: remarkIndex,
        sectionText: null,
        shiftText: cellText(label),
        remark,
      })
      remarkIndex += 1
    }
    if (section === 'utility' && isShift(label)) {
      const shiftText = cellText(label)
      pushUtility(utilities, utilityIndex, shiftText, 'steam', cellNumber(row[3]), cellNumber(row[1]), cellNumber(row[2]), null)
      pushUtility(utilities, utilityIndex, shiftText, 'power', cellNumber(row[6]), cellNumber(row[4]), cellNumber(row[5]), 'kWh')
      pushUtility(utilities, utilityIndex, shiftText, 'water', cellNumber(row[9]), cellNumber(row[7]), cellNumber(row[8]), null)
      utilityIndex += 1
    }
  }
  return { productionDate, processUnit: unit, plantText, flows, materials: [], utilities, remarks }
}
