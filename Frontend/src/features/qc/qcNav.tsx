import { useState } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { QC_DATES } from '../../domain/qc.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import type { Messages } from '../../i18n/messages.ts'
import { recentWindow } from '../usePeriodRange.ts'

const QC_RECENT_DAYS = 30

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

const TABS: Array<{ path: string; label: keyof Messages; end?: boolean }> = [
  { path: '/qc', label: 'qcTitle', end: true },
  { path: '/qc/storage', label: 'qcStorage' },
  { path: '/qc/vessel', label: 'qcVessel' },
  { path: '/qc/truck', label: 'qcTruck' },
]

function isIsoDate(value: string | null): value is string {
  if (!value) return false
  const match = ISO_DATE.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function qcSearch(start: string, end: string): string {
  const from = start <= end ? start : end
  const to = start <= end ? end : start
  return `?from=${from}&to=${to}`
}

export function useQcRange() {
  const [params, setParams] = useSearchParams()
  const boundsStart = QC_DATES[0] ?? '2026-08-18'
  const boundsEnd = QC_DATES[QC_DATES.length - 1] ?? boundsStart
  const window = recentWindow({ start: boundsStart, end: boundsEnd }, QC_RECENT_DAYS)
  const from = params.get('from')
  const to = params.get('to')
  const start = isIsoDate(from) ? from : window.start
  const end = isIsoDate(to) ? to : window.end

  const setRange = (nextStart: string, nextEnd: string) => {
    const next = new URLSearchParams(params)
    const fromDate = nextStart <= nextEnd ? nextStart : nextEnd
    const toDate = nextStart <= nextEnd ? nextEnd : nextStart
    next.set('from', fromDate)
    next.set('to', toDate)
    setParams(next, { replace: true })
  }

  return { start, end, setRange }
}

export function QcTabs({ start, end }: { start: string; end: string }) {
  const { t } = useLocale()
  const search = qcSearch(start, end)
  return (
    <nav className="prod-tabs" aria-label={t.qualityControl}>
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

export type SortDir = 'asc' | 'desc'
export type SortValue = string | number | null

export function useColumnSort() {
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

export function sortRows<T>(rows: T[], key: string | null, dir: SortDir, valueOf: (row: T, key: string) => SortValue): T[] {
  if (!key) return rows
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((left, right) => {
    const a = valueOf(left, key)
    const b = valueOf(right, key)
    if (a == null && b == null) return 0
    if (a == null) return 1
    if (b == null) return -1
    if (typeof a === 'number' && typeof b === 'number') return (a - b) * sign
    return String(a).localeCompare(String(b), undefined, { numeric: true }) * sign
  })
}

export function SortHeader({
  label,
  column,
  sort,
  align = 'left',
}: {
  label: string
  column: string
  sort: { key: string | null; dir: SortDir; toggle: (column: string) => void }
  align?: 'left' | 'right'
}) {
  const active = sort.key === column
  const mark = active ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'
  return (
    <th className={align === 'right' ? 'num' : undefined} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="prod-sort" onClick={() => sort.toggle(column)}>
        {label}
        <span className={active ? 'prod-sort__mark prod-sort__mark--on' : 'prod-sort__mark'}>{mark}</span>
      </button>
    </th>
  )
}
