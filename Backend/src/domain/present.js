const RETEST_AFTER_DAYS = 2

export function oilFamilyOf(productName) {
  const name = String(productName ?? '').toUpperCase()
  if (name.includes('PFAD')) return 'PFAD'
  if (name.includes('PMF')) return 'PMF'
  if (name.includes('SLUDGE')) return 'SLUDGE'
  if (name.includes('RBDPS') || name.includes('RPS')) return 'RPS'
  if (name.includes('RPOL') || name.includes('RPL')) return 'RPL'
  if (name.includes('RBDPO') || name.includes('RPO')) return 'RPO'
  if (name.includes('CPO')) return 'CPO'
  if (name.includes('OLEIN') || name.includes('IV64') || name.includes('IV 64') || name.includes('TOOL')) {
    return 'OLEIN'
  }
  return 'UNKNOWN'
}

export function formatCommodity(name) {
  const raw = String(name ?? '').replace(/\s+/g, ' ').trim()
  if (!raw || raw === '-' || raw === '—') return ''
  if (raw.toUpperCase().replace(/\s+/g, '') === 'IV64') return 'IV 64'
  return raw.toUpperCase()
}

function todayIso(timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function daysSince(analysisDate, asOfIso) {
  const analysed = Date.parse(`${analysisDate}T00:00:00Z`)
  const today = Date.parse(`${asOfIso}T00:00:00Z`)
  if (Number.isNaN(analysed) || Number.isNaN(today)) return null
  return Math.round((today - analysed) / 86_400_000)
}

export function assessStorage(oilFamily, parameters, analysisDate, timeZone) {
  const ageDays = analysisDate ? daysSince(analysisDate, todayIso(timeZone)) : null
  return {
    analysisDate,
    ageDays,
    retestRequired: ageDays != null && ageDays > RETEST_AFTER_DAYS,
    parameters,
    storageVerdict: 'spec-pending',
  }
}

export function assessInbound(oilFamily, ffa, moisture) {
  if (oilFamily !== 'CPO') return 'spec-pending'
  if (ffa == null || moisture == null) return 'spec-pending'
  if (ffa > 5 || moisture > 0.5) return 'rejected'
  return 'pass'
}

function cleanLabel(value) {
  if (!value || value === '-' || value === '—') return null
  return value
}

export function presentTank(sounding, lab, stock, timeZone) {
  const oilFamily = oilFamilyOf(lab?.productName || sounding.productName)
  return {
    tankId: sounding.tankId,
    productName: formatCommodity(sounding.productName),
    oilFamily,
    soundingLevelM: sounding.soundingLevelM,
    temperatureC: sounding.temperatureC ?? (sounding.roundIndex > 0 ? lab?.temperatureC ?? null : null),
    operationalStatus: sounding.operationalStatus,
    recordedOn: sounding.recordedOn,
    readingRound: sounding.roundIndex > 0 ? sounding.roundIndex : null,
    capacityKg: stock.capacityKg,
    quantityKg: stock.quantityKg,
    emptySpaceKg: stock.emptySpaceKg,
    loadableKg: stock.loadableKg,
    totalMassTon: stock.quantityKg == null ? null : stock.quantityKg / 1000,
    massAvailability: stock.quantityKg == null ? 'unavailable' : 'known',
    fillRatio: stock.levelRatio,
    quality: lab
      ? assessStorage(oilFamily, lab.parameters, lab.analysisDate, timeZone)
      : null,
  }
}

export function presentLogistics(row) {
  const oilFamily = oilFamilyOf(row.commodity)
  let verdict = row.direction === 'inbound'
    ? assessInbound(oilFamily, row.ffa, row.moisture)
    : 'spec-pending'
  if (row.sampleBreach) verdict = 'rejected'
  return {
    id: row.id,
    mode: row.mode,
    name: row.name,
    commodity: row.commodity,
    oilFamily,
    direction: row.direction,
    targetLabel: cleanLabel(row.targetLabel),
    ffa: row.ffa,
    moisture: row.moisture,
    sampledOn: row.sampledOn,
    remark: cleanLabel(row.remark),
    detailLines: row.detailLines,
    verdict,
    routingLocked: verdict === 'rejected',
  }
}
