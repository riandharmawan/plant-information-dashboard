import logsheets from './logsheets.json'
import { presentLogistics, presentSoundingPoint, presentTank } from '../domain/present.ts'
import type { RawLab, RawLogistics, RawSounding } from '../domain/present.ts'
import type { AnalyticsSummary, LabHistoryPoint, MovementTotal } from '../domain/types.ts'
import type { OperationsRepository } from './repository.ts'

interface LogsheetFile {
  periodLabel: string | null
  soundings: RawSounding[]
  labs: RawLab[]
  logistics: RawLogistics[]
  movements: Array<{ commodity: string; direction: 'inbound' | 'outbound' | 'unknown' }>
}

const DATA = logsheets as LogsheetFile

const SITE = {
  companyName: 'PT. Priscolin Bekasi',
  siteName: 'Priscolin Bekasi',
  timezone: 'Asia/Jakarta',
} as const

function compareTanks(a: string, b: string): number {
  const aTank = /^T\d+$/.test(a)
  const bTank = /^T\d+$/.test(b)
  if (aTank && bTank) return Number(a.slice(1)) - Number(b.slice(1))
  if (aTank) return -1
  if (bTank) return 1
  return a.localeCompare(b)
}

function soundingDates(): string[] {
  return [...new Set(DATA.soundings.map((row) => row.recordedOn).filter((day): day is string => Boolean(day)))].sort()
}

function latestPerTank(rows: RawSounding[]): RawSounding[] {
  const byTank = new Map<string, RawSounding>()
  for (const row of rows) {
    const previous = byTank.get(row.tankId)
    if (!previous || (row.recordedOn ?? '') >= (previous.recordedOn ?? '')) byTank.set(row.tankId, row)
  }
  return [...byTank.values()]
}

function blankSounding(tankId: string, on: string | null): RawSounding {
  return {
    roundIndex: 0,
    recordedOn: on,
    tankId,
    productName: '',
    soundingLevelM: null,
    temperatureC: null,
    operationalStatus: '',
  }
}

function currentLab(tankId: string, range?: { start: string; end: string }): RawLab | undefined {
  const rows = DATA.labs.filter((lab) => {
    if (lab.tankId !== tankId) return false
    if (!range) return true
    const day = lab.analysisDate
    return day != null && day >= range.start && day <= range.end
  })
  return rows
    .sort((a, b) => {
      const analysis = (a.analysisDate ?? '').localeCompare(b.analysisDate ?? '')
      if (analysis !== 0) return analysis
      return (a.snapshotOn ?? '').localeCompare(b.snapshotOn ?? '')
    })
    .at(-1)
}

function labSeries(tankId: string): RawLab[] {
  const byAnalysis = new Map<string, RawLab>()
  const ordered = DATA.labs
    .filter((lab) => lab.tankId === tankId)
    .sort((a, b) => (a.snapshotOn ?? '').localeCompare(b.snapshotOn ?? ''))
  for (const lab of ordered) {
    byAnalysis.set(lab.analysisDate ?? lab.snapshotOn ?? tankId, lab)
  }
  return [...byAnalysis.values()].sort((a, b) => (a.analysisDate ?? '').localeCompare(b.analysisDate ?? ''))
}

function activityDates(): string[] {
  const dates = new Set<string>()
  for (const row of DATA.soundings) if (row.recordedOn) dates.add(row.recordedOn)
  for (const row of DATA.labs) {
    if (row.snapshotOn) dates.add(row.snapshotOn)
    if (row.analysisDate) dates.add(row.analysisDate)
  }
  for (const row of DATA.logistics) if (row.sampledOn) dates.add(row.sampledOn)
  return [...dates].sort()
}

function average(values: Array<number | null>): number | null {
  const nums = values.filter((value): value is number => value != null)
  if (nums.length === 0) return null
  return nums.reduce((sum, value) => sum + value, 0) / nums.length
}

export class LocalOperationsRepository implements OperationsRepository {
  getSnapshotMeta() {
    const dates = soundingDates()
    const rounds = new Set(DATA.soundings.map((row) => row.roundIndex))
    return Promise.resolve({
      dataSource: 'local' as const,
      soundingAsOf: dates.at(-1) ?? null,
      soundingDates: dates,
      periodLabel: DATA.periodLabel,
      dataDates: activityDates(),
      roundCount: rounds.size,
    })
  }

  getSite() {
    return Promise.resolve({ ...SITE })
  }

  getLiveTanks(on?: string | null, range?: { start: string; end: string }) {
    const asOf = new Date()
    const day = on === undefined ? soundingDates().at(-1) ?? null : on
    const known = new Set<string>([
      ...DATA.soundings.map((row) => row.tankId),
      ...DATA.labs.map((lab) => lab.tankId),
    ])
    const thatDay = new Map(
      DATA.soundings.filter((row) => row.recordedOn === day).map((row) => [row.tankId, row]),
    )
    const tanks = [...known].map((tankId) => {
      const row = thatDay.get(tankId) ?? blankSounding(tankId, day)
      return presentTank(row, currentLab(tankId, range), asOf)
    })
    return Promise.resolve(tanks.sort((a, b) => compareTanks(a.tankId, b.tankId)))
  }

  getLiveLogistics() {
    return Promise.resolve(
      DATA.logistics.map(presentLogistics).sort((a, b) => {
        if (a.routingLocked !== b.routingLocked) return a.routingLocked ? -1 : 1
        if (a.mode !== b.mode) return a.mode === 'vessel' ? -1 : 1
        return (b.sampledOn ?? '').localeCompare(a.sampledOn ?? '')
      }),
    )
  }

  getSoundingHistory(tankId: string) {
    return Promise.resolve(
      DATA.soundings
        .filter((row) => row.tankId === tankId)
        .sort((a, b) => (a.recordedOn ?? '').localeCompare(b.recordedOn ?? '') || a.roundIndex - b.roundIndex)
        .map((row) => presentSoundingPoint(row, 'spec-pending')),
    )
  }

  getLabHistory(tankId: string): Promise<LabHistoryPoint[]> {
    const asOf = new Date()
    return Promise.resolve(labSeries(tankId).map((lab) => {
      const quality = presentTank({
        roundIndex: 0,
        recordedOn: null,
        tankId,
        productName: lab.productName,
        soundingLevelM: null,
        temperatureC: lab.temperatureC,
        operationalStatus: '',
      }, lab, asOf).quality
      return {
        snapshotOn: lab.snapshotOn,
        analysisDate: lab.analysisDate,
        parameters: quality?.parameters ?? [],
        storageVerdict: quality?.storageVerdict ?? 'spec-pending',
      }
    }))
  }

  getMovementSummary(): Promise<MovementTotal[]> {
    const totals = new Map<string, MovementTotal>()
    for (const movement of DATA.movements) {
      const row = totals.get(movement.commodity) ?? {
        commodity: movement.commodity,
        inbound: 0,
        outbound: 0,
        unknown: 0,
      }
      if (movement.direction === 'inbound') row.inbound += 1
      else if (movement.direction === 'outbound') row.outbound += 1
      else row.unknown += 1
      totals.set(movement.commodity, row)
    }
    return Promise.resolve(
      [...totals.values()].sort((a, b) => (b.inbound + b.outbound + b.unknown) - (a.inbound + a.outbound + a.unknown)),
    )
  }

  getAnalyticsSummary(tankId: string | null): Promise<AnalyticsSummary> {
    const rows = tankId
      ? DATA.soundings.filter((row) => row.tankId === tankId)
      : latestPerTank(DATA.soundings)
    const logistics = DATA.logistics.map(presentLogistics)
    const judged = logistics.filter((item) => item.oilFamily === 'CPO' && item.verdict !== 'spec-pending')
    const passed = judged.filter((item) => item.verdict === 'pass').length
    return Promise.resolve({
      tankId,
      averageLevelM: average(rows.map((row) => row.soundingLevelM)),
      averageTempC: average(rows.map((row) => row.temperatureC)),
      throughputTon: null,
      approvalRate: tankId || judged.length === 0 ? null : passed / judged.length,
      approvalScope: tankId || judged.length === 0 ? null : 'inbound-cpo',
    })
  }
}
