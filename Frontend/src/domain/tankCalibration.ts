export const DENSITY_GROUPS = ['cpo', 'rpo', 'olein', 'rps', 'pfad'] as const

export type DensityGroup = (typeof DENSITY_GROUPS)[number]

export interface TankProfile {
  tankId: string
  capacityKg: number | null
  bottomStockKg: number | null
  dipOffsetMm: number
  tableTempC: number | null
  ullageLkMm: number | null
  ullageLbMm: number | null
  densityGroup: string | null
  volumeApprox: boolean
  volume: number[][]
  ringVolumes: Array<number | null>
  ringBands: number[][]
}

export type CalibrationIssue =
  | 'invalidCapacity'
  | 'invalidVolumeHeights'
  | 'invalidDensityGroup'
  | 'tableTempRequired'
  | 'invalidRingBand'

export function emptyProfile(tankId: string): TankProfile {
  return {
    tankId,
    capacityKg: null,
    bottomStockKg: null,
    dipOffsetMm: 0,
    tableTempC: null,
    ullageLkMm: null,
    ullageLbMm: null,
    densityGroup: null,
    volumeApprox: false,
    volume: [],
    ringVolumes: [],
    ringBands: [],
  }
}

export function canonicalTankId(value: string): string {
  const raw = value.trim()
  const numbered = raw.match(/^t\.?\s*0*(\d+)$/i)
  if (numbered) return `T${numbered[1].padStart(2, '0')}`
  return raw.replace(/\s+/g, ' ').toUpperCase()
}

export function cloneProfile(profile: TankProfile): TankProfile {
  return structuredClone(profile)
}

export function mergeProfiles(seed: TankProfile[], overrides: Record<string, TankProfile>): TankProfile[] {
  const byId = new Map(seed.map((tank) => [tank.tankId, tank]))
  for (const [tankId, profile] of Object.entries(overrides)) {
    if (!isProfile(profile)) continue
    byId.set(tankId, { ...profile, tankId })
  }
  return [...byId.values()]
}

export function validateProfile(profile: TankProfile): CalibrationIssue | null {
  if (profile.capacityKg != null && !(profile.capacityKg > 0)) return 'invalidCapacity'
  if (profile.densityGroup && !DENSITY_GROUPS.includes(profile.densityGroup as DensityGroup)) {
    return 'invalidDensityGroup'
  }
  if (profile.volume.length > 0 && profile.tableTempC == null) return 'tableTempRequired'
  const heights = new Set<number>()
  for (const pair of profile.volume) {
    if (pair.length < 2 || !Number.isFinite(pair[0]) || !Number.isFinite(pair[1])) return 'invalidVolumeHeights'
    const key = Math.round(pair[0] * 1000) / 1000
    if (heights.has(key)) return 'invalidVolumeHeights'
    heights.add(key)
  }
  for (const band of profile.ringBands) {
    if (band.length < 3 || !Number.isFinite(band[0]) || !Number.isFinite(band[1]) || !Number.isFinite(band[2])) {
      return 'invalidRingBand'
    }
    if (band[0] > band[1]) return 'invalidRingBand'
  }
  return null
}

export function sortVolume(rows: number[][]): number[][] {
  return [...rows].sort((left, right) => left[0] - right[0])
}

function parseNumber(raw: string): number | null {
  let text = raw.trim().replace(/\s/g, '')
  if (!text || text === '-' || text === '—') return null
  const commas = (text.match(/,/g) || []).length
  const dots = (text.match(/\./g) || []).length
  if (commas === 1 && dots === 0) text = text.replace(',', '.')
  else if (commas > 0 && dots >= 1) text = text.replace(/,/g, '')
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

function splitCsvLine(line: string): string[] {
  return line.split(/[;\t,]/).map((cell) => cell.trim())
}

function isHeaderCell(value: string): boolean {
  return /height|liter|litre|volume|low|high|offset|index|mm|temp/i.test(value) && parseNumber(value) == null
}

export function parseCsvPairs(text: string): { rows: number[][]; error: boolean } {
  const rows: number[][] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const cells = splitCsvLine(trimmed)
    if (cells.length < 2) return { rows: [], error: true }
    if (isHeaderCell(cells[0]) || isHeaderCell(cells[1])) continue
    const left = parseNumber(cells[0])
    const right = parseNumber(cells[1])
    if (left == null || right == null) return { rows: [], error: true }
    rows.push([left, right])
  }
  return { rows, error: false }
}

export function parseCsvTriples(text: string): { rows: number[][]; error: boolean } {
  const rows: number[][] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const cells = splitCsvLine(trimmed)
    if (cells.length < 3) return { rows: [], error: true }
    if (isHeaderCell(cells[0]) || isHeaderCell(cells[1]) || isHeaderCell(cells[2])) continue
    const low = parseNumber(cells[0])
    const high = parseNumber(cells[1])
    const offset = parseNumber(cells[2])
    if (low == null || high == null || offset == null) return { rows: [], error: true }
    rows.push([low, high, offset])
  }
  return { rows, error: false }
}

export function parseCsvValues(text: string): { values: Array<number | null>; error: boolean } {
  const values: Array<number | null> = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const cells = splitCsvLine(trimmed)
    if (isHeaderCell(cells[0]) || (cells[1] != null && isHeaderCell(cells[1]))) continue
    const raw = cells.length >= 2 ? cells[1] : cells[0]
    if (raw === '' || raw === '-' || raw === '—') {
      values.push(null)
      continue
    }
    const parsed = parseNumber(raw)
    if (parsed == null) return { values: [], error: true }
    values.push(parsed)
  }
  return { values, error: false }
}

export function serializeCsvPairs(rows: number[][], headers: [string, string]): string {
  return [headers.join(','), ...rows.map((row) => `${row[0]},${row[1]}`)].join('\n')
}

export function serializeCsvTriples(rows: number[][], headers: [string, string, string]): string {
  return [headers.join(','), ...rows.map((row) => `${row[0]},${row[1]},${row[2]}`)].join('\n')
}

export function serializeCsvValues(values: Array<number | null>, headers: [string, string]): string {
  return [headers.join(','), ...values.map((value, index) => `${index + 1},${value ?? ''}`)].join('\n')
}

export function isProfile(value: unknown): value is TankProfile {
  if (!value || typeof value !== 'object') return false
  const row = value as TankProfile
  return typeof row.tankId === 'string' && Array.isArray(row.volume) && Array.isArray(row.ringVolumes) && Array.isArray(row.ringBands)
}
