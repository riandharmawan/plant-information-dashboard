/** Jenis Minyak from the sounding sheet. Blank stays blank. */
export function formatCommodity(name: string): string {
  const raw = name.replace(/\s+/g, ' ').trim()
  if (!raw || raw === '-' || raw === '—') return ''
  if (raw.toUpperCase().replace(/\s+/g, '') === 'IV64') return 'IV 64'
  return raw.toUpperCase()
}

export function tankLabel(tankId: string): string {
  if (/^T\d+$/.test(tankId)) return `T.${tankId.slice(1)}`
  return tankId.replace(/\w\S*/g, (word) => {
    if (['CPO', 'PFAD', 'RPO', 'RPS', 'RPL', 'PMF', 'IV'].includes(word)) return word
    return word.charAt(0) + word.slice(1).toLowerCase()
  })
}

export function formatMeasure(value: number | null, digits = 3): string {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 })
}

/** Kilograms from the sounding formula, always shown with two decimal places. */
export function formatKg(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatDay(iso: string | null, locale: 'en' | 'id'): string {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(year, month - 1, day).toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Visual scale for the level bar. This is metres on a shared axis, not a percent of capacity. */
export const SOUNDING_SCALE_M = 22

export function levelPercent(levelM: number | null): number {
  if (levelM == null || levelM <= 0) return 0
  return Math.min(100, (levelM / SOUNDING_SCALE_M) * 100)
}

export function periodEnd(periodLabel: string | null): string | null {
  if (!periodLabel) return null
  const parts = periodLabel.split('–').map((part) => part.trim()).filter(Boolean)
  return parts.at(-1) ?? null
}

export function periodBounds(periodLabel: string | null): { start: string; end: string } | null {
  if (!periodLabel) return null
  const [start, end] = periodLabel.split('–').map((part) => part.trim())
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return null
  const finish = end && /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : start
  return start <= finish ? { start, end: finish } : { start: finish, end: start }
}

/** Undated rows stay visible. Dated rows must fall inside the inclusive range. */
export function inDateRange(iso: string | null, start: string, end: string): boolean {
  if (!iso) return true
  const from = start <= end ? start : end
  const to = start <= end ? end : start
  return iso >= from && iso <= to
}

export function formatPeriod(periodLabel: string | null, locale: 'en' | 'id'): string {
  if (!periodLabel) return ''
  const [start, end] = periodLabel.split('–').map((part) => part.trim())
  if (!start || !end) return periodLabel
  return `${formatDay(start, locale)} – ${formatDay(end, locale)}`
}

export function parameter(parameters: Array<{ code: string; value: number | null }> | undefined, code: string): number | null {
  return parameters?.find((item) => item.code === code)?.value ?? null
}
