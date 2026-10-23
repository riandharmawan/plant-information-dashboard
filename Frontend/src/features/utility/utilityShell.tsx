import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useSearchParams } from 'react-router-dom'
import { api } from '../../data/api.ts'
import { useAuth } from '../../data/AuthContext.tsx'
import { formatDay } from '../../domain/format.ts'
import type { UtilityDay, UtilitySummary } from '../../domain/utility.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import type { Messages } from '../../i18n/messages.ts'
import { DateRangeFilter } from '../daily-production/DateRangeFilter.tsx'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const TABS: Array<{ path: string; label: keyof Messages; end?: boolean }> = [
  { path: '/utility', label: 'utilityOverview', end: true },
  { path: '/utility/boiler', label: 'utilityBoiler' },
  { path: '/utility/coal', label: 'utilityCoal' },
  { path: '/utility/water', label: 'utilityWater' },
  { path: '/utility/effluent', label: 'utilityEffluent' },
  { path: '/utility/loader', label: 'utilityLoader' },
]

type UtilityState = { summary: UtilitySummary; siteId: string }

const UtilityContext = createContext<UtilityState | null>(null)

export function useUtility(): UtilityState {
  const state = useContext(UtilityContext)
  if (!state) throw new Error('useUtility must be used inside UtilityLayout')
  return state
}

/** Loads the range summary once for every Utility tab. Utility rows live only in Postgres. */
export function UtilityLayout() {
  const { t } = useLocale()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const siteId = user?.sites[0]?.id ?? 'bekasi'
  const from = params.get('from')
  const to = params.get('to')
  const query = from && to && ISO_DATE.test(from) && ISO_DATE.test(to) ? `?from=${from}&to=${to}` : ''
  const [summary, setSummary] = useState<UtilitySummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    api<UtilitySummary>(`/api/v1/sites/${siteId}/utility${query}`)
      .then((next) => { if (!cancelled) setSummary(next) })
      .catch(() => { if (!cancelled) setError(t.requestFailed) })
    return () => { cancelled = true }
  }, [siteId, query, t.requestFailed])

  if (error) return <p className="page-note">{error}</p>
  if (!summary) return <p className="page-note">{t.loading}</p>
  return (
    <UtilityContext.Provider value={{ summary, siteId }}>
      <Outlet />
    </UtilityContext.Provider>
  )
}

/** Loads one form's latest day in the range. An empty sheet is reported, not fetched. */
export function useUtilityDay(code: string) {
  const { summary, siteId } = useUtility()
  const form = summary.forms.find((item) => item.code === code)
  const date = form?.latest ?? null
  const emptySheet = date != null && (form?.empty.includes(date) ?? false)
  const [day, setDay] = useState<UtilityDay | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setDay(null)
    if (!date || emptySheet) return
    let cancelled = false
    setLoading(true)
    api<UtilityDay>(`/api/v1/sites/${siteId}/utility/day?form=${encodeURIComponent(code)}&date=${date}`)
      .then((next) => { if (!cancelled) setDay(next) })
      .catch(() => { if (!cancelled) setDay(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [siteId, code, date, emptySheet])

  return { date, emptySheet, day: day?.form === code ? day : null, loading }
}

export function utilitySearch(start: string, end: string): string {
  return `?from=${start <= end ? start : end}&to=${start <= end ? end : start}`
}

export function useUtilityRange() {
  const { summary } = useUtility()
  const [params, setParams] = useSearchParams()
  const from = params.get('from')
  const to = params.get('to')
  const start = from && ISO_DATE.test(from) ? from : summary.from
  const end = to && ISO_DATE.test(to) ? to : summary.to
  const setRange = (nextStart: string, nextEnd: string) => {
    const next = new URLSearchParams(params)
    next.set('from', nextStart <= nextEnd ? nextStart : nextEnd)
    next.set('to', nextStart <= nextEnd ? nextEnd : nextStart)
    setParams(next, { replace: true })
  }
  return { start, end, setRange, search: utilitySearch(start, end) }
}

export function UtilityTabs({ start, end }: { start: string; end: string }) {
  const { t } = useLocale()
  const search = utilitySearch(start, end)
  return (
    <nav className="prod-tabs" aria-label={t.utility}>
      {TABS.map((tab) => (
        <NavLink
          key={tab.path}
          to={{ pathname: tab.path, search }}
          end={tab.end}
          className={({ isActive }) => (isActive ? 'prod-tab prod-tab--on' : 'prod-tab')}
        >
          {t[tab.label]}
        </NavLink>
      ))}
    </nav>
  )
}

export function UtilityChrome({
  title,
  day,
  note,
  legend,
  children,
}: {
  title: string
  /** The day the figures and roster describe. */
  day?: string | null
  note?: string
  legend?: ReactNode
  children: ReactNode
}) {
  const { t, locale } = useLocale()
  const { user } = useAuth()
  const { summary } = useUtility()
  const { start, end, setRange } = useUtilityRange()
  return (
    <div className="page page--prod page--ops">
      <header className="page-title-row">
        <h1 className="page-title">{title}</h1>
        <span className="site-pill">
          <span className="site-pill__dot" aria-hidden="true" />
          {user?.sites[0]?.name ?? 'Priscolin Bekasi'}
        </span>
        {day !== undefined ? <span className="page-meta">{day ? `${t.latestDay} ${formatDay(day, locale)}` : '-'}</span> : null}
        <DateRangeFilter start={start} end={end} onChange={setRange} dataDates={summary.dates} />
      </header>
      <UtilityTabs start={start} end={end} />
      {note ? <p className="page-note">{note}</p> : null}
      {legend}
      {children}
    </div>
  )
}

/** Numbers are shown as written: no padding, at most three decimals. */
export function useNumber() {
  const { locale } = useLocale()
  return (value: number | null | undefined, digits = 3) => {
    if (value == null) return '-'
    return value.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US', { maximumFractionDigits: digits })
  }
}

/** Logged, empty sheet, and not submitted across the days of the range. */
export function CoverageBar({ logged, empty, days }: { logged: number; empty: number; days: number }) {
  const { t } = useLocale()
  const missing = Math.max(days - logged - empty, 0)
  const share = (count: number) => (days === 0 ? 0 : (count / days) * 100)
  return (
    <div className="qc-split">
      <div className="qc-split__bar" role="img" aria-label={`${t.logged} ${logged}, ${t.emptySheet} ${empty}, ${t.notSubmitted} ${missing}`}>
        <span className="qc-split__seg qc-split__seg--in" style={{ width: `${share(logged)}%` }} />
        <span className="qc-split__seg qc-split__seg--pending" style={{ width: `${share(empty)}%` }} />
        <span className="qc-split__seg qc-split__seg--empty" style={{ width: `${share(missing)}%` }} />
      </div>
      <span className="qc-split__counts">
        <span><i className="qc-key qc-key--in" aria-hidden="true" />{t.logged} {logged}</span>
        <span><i className="qc-key qc-key--pending" aria-hidden="true" />{t.emptySheet} {empty}</span>
        <span>{t.notSubmitted} {missing}</span>
      </span>
    </div>
  )
}
