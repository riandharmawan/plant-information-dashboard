import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../data/api.ts'
import { formatDay } from '../../domain/format.ts'
import {
  finishedOilFor,
  oilsInRange,
  refineryDates,
  snapshotFor,
  type HistoryPoint,
  type ReadingRow,
  type RefinerySnapshot,
} from '../../domain/refineryQuality.ts'
import { useAuth } from '../../data/AuthContext.tsx'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { DateRangeFilter } from '../daily-production/DateRangeFilter.tsx'
import { CommodityFilter } from '../live-ops/CommodityFilter.tsx'
import { DailyQualityChart, HourlyQualityDialog } from './RefineryHistoryDialog.tsx'
import { useParam, type ParamCode } from './qcChrome.tsx'
import { QcTabs } from './qcNav.tsx'
import { Flow, ProductPill, type FlowStep } from './qcVisual.tsx'

const useApi = import.meta.env.VITE_DATA_SOURCE === 'api'

type SortDir = 'asc' | 'desc'
type SortValue = string | number | null
type View = 'table' | 'cards'

function useColumnSort() {
  const [key, setKey] = useState<string | null>(null)
  const [dir, setDir] = useState<SortDir>('asc')
  const toggle = (next: string) => {
    if (key !== next) {
      setKey(next)
      setDir('asc')
      return
    }
    setDir((current) => (current === 'asc' ? 'desc' : 'asc'))
  }
  return { key, dir, toggle }
}

function sortRows(rows: ReadingRow[], key: string | null, dir: SortDir): ReadingRow[] {
  if (!key) return rows
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((left, right) => {
    const a = left[key as keyof ReadingRow] as SortValue
    const b = right[key as keyof ReadingRow] as SortValue
    if (a == null && b == null) return 0
    if (a == null) return 1
    if (b == null) return -1
    if (typeof a === 'number' && typeof b === 'number') return (a - b) * sign
    return String(a).localeCompare(String(b), undefined, { numeric: true }) * sign
  })
}

export function RefineryQualityPage() {
  const { t, locale } = useLocale()
  const { user } = useAuth()
  const dates = refineryDates()
  const [params, setParams] = useSearchParams()
  const from = params.get('from')
  const to = params.get('to')
  const start = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : (dates[0] ?? '2026-10-14')
  const end = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : (dates[dates.length - 1] ?? start)
  const setRange = (nextStart: string, nextEnd: string) => {
    const next = new URLSearchParams(params)
    next.set('from', nextStart <= nextEnd ? nextStart : nextEnd)
    next.set('to', nextStart <= nextEnd ? nextEnd : nextStart)
    setParams(next, { replace: true })
  }
  const siteId = user?.sites[0]?.id ?? 'bekasi'
  const localSnapshot = useMemo(() => snapshotFor(start, end), [start, end])
  const [remoteSnapshot, setRemoteSnapshot] = useState<RefinerySnapshot | null>(null)
  const [remoteHistory, setRemoteHistory] = useState<{ oil: string | null; oils: string[]; points: HistoryPoint[] } | null>(null)
  const [view, setView] = useState<View>('table')
  const [oils, setOils] = useState<string[] | null>(null)
  const [hourDate, setHourDate] = useState<string | null>(null)
  useEffect(() => {
    if (!useApi) return
    let cancelled = false
    const oilQuery = oils ? `&oils=${encodeURIComponent(oils.join(','))}` : ''
    Promise.all([
      api<RefinerySnapshot>(`/api/v1/sites/${siteId}/qc/refinery?from=${start}&to=${end}`),
      api<{ oil: string | null; oils: string[]; points: HistoryPoint[] }>(`/api/v1/sites/${siteId}/qc/refinery/history?from=${start}&to=${end}${oilQuery}`),
    ]).then(([snap, history]) => {
      if (cancelled) return
      setRemoteSnapshot(snap)
      setRemoteHistory(history)
    }).catch(() => {
      if (!cancelled) {
        setRemoteSnapshot(null)
        setRemoteHistory(null)
      }
    })
    return () => { cancelled = true }
  }, [siteId, start, end, oils])
  const emptySnapshot: RefinerySnapshot = {
    productionDate: null, reportDate: null, processUnit: null, processUnitName: null, declaredOils: '',
    hoursLogged: 0, figures: { finishedFfa: null, feedFfa: null, byproductFfa: null }, streams: [], oils: [], readings: [],
  }
  const snapshot = useApi ? (remoteSnapshot ?? emptySnapshot) : localSnapshot
  const families = useMemo(
    () => (useApi ? (remoteHistory?.oils ?? []) : oilsInRange(start, end)),
    [start, end, remoteHistory],
  )
  const chartOil = useApi ? (remoteHistory?.oil ?? null) : finishedOilFor(start, end, oils)
  const sort = useColumnSort()
  const visible = snapshot.readings.filter((row) => {
    if (oils == null) return true
    return oils.includes(row.feedOil ?? '') || oils.includes(row.finishedOil ?? '')
  })
  const rows = sortRows(visible, sort.key, sort.dir)
  const site = user?.sites[0]?.name ?? 'Priscolin Bekasi'
  const param = useParam()
  const flows = dayFlows(snapshot.readings, param, t)

  return (
    <div className="page page--prod page--ops">
      <header className="page-title-row">
        <h1 className="page-title">{t.refineryQuality}</h1>
        <span className="site-pill">
          <span className="site-pill__dot" aria-hidden="true" />
          {site}
        </span>
        <span className="page-meta">{snapshot.productionDate ? formatDay(snapshot.productionDate, locale) : '-'}</span>
        <DateRangeFilter start={start} end={end} dataDates={dates} onChange={setRange} />
      </header>
      <QcTabs start={start} end={end} />
      <section className="prod-kpis" aria-label={t.refineryQuality}>
        <Kpi label={t.hoursLogged} value={snapshot.productionDate ? String(snapshot.hoursLogged) : '-'} />
        <Kpi
          label={snapshot.figures.finishedFfa ? `${t.finishedFfa} %, ${snapshot.figures.finishedFfa.oil}` : `${t.finishedFfa} %`}
          value={snapshot.figures.finishedFfa ? band(param, snapshot.figures.finishedFfa.low, snapshot.figures.finishedFfa.high) : '-'}
        />
        <Kpi
          label={snapshot.figures.feedFfa ? `${t.feedFfa} %, ${snapshot.figures.feedFfa.oil}` : `${t.feedFfa} %`}
          value={snapshot.figures.feedFfa ? param('ffa', snapshot.figures.feedFfa.value) : '-'}
        />
        <Kpi label={`${t.byproductFfa} %`} value={snapshot.figures.byproductFfa ? param('ffa', snapshot.figures.byproductFfa.value) : '-'} />
      </section>
      {flows.length > 0 ? (
        <section className="prod-panel" aria-label={t.dayFlow}>
          <h2 className="card__title">
            {t.dayFlow}
            {snapshot.productionDate ? ` · ${formatDay(snapshot.productionDate, locale)}` : ''}
          </h2>
          <div className="qc-flows">
            {flows.map((steps, index) => <Flow key={index} label={t.dayFlow} steps={steps} />)}
          </div>
        </section>
      ) : null}
      <DailyQualityChart start={start} end={end} oil={chartOil} points={useApi ? (remoteHistory?.points ?? []) : undefined} onDay={setHourDate} />
      <section className="prod-panel">
        <div className="section-head">
          <h2 className="card__title">{t.readingsTitle}</h2>
          <div className="section-head__tools">
            <div className="view-toggle" role="group" aria-label={t.readingsTitle}>
              <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>{t.tableView}</button>
              <button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')}>{t.gridView}</button>
            </div>
            <CommodityFilter families={families} selected={oils} onChange={setOils} />
          </div>
        </div>
        {view === 'table' ? (
          <ReadingTable rows={rows} sort={sort} />
        ) : (
          <div className="tank-grid">
            {rows.map((row) => (
              <article key={row.time} className="tank-card">
                <header className="tank-card__head">
                  <strong>{row.time}</strong>
                  <ProductPill name={row.finishedOil} />
                </header>
                <Flow
                    compact
                    label={row.time}
                    steps={[
                      {
                        kicker: t.fromTank,
                        place: row.fromTank,
                        value: row.feedOil ? `${row.feedOil}${row.feedFfa == null ? '' : ` · ${param('ffa', row.feedFfa)} %`}` : null,
                      },
                      {
                        kicker: t.finishedOil,
                        place: row.finishedFfa == null ? '-' : `FFA ${param('ffa', row.finishedFfa)} %`,
                        value: row.colorR == null ? null : `R ${param('colorR', row.colorR)} · Y ${param('colorY', row.colorY)}`,
                      },
                      { kicker: t.toTank, place: row.toTank },
                    ]}
                  />
              </article>
            ))}
          </div>
        )}
      </section>
      <HourlyQualityDialog date={hourDate} oil={chartOil} siteId={siteId} onClose={() => setHourDate(null)} />
    </div>
  )
}

type Param = ReturnType<typeof useParam>

function band(param: Param, low: number, high: number): string {
  return low === high ? param('ffa', low) : `${param('ffa', low)}–${param('ffa', high)}`
}

function distinct(values: Array<string | null>): string | null {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].join(', ') || null
}

/** One flow per finished product on the day, so a changeover day shows two. */
function dayFlows(rows: ReadingRow[], param: Param, t: ReturnType<typeof useLocale>['t']): FlowStep[][] {
  if (rows.length === 0) return []
  const products = [...new Set(rows.map((row) => row.finishedOil).filter((oil): oil is string => Boolean(oil)))]
  const groups = products.length > 0
    ? products.map((oil) => ({ oil, hours: rows.filter((row) => row.finishedOil === oil) }))
    : [{ oil: null, hours: rows }]
  return groups.map(({ oil, hours }) => {
    const feedOils = [...new Set(hours.map((row) => row.feedOil).filter((name): name is string => Boolean(name)))]
    const feedSample = rows.find((row) => row.feedFfa != null && row.feedOil != null && feedOils.includes(row.feedOil))
    const finished = hours.map((row) => row.finishedFfa).filter((value): value is number => value != null)
    return [
      { kicker: t.fromTank, place: distinct(hours.map((row) => row.fromTank)) },
      { kicker: t.feedOil, product: feedOils.join(', ') || null, value: feedSample ? `FFA ${param('ffa', feedSample.feedFfa)} %` : null },
      {
        kicker: t.finishedOil,
        product: oil,
        value: finished.length ? `FFA ${band(param, Math.min(...finished), Math.max(...finished))} %` : null,
      },
      { kicker: t.toTank, place: distinct(hours.map((row) => row.toTank)) },
    ]
  })
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <article className="prod-kpi">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  )
}

function ReadingTable({
  rows,
  sort,
}: {
  rows: ReadingRow[]
  sort: { key: string | null; dir: SortDir; toggle: (column: string) => void }
}) {
  const { t } = useLocale()
  const param = useParam()
  const has = (key: keyof ReadingRow) => rows.some((row) => row[key] != null && row[key] !== '')
  type Column = { key: keyof ReadingRow; label: string; code?: ParamCode; product?: boolean }
  const all: Column[] = [
    { key: 'time', label: t.time },
    { key: 'fromTank', label: t.fromTank },
    { key: 'flowRate', label: t.flowRate, code: 'flow' },
    { key: 'feedOil', label: t.feedOil, product: true },
    { key: 'feedFfa', label: `${t.feedFfa} %`, code: 'ffa' },
    { key: 'feedMoisture', label: `${t.moisture} %`, code: 'moisture' },
    { key: 'feedDobi', label: t.dobi, code: 'dobi' },
    { key: 'finishedOil', label: t.finishedOil, product: true },
    { key: 'finishedFfa', label: `${t.finishedFfa} %`, code: 'ffa' },
    { key: 'colorR', label: t.colourRLov, code: 'colorR' },
    { key: 'colorY', label: t.colourYLov, code: 'colorY' },
    { key: 'toTank', label: t.toTank },
    { key: 'remark', label: t.remark },
  ]
  const columns = all.filter((column) => column.key === 'time' || has(column.key))
  return (
    <div className="prod-scroll">
      <table className="prod-table">
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sort.key === column.key
              const mark = active ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'
              return (
                <th key={column.key} className={column.code ? 'num' : undefined} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="prod-sort" onClick={() => sort.toggle(column.key)}>
                    {column.label}
                    <span className={active ? 'prod-sort__mark prod-sort__mark--on' : 'prod-sort__mark'}>{mark}</span>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.time}>
              {columns.map((column) => {
                const value = row[column.key]
                if (column.code) {
                  const number = typeof value === 'number' ? value : null
                  return <td key={column.key} className={number == null ? 'num num--empty' : 'num'}>{param(column.code, number)}</td>
                }
                if (column.product) {
                  return <td key={column.key}>{value ? <ProductPill name={String(value)} /> : '-'}</td>
                }
                return <td key={column.key} className={column.key === 'remark' ? 'qc-wrap' : undefined}>{value || '-'}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
