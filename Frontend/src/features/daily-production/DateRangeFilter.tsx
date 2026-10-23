import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react'
import { DATA_DATES } from '../../domain/dailyProduction.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'

function isoOf(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function parseIso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

function weeksOf(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const cursor = new Date(year, month, 1 - offset)
  const weeks: Date[][] = []
  for (let week = 0; week < 6; week += 1) {
    const days: Date[] = []
    for (let day = 0; day < 7; day += 1) {
      days.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(days)
  }
  return weeks
}

function monthBounds(iso: string): { start: string; end: string } {
  const date = parseIso(iso)
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { start: isoOf(start), end: isoOf(end) }
}

function isWholeMonth(start: string, end: string): boolean {
  const from = start <= end ? start : end
  const to = start <= end ? end : start
  const bounds = monthBounds(from)
  return bounds.start === from && bounds.end === to
}

export function DateRangeFilter({
  start,
  end,
  onChange,
  dataDates,
  monthChoice = false,
  single = false,
}: {
  start: string
  end: string
  onChange: (start: string, end: string) => void
  /** Days that show the logsheet dot. Defaults to the daily-production dates. */
  dataDates?: readonly string[]
  /** Daily production summary: switch between a day calendar and a month. */
  monthChoice?: boolean
  /** Pick one day. `onChange` gets the same day twice. */
  single?: boolean
}) {
  const { t, locale } = useLocale()
  const marked = useMemo(() => new Set(dataDates ?? DATA_DATES), [dataDates])
  const dateLocale = locale === 'id' ? 'id-ID' : 'en-GB'
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [alignStart, setAlignStart] = useState(false)
  const [picking, setPicking] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const [view, setView] = useState(() => parseIso(start))
  const [mode, setMode] = useState<'day' | 'month'>(() => (monthChoice && isWholeMonth(start, end) ? 'month' : 'day'))

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return
    const rect = rootRef.current.getBoundingClientRect()
    setAlignStart(rect.right - 280 < 8)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setPicking(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setPicking(false)
      }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const formatDay = (iso: string) => parseIso(iso).toLocaleDateString(dateLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const formatMonth = (iso: string) => parseIso(iso).toLocaleDateString(dateLocale, {
    month: 'long',
    year: 'numeric',
  })
  const fromDate = start <= end ? start : end
  const toDate = start <= end ? end : start
  const chip = mode === 'month'
    ? formatMonth(fromDate)
    : single || fromDate === toDate ? formatDay(toDate) : `${formatDay(fromDate)} – ${formatDay(toDate)}`
  const weekday = (index: number) => {
    const monday = new Date(2026, 0, 5 + index)
    return monday.toLocaleDateString(dateLocale, { weekday: 'short' }).replace('.', '').slice(0, 2)
  }

  const from = single ? toDate : picking && hover ? (start < hover ? start : hover) : fromDate
  const to = single ? toDate : picking && hover ? (start < hover ? hover : start) : toDate
  const weeks = weeksOf(view.getFullYear(), view.getMonth())
  const selectedMonth = parseIso(fromDate).getMonth()
  const selectedYear = parseIso(fromDate).getFullYear()

  const choose = (iso: string) => {
    if (single) {
      onChange(iso, iso)
      setHover(null)
      setOpen(false)
      return
    }
    if (!picking) {
      onChange(iso, iso)
      setPicking(true)
      setView(parseIso(iso))
      return
    }
    onChange(start <= iso ? start : iso, start <= iso ? iso : start)
    setPicking(false)
    setHover(null)
    setOpen(false)
  }

  const chooseMonth = (month: number) => {
    const first = isoOf(new Date(view.getFullYear(), month, 1))
    const bounds = monthBounds(first)
    onChange(bounds.start, bounds.end)
    setOpen(false)
  }

  const selectMode = (next: 'day' | 'month') => {
    setPicking(false)
    setHover(null)
    setView(parseIso(fromDate))
    if (next === mode) {
      setOpen(true)
      return
    }
    setMode(next)
    setOpen(false)
    if (next === 'month') {
      const bounds = monthBounds(fromDate)
      if (bounds.start !== fromDate || bounds.end !== toDate) onChange(bounds.start, bounds.end)
      return
    }
    if (isWholeMonth(fromDate, toDate)) {
      const prefix = fromDate.slice(0, 7)
      const firstMarked = [...marked].filter((iso) => iso.startsWith(prefix)).sort()[0]
      onChange(firstMarked ?? fromDate, firstMarked ?? fromDate)
    }
  }

  const monthHasData = (month: number) => {
    const prefix = `${view.getFullYear()}-${String(month + 1).padStart(2, '0')}`
    return [...marked].some((iso) => iso.startsWith(prefix))
  }

  return (
    <div className="range-filter" ref={rootRef}>
      {monthChoice && (
        <div className="range-mode" role="group" aria-label={t.period}>
          <button
            type="button"
            className={mode === 'day' ? 'range-mode__btn range-mode__btn--on' : 'range-mode__btn'}
            aria-pressed={mode === 'day'}
            onClick={() => selectMode('day')}
          >
            {t.periodDaily}
          </button>
          <button
            type="button"
            className={mode === 'month' ? 'range-mode__btn range-mode__btn--on' : 'range-mode__btn'}
            aria-pressed={mode === 'month'}
            onClick={() => selectMode('month')}
          >
            {t.periodMonthly}
          </button>
        </div>
      )}
      <button
        type="button"
        className="filter-chip range-filter__trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${single ? t.selectDay : t.period} ${chip}`}
        onClick={() => {
          setOpen((current) => !current)
          setPicking(false)
          setView(parseIso(single ? toDate : fromDate))
        }}
      >
        {single ? <CalendarDays size={14} aria-hidden="true" /> : <CalendarRange size={14} aria-hidden="true" />}
        <span>{single ? t.selectDay : t.period}</span>
        <strong>{chip}</strong>
      </button>
      {open && (
        <div className={alignStart ? 'range-filter__popover range-filter__popover--start' : 'range-filter__popover'} role="dialog" aria-label={t.period}>
          {mode === 'month' ? (
            <>
              <div className="range-cal__head">
                <button
                  type="button"
                  className="range-cal__nav"
                  aria-label={t.previousPage}
                  onClick={() => setView(new Date(view.getFullYear() - 1, view.getMonth(), 1))}
                >
                  <ChevronLeft size={16} />
                </button>
                <strong>{view.getFullYear()}</strong>
                <button
                  type="button"
                  className="range-cal__nav"
                  aria-label={t.nextPage}
                  onClick={() => setView(new Date(view.getFullYear() + 1, view.getMonth(), 1))}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="range-cal__months">
                {Array.from({ length: 12 }, (_, month) => {
                  const label = new Date(view.getFullYear(), month, 1).toLocaleDateString(dateLocale, { month: 'short' })
                  const selected = view.getFullYear() === selectedYear && month === selectedMonth && isWholeMonth(fromDate, toDate)
                  const hasData = monthHasData(month)
                  return (
                    <button
                      key={month}
                      type="button"
                      className={selected ? 'range-cal__month range-cal__month--on' : 'range-cal__month'}
                      aria-pressed={selected}
                      aria-label={hasData ? `${formatMonth(isoOf(new Date(view.getFullYear(), month, 1)))}. ${t.dataDay}` : formatMonth(isoOf(new Date(view.getFullYear(), month, 1)))}
                      onClick={() => chooseMonth(month)}
                    >
                      {label}
                      {hasData && <span className="range-cal__mark" />}
                    </button>
                  )
                })}
              </div>
              <p className="range-cal__legend">
                <span className="range-cal__dot" />
                {t.dataDay}
              </p>
            </>
          ) : (
            <>
          <div className="range-cal__head">
            <button
              type="button"
              className="range-cal__nav"
              aria-label={t.previousPage}
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
            >
              <ChevronLeft size={16} />
            </button>
            <strong>
              {view.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })}
            </strong>
            <button
              type="button"
              className="range-cal__nav"
              aria-label={t.nextPage}
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="range-cal__grid" role="row">
            {Array.from({ length: 7 }, (_, index) => (
              <span key={index} className="range-cal__weekday">{weekday(index)}</span>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={isoOf(week[0])} className="range-cal__grid" role="row">
              {week.map((date) => {
                const iso = isoOf(date)
                const outside = date.getMonth() !== view.getMonth()
                const hasData = marked.has(iso)
                const edge = iso === from || iso === to
                const inside = iso > from && iso < to
                const cellClass = [
                  'range-cal__cell',
                  inside ? 'range-cal__cell--in' : '',
                  iso === from && from !== to ? 'range-cal__cell--start' : '',
                  iso === to && from !== to ? 'range-cal__cell--end' : '',
                ].filter(Boolean).join(' ')
                const dayClass = [
                  'range-cal__day',
                  outside ? 'range-cal__day--out' : '',
                  edge ? 'range-cal__day--edge' : '',
                ].filter(Boolean).join(' ')
                return (
                  <span key={iso} className={cellClass}>
                    <button
                      type="button"
                      className={dayClass}
                      aria-label={hasData ? `${formatDay(iso)}. ${t.dataDay}` : formatDay(iso)}
                      aria-pressed={edge}
                      onMouseEnter={() => setHover(iso)}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => choose(iso)}
                    >
                      {date.getDate()}
                      {hasData && <span className="range-cal__mark" />}
                    </button>
                  </span>
                )
              })}
            </div>
          ))}
          <p className="range-cal__legend">
            <span className="range-cal__dot" />
            {t.dataDay}
          </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
