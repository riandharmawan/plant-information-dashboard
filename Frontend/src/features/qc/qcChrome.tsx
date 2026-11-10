import type { ReactNode } from 'react'
import { qcDates } from '../../domain/qc.ts'
import { useQcFile } from '../../data/QcContext.tsx'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import type { InboundVerdict } from '../../domain/types.ts'
import { formatDay } from '../../domain/format.ts'
import { formatVariancePct, type VarianceAlert } from '../../domain/qualityVariance.ts'
import { DateRangeFilter } from '../daily-production/DateRangeFilter.tsx'
import { QcTabs } from './qcNav.tsx'

export function QcChrome({
  title,
  note,
  legend,
  start,
  end,
  setRange,
  children,
}: {
  title: string
  note?: string
  legend?: ReactNode
  start: string
  end: string
  setRange: (start: string, end: string) => void
  children: ReactNode
}) {
  const dates = qcDates(useQcFile())
  return (
    <div className="page page--prod">
      <header className="page-title-row">
        <h1 className="page-title">{title}</h1>
        <DateRangeFilter start={start} end={end} onChange={setRange} dataDates={dates} />
      </header>
      <QcTabs start={start} end={end} />
      {note ? <p className="page-note">{note}</p> : null}
      {legend}
      {children}
    </div>
  )
}

export function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'yield' | 'alert' }) {
  const className = tone === 'yield' ? 'prod-kpi prod-kpi--yield' : tone === 'alert' ? 'prod-kpi prod-kpi--alert' : 'prod-kpi'
  return (
    <article className={className}>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  )
}

export const PARAM_DIGITS = {
  ffa: 3,
  moisture: 3,
  colorR: 1,
  colorY: 1,
  iv: 2,
  pv: 2,
  dobi: 2,
  temp: 1,
  smp: 1,
  cloud: 1,
  anv: 2,
  carotene: 0,
  phosphorus: 1,
  totox: 2,
  triene: 3,
  flow: 1,
  oc: 2,
} as const

export type ParamCode = keyof typeof PARAM_DIGITS

export function formatParam(code: ParamCode, value: number | null, locale: 'en' | 'id'): string {
  if (value == null) return '-'
  const digits = PARAM_DIGITS[code]
  return value.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function useParam() {
  const { locale } = useLocale()
  return (code: ParamCode, value: number | null) => formatParam(code, value, locale)
}

export function Num({
  value,
  code,
  breach = false,
  watch = false,
  variance = null,
  className,
}: {
  value: number | null
  code: ParamCode
  breach?: boolean
  watch?: boolean
  /** Set when this result moved 15%+ from the tank's last recorded result. Shown alongside, not instead of, breach/watch. */
  variance?: VarianceAlert | null
  className?: string
}) {
  const param = useParam()
  const { t, locale } = useLocale()
  const names = ['num']
  if (className) names.push(className)
  if (value == null) names.push('num--empty')
  else if (breach) names.push('num--neg')
  else if (watch) names.push('num--watch')
  if (variance) names.push('num--variance')
  const title = value == null ? t.notRecorded : breach ? t.overMax : watch ? t.watch : undefined
  const varianceTitle = variance
    ? t.varianceTooltip
      .replace('{pct}', formatVariancePct(variance.pctChange))
      .replace('{previous}', param(code, variance.previous))
      .replace('{day}', variance.previousDate ? formatDay(variance.previousDate, locale) : t.unavailable)
    : undefined
  return (
    <td className={names.join(' ')} title={varianceTitle ?? title}>
      {param(code, value)}
      {variance ? (
        <span className={variance.pctChange >= 0 ? 'num-variance-arrow num-variance-arrow--up' : 'num-variance-arrow num-variance-arrow--down'} aria-hidden="true">
          {variance.pctChange >= 0 ? '\u25b2' : '\u25bc'}
        </span>
      ) : null}
    </td>
  )
}

export function VerdictBadge({ verdict }: { verdict: InboundVerdict }) {
  const { t } = useLocale()
  if (verdict === 'rejected') return <span className="badge badge--danger">{t.rejected}</span>
  if (verdict === 'pass') return <span className="badge badge--pass">{t.pass}</span>
  return <span className="badge badge--muted">{t.specPending}</span>
}
