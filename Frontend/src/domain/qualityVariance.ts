/**
 * Day-over-day / result-over-result quality variance.
 *
 * Flags a lab parameter when it moves 15% or more from the tank's last
 * recorded result for that same parameter and product. "Previous" is not
 * strictly yesterday — storage certificates and tank-farm labs are not
 * sampled every day, so the baseline is whichever earlier result is on
 * record, skipping gaps.
 *
 * A pure percentage swing is noisy on a near-zero baseline (e.g. FFA
 * 0.05% -> 0.06% reads as "+20%" but is meaningless), so a parameter also
 * has to move at least its absolute floor before it counts as a variance.
 */

export const VARIANCE_THRESHOLD = 0.15

/** Minimum absolute move required before the 15% rule can fire, keyed by the same parameter codes as qcChrome's ParamCode. */
export const VARIANCE_FLOOR: Record<string, number> = {
  ffa: 0.05,
  moisture: 0.05,
  colorR: 0.5,
  colorY: 0.5,
  iv: 0.5,
  pv: 0.3,
  anv: 0.3,
  totox: 0.5,
  smp: 0.3,
  cloud: 0.3,
  carotene: 5,
  phosphorus: 1,
  dobi: 0.05,
}

export interface VariancePoint {
  date: string | null
  value: number | null
}

export interface VarianceAlert {
  current: number
  previous: number
  currentDate: string | null
  previousDate: string | null
  /** Signed fraction, e.g. 0.38 for +38%. Infinity when the previous result was exactly zero. */
  pctChange: number
}

/**
 * `points` must already be ordered newest first. Returns the comparison
 * between the latest and the most recent earlier result for that
 * parameter, or null when there are fewer than two results, or the move
 * is inside the noise floor / below the 15% threshold.
 */
export function formatVariancePct(pctChange: number): string {
  if (!Number.isFinite(pctChange)) return pctChange > 0 ? '+\u221e%' : '-\u221e%'
  const rounded = Math.round(pctChange * 100)
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

export function varianceFrom(code: string, points: VariancePoint[]): VarianceAlert | null {
  // The *current* reading must be the actual latest result on record - if the
  // most recent entry didn't test this parameter, there is no "now" value to
  // flag as having moved, so skip it rather than silently comparing two older
  // results. The *previous* baseline is allowed to skip back over gaps.
  const latest = points[0]
  if (!latest || latest.value == null) return null
  const prior = points.slice(1).find((point): point is { date: string | null; value: number } => point.value != null)
  if (!prior) return null
  const delta = latest.value - prior.value
  const floor = VARIANCE_FLOOR[code] ?? 0
  if (Math.abs(delta) < floor) return null
  const pctChange = prior.value === 0 ? (delta === 0 ? 0 : Infinity) : delta / Math.abs(prior.value)
  if (Math.abs(pctChange) < VARIANCE_THRESHOLD) return null
  return {
    current: latest.value,
    previous: prior.value,
    currentDate: latest.date,
    previousDate: prior.date,
    pctChange,
  }
}

/** Tank Farm lab results carry upper-case codes (FFA, COLOR_R, ...). The floor table above uses the QC page's camelCase codes. */
export const LAB_CODE_TO_VARIANCE_KEY: Record<string, string> = {
  FFA: 'ffa',
  MI: 'moisture',
  COLOR_R: 'colorR',
  COLOR_Y: 'colorY',
  IV: 'iv',
  PV: 'pv',
  SMP: 'smp',
  CP: 'cloud',
  ANV: 'anv',
  CAROTENE: 'carotene',
  P: 'phosphorus',
  DOBI: 'dobi',
  TOTOX: 'totox',
}

export interface LabVarianceAlert extends VarianceAlert {
  code: string
  label: string
}

/** Picks one code's alert out of a tank's variance list, or undefined when that parameter did not move. */
export function findVariance(alerts: LabVarianceAlert[] | undefined, code: string): LabVarianceAlert | undefined {
  return alerts?.find((item) => item.code === code)
}

/**
 * Every lab parameter that moved 15%+ from this tank's last recorded
 * result, across the tank's full lab history (`points` need not be
 * sorted; every result in the array is a candidate baseline).
 */
export function varianceFromLabHistory(
  history: Array<{ analysisDate: string | null; snapshotOn: string | null; parameters: Array<{ code: string; label: string; value: number | null }> }>,
): LabVarianceAlert[] {
  const ordered = [...history].sort((left, right) => {
    const leftDay = left.analysisDate ?? left.snapshotOn ?? ''
    const rightDay = right.analysisDate ?? right.snapshotOn ?? ''
    return rightDay.localeCompare(leftDay)
  })
  const labels = new Map<string, string>()
  for (const point of ordered) {
    for (const param of point.parameters) {
      if (!labels.has(param.code)) labels.set(param.code, param.label)
    }
  }
  const result: LabVarianceAlert[] = []
  for (const [code, label] of labels) {
    const points = ordered.map((point) => ({
      date: point.analysisDate ?? point.snapshotOn,
      value: point.parameters.find((item) => item.code === code)?.value ?? null,
    }))
    const alert = varianceFrom(LAB_CODE_TO_VARIANCE_KEY[code] ?? code, points)
    if (alert) result.push({ ...alert, code, label })
  }
  return result
}
