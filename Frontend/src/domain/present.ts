import { formatCommodity } from './format.ts'
import { oilFamilyOf } from './oilFamily.ts'
import { stockOf } from './tankStock.ts'
import { assessInbound, assessStorage } from './qualitySpec.ts'
import type { LabParameter, LogisticsVehicle, SoundingPoint, TankLive } from './types.ts'

/** One row of F/TNF-003 after a future parser has split rounds and dates. */
export interface RawSounding {
  roundIndex: number
  recordedOn: string | null
  tankId: string
  productName: string
  soundingLevelM: number | null
  temperatureC: number | null
  operationalStatus: string
}

/** One tank row of one F/QCO-001 snapshot. */
export interface RawLab {
  tankId: string
  productName: string
  analysisDate: string | null
  snapshotOn: string | null
  temperatureC: number | null
  parameters: LabParameter[]
}

/** One incoming truck or vessel the gatekeeper can judge. */
export interface RawLogistics {
  id: string
  mode: 'truck' | 'vessel'
  name: string
  commodity: string
  direction: 'inbound' | 'outbound'
  targetLabel: string | null
  ffa: number | null
  moisture: number | null
  sampledOn: string | null
  remark: string | null
  detailLines: string[]
  /** True when any compartment sample is outside the inbound CPO limits. */
  sampleBreach: boolean
}

export function presentTank(sounding: RawSounding, lab: RawLab | undefined, asOf: Date): TankLive {
  const oilFamily = oilFamilyOf(lab?.productName || sounding.productName)
  const stock = stockOf(sounding.tankId, sounding.soundingLevelM, sounding.temperatureC, sounding.operationalStatus)
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
      ? assessStorage(oilFamily, lab.parameters, lab.analysisDate, asOf)
      : null,
  }
}

function cleanLabel(value: string | null): string | null {
  if (!value || value === '-' || value === '—') return null
  return value
}

export function presentLogistics(row: RawLogistics): LogisticsVehicle {
  const oilFamily = oilFamilyOf(row.commodity)
  let verdict: LogisticsVehicle['verdict'] = row.direction === 'inbound'
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

export function presentSoundingPoint(row: RawSounding, verdict: SoundingPoint['storageVerdict']): SoundingPoint {
  return {
    roundIndex: row.roundIndex,
    recordedOn: row.recordedOn,
    soundingLevelM: row.soundingLevelM,
    temperatureC: row.temperatureC,
    operationalStatus: row.operationalStatus,
    storageVerdict: verdict,
  }
}
