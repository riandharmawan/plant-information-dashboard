/**
 * Shapes the UI renders and the future API returns.
 * Keep these stable. The Express backend should send this JSON
 * rather than the raw e-form columns.
 */

export type OilFamily =
  | 'CPO'
  | 'RPO'
  | 'RPL'
  | 'RPS'
  | 'PFAD'
  | 'PMF'
  | 'OLEIN'
  | 'SLUDGE'
  | 'UNKNOWN'

export type StorageVerdict = 'pass' | 'quarantine' | 'spec-pending'
export type InboundVerdict = 'pass' | 'rejected' | 'spec-pending'
export type MassAvailability = 'known' | 'unavailable'

export interface SiteContext {
  companyName: string
  siteName: string
  timezone: string
}

export interface LabParameter {
  code: string
  label: string
  value: number | null
  unit: string
}

export interface TankQuality {
  analysisDate: string | null
  ageDays: number | null
  retestRequired: boolean
  parameters: LabParameter[]
  storageVerdict: StorageVerdict
}

export interface TankLive {
  tankId: string
  productName: string
  oilFamily: OilFamily
  soundingLevelM: number | null
  temperatureC: number | null
  operationalStatus: string
  /** Calendar day of this farm snapshot. Null when the tank has no sounding day. */
  recordedOn: string | null
  /** Morning-round index of this reading. Null when the tank has no sounding. */
  readingRound: number | null
  /** Tank capacity from the stock report, in kilograms. */
  capacityKg: number | null
  /** Sounding quantity from the calibration table, in kilograms, to two decimal places. */
  quantityKg: number | null
  /** Capacity minus quantity, in kilograms. */
  emptySpaceKg: number | null
  /** Quantity minus bottom stock, in kilograms. */
  loadableKg: number | null
  totalMassTon: number | null
  massAvailability: MassAvailability
  /** Quantity divided by capacity. Null when either figure is unknown. */
  fillRatio: number | null
  quality: TankQuality | null
}

export interface LogisticsVehicle {
  id: string
  mode: 'truck' | 'vessel'
  name: string
  commodity: string
  oilFamily: OilFamily
  direction: 'inbound' | 'outbound'
  targetLabel: string | null
  ffa: number | null
  moisture: number | null
  sampledOn: string | null
  remark: string | null
  detailLines: string[]
  verdict: InboundVerdict
  routingLocked: boolean
}

export interface SoundingPoint {
  /** 1-based morning round. The logsheet has no hourly series. */
  roundIndex: number
  /** Null when that round's calendar day cannot be read from the sheet. */
  recordedOn: string | null
  soundingLevelM: number | null
  temperatureC: number | null
  /** Sounding method, such as ISI LK or EMPTY. */
  operationalStatus: string
  storageVerdict: StorageVerdict
}

export interface AnalyticsSummary {
  tankId: string | null
  averageLevelM: number | null
  averageTempC: number | null
  /** Throughput in tons. Null until movements carry a quantity. */
  throughputTon: number | null
  /**
   * Share of judged incoming-CPO results that passed.
   * Null while a storage spec would be required, or when no inbound result was judged.
   */
  approvalRate: number | null
  approvalScope: 'inbound-cpo' | null
}

export interface LabHistoryPoint {
  snapshotOn: string | null
  analysisDate: string | null
  parameters: LabParameter[]
  storageVerdict: StorageVerdict
}

export interface MovementTotal {
  commodity: string
  inbound: number
  outbound: number
  unknown: number
}

export interface SnapshotMeta {
  dataSource: 'local' | 'api'
  /** ISO date of the newest sounding day. */
  soundingAsOf: string | null
  /** Sounding days, oldest first. */
  soundingDates: string[]
  /** Report span, e.g. 2026-07-22 – 2026-10-19. */
  periodLabel: string | null
  /** Calendar days that carry a sounding, lab, or gate sample. */
  dataDates: string[]
  roundCount: number
}
