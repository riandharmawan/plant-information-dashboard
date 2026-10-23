export type UtilityArea = 'boiler' | 'coal' | 'water' | 'effluent' | 'loader' | 'power'

export type UtilityForm = {
  code: string
  name: string
  area: UtilityArea
  place: string | null
  /** Expected every day. Event forms (chemicals, RO cleaning) and unwatched meters are not. */
  daily: boolean
  logged: string[]
  empty: string[]
  latest: string | null
  latestShifts: string | null
}

/** A tag as printed on the sheet, split into its name and the spec written beside it. */
export type TagInfo = {
  tag: string | null
  name: string | null
  spec: string | null
  unit: string | null
  min: number | null
  max: number | null
}

export type UtilityReading = TagInfo & {
  date: string
  form: string
  time: string | null
  shift: string | null
  group: string | null
  value: number | null
  text: string | null
  valueUnit: string | null
  remark: string | null
}

export type CoalDay = {
  date: string
  buckets: number | null
  steamKg: number | null
  ratio: number | null
  incomingKg: number | null
  faba: number
}

export type BoilerDaily = TagInfo & {
  form: string
  date: string
  group: string | null
  low: number | null
  high: number | null
  count: number
}

export type LoaderRun = {
  date: string
  shift: string | null
  hourStart: number | null
  hourEnd: number | null
  hoursTotal: number | null
  fuel: number | null
  oil: number | null
  remark: string | null
}

export type CheckRow = { date: string; item: string; result: 'yes' | 'no' }

export type ChemicalRow = {
  date: string
  group: string | null
  material: string | null
  lot: string | null
  received: number | null
  used: number | null
  remaining: number | null
  operator: string | null
  remark: string | null
}

export type RoJob = {
  date: string
  period: string | null
  performedOn: string | null
  doneBy: string | null
  checks: Array<{ item: string; result: 'yes' | 'no' | null }>
}

export type UtilitySummary = {
  from: string
  to: string
  dates: string[]
  forms: UtilityForm[]
  coal: CoalDay[]
  boiler: BoilerDaily[]
  loaderRuns: LoaderRun[]
  checks: CheckRow[]
  chemicals: ChemicalRow[]
  readings: UtilityReading[]
  jobs: RoJob[]
}

export type UtilityDay = {
  form: string
  date: string
  place: string | null
  shifts: string | null
  readings: UtilityReading[]
}

export const BOILER_WATER = 'F/UTI-012'
export const WTP_WATER = 'F/WTP-001'
export const WWTP = 'F/WWTP-001'

export function hasLimit(info: TagInfo): boolean {
  return info.min != null || info.max != null
}

/** Outside the range printed in the tag. This is context, not a quality verdict. */
export function outsidePrinted(reading: UtilityReading): boolean {
  if (reading.value == null) return false
  if (reading.min != null && reading.value < reading.min) return true
  return reading.max != null && reading.value > reading.max
}

export function daysInRange(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000) + 1
}

export function daysBetween(earlier: string, later: string): number {
  return daysInRange(earlier, later) - 1
}

export function latestDate(dates: string[]): string | null {
  return dates.length === 0 ? null : dates.reduce((latest, date) => (date > latest ? date : latest))
}

export function formOf(summary: UtilitySummary, code: string): UtilityForm | undefined {
  return summary.forms.find((form) => form.code === code)
}

/** Readings of one form on its latest logged day in the range. */
export function latestReadings(summary: UtilitySummary, code: string): { date: string | null; rows: UtilityReading[] } {
  const date = latestDate(summary.readings.filter((row) => row.form === code).map((row) => row.date))
  return { date, rows: date ? summary.readings.filter((row) => row.form === code && row.date === date) : [] }
}

/** Last checklist day in the range and its answers. */
export function latestChecks(summary: UtilitySummary): { date: string | null; rows: CheckRow[] } {
  const date = latestDate(summary.checks.map((row) => row.date))
  const byItem = new Map<string, CheckRow>()
  for (const row of summary.checks) {
    if (row.date !== date) continue
    if (byItem.get(row.item)?.result !== 'no') byItem.set(row.item, row)
  }
  return { date, rows: [...byItem.values()] }
}

export function readingKey(reading: Pick<UtilityReading, 'group' | 'tag'>): string {
  return `${reading.group ?? ''}|${reading.tag ?? ''}`
}

export function sum(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value != null)
  return present.length === 0 ? null : present.reduce((total, value) => total + value, 0)
}
