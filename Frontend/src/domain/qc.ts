import qcData from '../data/qc.json'
import { RETEST_AFTER_DAYS, daysSince } from './qualitySpec.ts'
import type { InboundVerdict } from './types.ts'

export interface StorageRow {
  tankId: string
  oil: string
  analysisDate: string | null
  capacity: number | null
  quantity: number | null
  emptySpace: number | null
  temperatureC: number | null
  ffa: number | null
  moisture: number | null
  colorR: number | null
  colorY: number | null
  iv: number | null
  pv: number | null
  smp: number | null
  cloudPoint: number | null
  anv: number | null
  carotene: number | null
  phosphorus: number | null
  dobi: number | null
  totox: number | null
  odor: string | null
  remark: string | null
  snapshotOn: string | null
  revision: number
}

export interface PalkaSample {
  palka: string
  sampleNo: string | null
  ffa: number | null
  iv: number | null
  dobi: number | null
  moisture: number | null
}

export interface VesselComposite {
  ffa: number | null
  iv: number | null
  moisture: number | null
  dobi: number | null
  pv: number | null
  anv: number | null
  triene: number | null
  totox: number | null
  carotene: number | null
  mineralOil: string | null
}

export interface VesselTicket {
  id: string
  ship: string | null
  supplier: string | null
  commodity: string
  arrival: string | null
  quantityLabel: string | null
  contractNo: string | null
  ffaMax: number | null
  moistureMax: number | null
  dobiMin: number | null
  release: string | null
  samples: PalkaSample[]
  composite: VesselComposite
  leader: string | null
  leaderSigned: string | null
  head: string | null
  headSigned: string | null
}

export interface TruckRow {
  sampleNo: string
  sampledOn: string | null
  policeNo: string
  ffa: number | null
  moisture: number | null
  iv: number | null
  dobi: number | null
  pv: number | null
  colorR: number | null
  colorY: number | null
  analyst: string | null
  remark: string | null
}

export interface TruckSheet {
  supplier: string | null
  material: string
  vessel: string | null
  arrival: string | null
  contractNo: string | null
  ffaMax: number | null
  moistureMax: number | null
  rows: TruckRow[]
}

export interface MovementRow {
  vehicle: string
  commodity: string
  timeIn: string | null
  timeOut: string | null
  customer: string | null
  sealIn: string | null
  sealOut: string | null
  operator: string | null
  remark: string | null
}

export interface QcFile {
  storage: StorageRow[]
  vessels: VesselTicket[]
  trucks: TruckSheet
  movements: {
    periodStart: string | null
    periodEnd: string | null
    rows: MovementRow[]
  }
}

export type GateDirection = 'inbound' | 'outbound' | 'unknown'

/** Printed on the palka header of F/QCO-009. Outside this band is a watch, not a reject. */
export const PALKA_IV_MIN = 51
export const PALKA_IV_MAX = 54

/** Printed as DOBI (>2,0) on the palka header. */
export const PALKA_DOBI_ABOVE = 2

export const QC = qcData as QcFile

function ordered(start: string, end: string): { from: string; to: string } {
  return start <= end ? { from: start, to: end } : { from: end, to: start }
}

export function inRange(iso: string | null, start: string, end: string): boolean {
  if (!iso) return false
  const { from, to } = ordered(start, end)
  return iso >= from && iso <= to
}

export function qcDates(): string[] {
  const dates = new Set<string>()
  for (const row of QC.storage) if (row.snapshotOn) dates.add(row.snapshotOn)
  for (const row of QC.trucks.rows) if (row.sampledOn) dates.add(row.sampledOn)
  for (const row of QC.vessels) if (row.arrival) dates.add(row.arrival)
  return [...dates].sort()
}

export const QC_DATES = qcDates()

export function ageAtSnapshot(analysisDate: string | null, snapshotOn: string | null): number | null {
  if (!analysisDate || !snapshotOn) return null
  return daysSince(analysisDate, new Date(`${snapshotOn}T00:00:00`))
}

export function retestDue(row: StorageRow): boolean {
  const age = ageAtSnapshot(row.analysisDate, row.snapshotOn)
  return age != null && age > RETEST_AFTER_DAYS
}

export function storageInRange(start: string, end: string): StorageRow[] {
  return QC.storage.filter((row) => inRange(row.snapshotOn, start, end))
}

export function latestStorage(rows: StorageRow[]): StorageRow[] {
  if (rows.length === 0) return []
  const latestDate = rows.map((row) => row.snapshotOn ?? '').sort().at(-1) ?? ''
  const onDate = rows.filter((row) => (row.snapshotOn ?? '') === latestDate)
  const revision = Math.max(...onDate.map((row) => row.revision))
  return onDate.filter((row) => row.revision === revision)
}

/** Fixed roster printed as T.01–T.29. A tank stays on the list even with no certificate. */
export const STORAGE_TANK_IDS = Array.from({ length: 29 }, (_, index) => `T${String(index + 1).padStart(2, '0')}`)

function newerStorage(row: StorageRow, current: StorageRow): boolean {
  const date = (row.snapshotOn ?? '').localeCompare(current.snapshotOn ?? '')
  if (date !== 0) return date > 0
  return row.revision > current.revision
}

/** Newest certificate per tank inside the rows given. Highest snapshot date, then highest revision. */
export function latestByTank(rows: StorageRow[]): Map<string, StorageRow> {
  const byTank = new Map<string, StorageRow>()
  for (const row of rows) {
    const current = byTank.get(row.tankId)
    if (!current || newerStorage(row, current)) byTank.set(row.tankId, row)
  }
  return byTank
}

/** Every certificate for one tank, newest snapshot first. */
export function historyForTank(rows: StorageRow[], tankId: string): StorageRow[] {
  return rows
    .filter((row) => row.tankId === tankId)
    .sort((left, right) => {
      const date = (right.snapshotOn ?? '').localeCompare(left.snapshotOn ?? '')
      if (date !== 0) return date
      return right.revision - left.revision
    })
}

export function overMax(value: number | null, max: number | null): boolean {
  return value != null && max != null && value > max
}

export function contractVerdict(
  ffa: number | null,
  moisture: number | null,
  ffaMax: number | null,
  moistureMax: number | null,
): InboundVerdict {
  if (ffaMax == null || moistureMax == null || ffa == null || moisture == null) return 'spec-pending'
  if (ffa > ffaMax || moisture > moistureMax) return 'rejected'
  return 'pass'
}

export function vesselVerdict(ticket: VesselTicket): InboundVerdict {
  const sampleBreach = ticket.samples.some(
    (sample) => overMax(sample.ffa, ticket.ffaMax) || overMax(sample.moisture, ticket.moistureMax),
  )
  if (sampleBreach) return 'rejected'
  return contractVerdict(ticket.composite.ffa, ticket.composite.moisture, ticket.ffaMax, ticket.moistureMax)
}

export function ivOutside(value: number | null): boolean {
  return value != null && (value < PALKA_IV_MIN || value > PALKA_IV_MAX)
}

export function dobiLow(value: number | null): boolean {
  return value != null && value <= PALKA_DOBI_ABOVE
}

export function movementDirection(sealIn: string | null, sealOut: string | null): GateDirection {
  const blank = (value: string | null) => {
    const raw = (value ?? '').trim().toLowerCase()
    return !raw || raw === 'empty' || raw === '-'
  }
  if (blank(sealIn) && !blank(sealOut)) return 'outbound'
  if (!blank(sealIn) && blank(sealOut)) return 'inbound'
  return 'unknown'
}

/** Rolls toling / tooling / tolling into one family. The row still shows the written name. */
export function commodityFamily(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\bTOOLING\b/g, 'TOLLING')
    .replace(/\bTOLING\b/g, 'TOLLING')
}

export function contractText(ffaMax: number | null, moistureMax: number | null, dobiMin: number | null): string {
  const parts: string[] = []
  if (ffaMax != null) parts.push(`FFA ≤ ${ffaMax}`)
  if (moistureMax != null) parts.push(`M&I ≤ ${moistureMax}`)
  if (dobiMin != null) parts.push(`DOBI ≥ ${dobiMin}`)
  return parts.join(' · ') || '-'
}
