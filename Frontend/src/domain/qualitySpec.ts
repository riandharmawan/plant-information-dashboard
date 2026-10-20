import type { InboundVerdict, LabParameter, OilFamily, StorageVerdict, TankQuality } from './types.ts'

/** FSD rule: a storage result older than this needs a re-test badge. */
export const RETEST_AFTER_DAYS = 2

export interface QualityLimit {
  code: string
  max: number
}

export interface CommoditySpec {
  oilFamily: OilFamily
  scope: 'storage' | 'inbound'
  status: 'configured' | 'pending'
  limits: QualityLimit[]
  /** Where the numbers came from, so a later spec change is traceable. */
  source?: string
}

/**
 * Storage limits are intentionally empty.
 * One FFA ceiling cannot cover CPO (~4%) and PFAD (~85%).
 * Add a configured entry per oil when the lab supplies the real limits.
 */
export const STORAGE_SPECS: CommoditySpec[] = [
  { oilFamily: 'CPO', scope: 'storage', status: 'pending', limits: [] },
  { oilFamily: 'RPO', scope: 'storage', status: 'pending', limits: [] },
  { oilFamily: 'RPL', scope: 'storage', status: 'pending', limits: [] },
  { oilFamily: 'RPS', scope: 'storage', status: 'pending', limits: [] },
  { oilFamily: 'PFAD', scope: 'storage', status: 'pending', limits: [] },
  { oilFamily: 'PMF', scope: 'storage', status: 'pending', limits: [] },
  { oilFamily: 'OLEIN', scope: 'storage', status: 'pending', limits: [] },
  { oilFamily: 'SLUDGE', scope: 'storage', status: 'pending', limits: [] },
]

/**
 * Printed on F/QCO-009 and F/QCO-010 for incoming CPO.
 * This is the only pass/fail rule the logsheets state outright.
 */
export const INBOUND_SPECS: CommoditySpec[] = [
  {
    oilFamily: 'CPO',
    scope: 'inbound',
    status: 'configured',
    limits: [
      { code: 'FFA', max: 5 },
      { code: 'MI', max: 0.5 },
    ],
    source: 'F/QCO-009 and F/QCO-010 contract header',
  },
]

function specFor(list: CommoditySpec[], oilFamily: OilFamily): CommoditySpec | undefined {
  return list.find((spec) => spec.oilFamily === oilFamily && spec.status === 'configured')
}

function overLimit(limits: QualityLimit[], parameters: LabParameter[]): boolean {
  return limits.some((limit) => {
    const parameter = parameters.find((item) => item.code === limit.code)
    return parameter?.value != null && parameter.value > limit.max
  })
}

export function daysSince(analysisDate: string, asOf: Date): number | null {
  const analysed = new Date(`${analysisDate}T00:00:00`)
  if (Number.isNaN(analysed.getTime())) return null
  const today = new Date(asOf)
  today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - analysed.getTime()) / 86_400_000)
}

export function assessStorage(
  oilFamily: OilFamily,
  parameters: LabParameter[],
  analysisDate: string | null,
  asOf: Date,
): TankQuality {
  const ageDays = analysisDate ? daysSince(analysisDate, asOf) : null
  const spec = specFor(STORAGE_SPECS, oilFamily)
  let storageVerdict: StorageVerdict = 'spec-pending'
  if (spec) {
    storageVerdict = overLimit(spec.limits, parameters) ? 'quarantine' : 'pass'
  }
  return {
    analysisDate,
    ageDays,
    retestRequired: ageDays != null && ageDays > RETEST_AFTER_DAYS,
    parameters,
    storageVerdict,
  }
}

export function assessInbound(
  oilFamily: OilFamily,
  ffa: number | null,
  moisture: number | null,
): InboundVerdict {
  const spec = specFor(INBOUND_SPECS, oilFamily)
  if (!spec) return 'spec-pending'
  const parameters: LabParameter[] = [
    { code: 'FFA', label: 'FFA', value: ffa, unit: '%' },
    { code: 'MI', label: 'Moisture', value: moisture, unit: '%' },
  ]
  if (parameters.some((item) => item.value == null)) return 'spec-pending'
  return overLimit(spec.limits, parameters) ? 'rejected' : 'pass'
}
