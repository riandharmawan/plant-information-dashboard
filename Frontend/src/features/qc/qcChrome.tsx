import type { ReactNode } from 'react'
import { QC_DATES } from '../../domain/qc.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import type { InboundVerdict } from '../../domain/types.ts'
import { DateRangeFilter } from '../daily-production/DateRangeFilter.tsx'
import { QcTabs } from './qcNav.tsx'

export function QcChrome({
  title,
  note,
  start,
  end,
  setRange,
  children,
}: {
  title: string
  note?: string
  start: string
  end: string
  setRange: (start: string, end: string) => void
  children: ReactNode
}) {
  return (
    <div className="page page--prod">
      <header className="page-title-row">
        <h1 className="page-title">{title}</h1>
        <DateRangeFilter start={start} end={end} onChange={setRange} dataDates={QC_DATES} />
      </header>
      <QcTabs start={start} end={end} />
      {note ? <p className="page-note">{note}</p> : null}
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

export function useQty() {
  const { locale } = useLocale()
  const numberLocale = locale === 'id' ? 'id-ID' : 'en-US'
  return (value: number | null, digits = 3) => {
    if (value == null) return '-'
    return value.toLocaleString(numberLocale, { maximumFractionDigits: digits })
  }
}

export function Num({
  value,
  digits = 3,
  breach = false,
  watch = false,
}: {
  value: number | null
  digits?: number
  breach?: boolean
  watch?: boolean
}) {
  const qty = useQty()
  const names = ['num']
  if (value == null) names.push('num--empty')
  else if (breach) names.push('num--neg')
  else if (watch) names.push('num--watch')
  return <td className={names.join(' ')}>{qty(value, digits)}</td>
}

export function VerdictBadge({ verdict }: { verdict: InboundVerdict }) {
  const { t } = useLocale()
  if (verdict === 'rejected') return <span className="badge badge--danger">{t.rejected}</span>
  if (verdict === 'pass') return <span className="badge badge--pass">{t.pass}</span>
  return <span className="badge badge--muted">{t.specPending}</span>
}
