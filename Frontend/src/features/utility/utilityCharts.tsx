import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../../data/api.ts'
import { formatDay } from '../../domain/format.ts'
import { hasLimit, outsidePrinted, type TagInfo, type UtilityDay, type UtilityReading } from '../../domain/utility.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { Bullet, fill } from '../qc/qcVisual.tsx'
import { addDays } from '../usePeriodRange.ts'
import { useNumber } from './utilityShell.tsx'

export type DayBand = { date: string; low: number | null; high: number | null; count: number }

export function rangeDays(start: string, end: string): string[] {
  const days: string[] = []
  for (let day = start; day <= end && days.length < 400; day = addDays(day, 1)) days.push(day)
  return days
}

export function axisDay(iso: string, locale: 'en' | 'id'): string {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

function fitDomain(values: number[], limits: Array<number | null> = []): [number, number] | undefined {
  const all = [...values, ...limits.filter((value): value is number => value != null)]
  if (all.length === 0) return undefined
  const low = Math.min(...all)
  const high = Math.max(...all)
  const pad = Math.max((high - low) * 0.15, Math.abs(high) * 0.02, 0.01)
  const step = 10 ** Math.floor(Math.log10(high - low + 2 * pad)) / 2
  return [Math.floor((low - pad) / step) * step, Math.ceil((high + pad) / step) * step]
}

export function tagLabel(info: TagInfo): string {
  return `${info.name ?? info.tag ?? '-'}${info.unit ? ` (${info.unit})` : ''}`
}

/** One value against the range printed in its own tag, or against its own range across the period when the tag prints none. */
export function PrintedBullet({
  info,
  label,
  value,
  values,
  onOpen,
}: {
  info: TagInfo
  label?: string
  value: number | null
  /** Values of the same test across the range, used when the tag prints no range. */
  values: number[]
  onOpen?: () => void
}) {
  const { t } = useLocale()
  const number = useNumber()
  const name = label ?? tagLabel(info)
  const wrap = (node: ReactNode) => (
    onOpen ? (
      <button type="button" className="qc-bullet--button" title={t.kpiDetailHint} onClick={onOpen}>{node}</button>
    ) : node
  )
  if (hasLimit(info)) {
    return wrap(
      <Bullet
        label={name}
        value={value}
        format={(next) => number(next)}
        context={{ kind: 'limit', min: info.min, max: info.max, tone: 'watch' }}
        caption={fill(t.printedRange, { spec: info.spec ?? '-' })}
        statusLabel={t.outsidePrinted}
      />,
    )
  }
  const range = values.length > 0 ? { low: Math.min(...values), high: Math.max(...values), count: values.length } : null
  return wrap(
    <Bullet
      label={name}
      value={value}
      format={(next) => number(next)}
      context={{ kind: 'range', range, caption: fill(t.periodRange, { count: values.length }) }}
    />,
  )
}

type BandPoint = { date: string; label: string; band: [number, number] | null; low: number | null; high: number | null; count: number }

function BandTip({ active, payload, unit }: { active?: boolean; payload?: Array<{ payload?: BandPoint }>; unit: string }) {
  const { t, locale } = useLocale()
  const number = useNumber()
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="chart-tip">
      <strong>{formatDay(point.date, locale)}</strong>
      {point.count === 0 ? <p>{t.notLogged}</p> : (
        <>
          <p>{t.rangeLow} {number(point.low)}{unit}</p>
          <p>{t.rangeHigh} {number(point.high)}{unit}</p>
          <p>{fill(t.readingCount, { count: point.count })}</p>
        </>
      )}
    </div>
  )
}

/** Daily low and high as one shaded band. A day without a log breaks the band. */
export function DailyBandChart({
  bands,
  start,
  end,
  unit,
  min,
  max,
  onDay,
  height = 240,
}: {
  bands: DayBand[]
  start: string
  end: string
  unit?: string | null
  min?: number | null
  max?: number | null
  onDay?: (date: string) => void
  height?: number
}) {
  const { locale } = useLocale()
  const number = useNumber()
  const byDate = new Map(bands.map((band) => [band.date, band]))
  const data: BandPoint[] = rangeDays(start, end).map((date) => {
    const band = byDate.get(date)
    const low = band?.low ?? null
    const high = band?.high ?? null
    return { date, label: axisDay(date, locale), band: low != null && high != null ? [low, high] : null, low, high, count: band?.count ?? 0 }
  })
  const domain = fitDomain(bands.flatMap((band) => [band.low, band.high].filter((value): value is number => value != null)), [min ?? null, max ?? null])
  const suffix = unit ? ` ${unit}` : ''
  const open = (state: { activeIndex?: number | string | null } | null) => {
    if (state?.activeIndex == null) return
    const point = data[Number(state.activeIndex)]
    if (point && point.count > 0) onDay?.(point.date)
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} onClick={onDay ? open : undefined} style={onDay ? { cursor: 'pointer' } : undefined}>
        <CartesianGrid stroke="#E0E0E0" vertical={false} />
        {min != null && max != null ? <ReferenceArea y1={min} y2={max} fill="#C4C4C4" fillOpacity={0.3} stroke="none" ifOverflow="extendDomain" /> : null}
        {min != null && max == null ? <ReferenceLine y={min} stroke="#92600a" strokeDasharray="4 3" /> : null}
        {max != null && min == null ? <ReferenceLine y={max} stroke="#92600a" strokeDasharray="4 3" /> : null}
        <XAxis dataKey="label" tick={{ fontSize: 11 }} height={32} />
        <YAxis tick={{ fontSize: 11 }} width={60} domain={domain} tickFormatter={(value: number) => number(value, 2)} />
        <Tooltip content={<BandTip unit={suffix} />} />
        <Area type="monotone" dataKey="band" stroke="#114C5A" strokeWidth={1} fill="#114C5A" fillOpacity={0.16} connectNulls={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="high" stroke="#114C5A" strokeWidth={1.5} connectNulls={false} isAnimationActive={false} dot={{ r: 2.5 }} />
        <Line type="monotone" dataKey="low" stroke="#114C5A" strokeWidth={1.5} strokeOpacity={0.5} connectNulls={false} isAnimationActive={false} dot={{ r: 2.5 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export type Series = {
  key: string
  name: string
  kind: 'line' | 'bar'
  color: string
  axis?: 'left' | 'right'
}

/** One point per calendar day of the range, so a day without a sheet is a gap and never a zero. */
export function DailySeriesChart<T extends { date: string }>({
  rows,
  start,
  end,
  series,
  height = 240,
}: {
  rows: T[]
  start: string
  end: string
  series: Series[]
  height?: number
}) {
  const { locale } = useLocale()
  const number = useNumber()
  const byDate = new Map(rows.map((row) => [row.date, row]))
  const data = rangeDays(start, end).map((date) => {
    const row = byDate.get(date) as Record<string, unknown> | undefined
    const point: Record<string, string | number | null> = { date, label: axisDay(date, locale) }
    for (const item of series) {
      const value = row?.[item.key]
      point[item.key] = typeof value === 'number' ? value : null
    }
    return point
  })
  const right = series.some((item) => item.axis === 'right')
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="#E0E0E0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} height={32} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} width={64} tickFormatter={(value: number) => number(value, 1)} />
        {right ? <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} width={56} tickFormatter={(value: number) => number(value, 1)} /> : null}
        <Tooltip formatter={(value, name) => [number(value == null ? null : Number(value)), name]} labelFormatter={(label) => String(label)} />
        {series.map((item) => (item.kind === 'bar' ? (
          <Bar key={item.key} yAxisId={item.axis ?? 'left'} dataKey={item.key} name={item.name} fill={item.color} isAnimationActive={false} />
        ) : (
          <Line
            key={item.key}
            yAxisId={item.axis ?? 'left'}
            type="monotone"
            dataKey={item.key}
            name={item.name}
            stroke={item.color}
            strokeWidth={2}
            connectNulls={false}
            isAnimationActive={false}
            dot={{ r: 2.5 }}
          />
        )))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function bandsOf(readings: UtilityReading[]): DayBand[] {
  const days = new Map<string, number[]>()
  for (const row of readings) {
    if (row.value == null) continue
    days.set(row.date, [...(days.get(row.date) ?? []), row.value])
  }
  return [...days.entries()].map(([date, values]) => ({ date, low: Math.min(...values), high: Math.max(...values), count: values.length }))
}

/** A lab test across the range: daily low–high against the printed band, then every result as written. */
export function ReadingHistoryDialog({
  readings,
  title,
  start,
  end,
  onClose,
}: {
  readings: UtilityReading[] | null
  title: string
  start: string
  end: string
  onClose: () => void
}) {
  const { t, locale } = useLocale()
  const number = useNumber()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const info = readings?.[0] ?? null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (readings && !dialog.open) dialog.showModal()
    if (!readings && dialog.open) dialog.close()
  }, [readings])

  const values = (readings ?? []).flatMap((row) => (row.value == null ? [] : [row.value]))
  const unit = info?.unit ? ` ${info.unit}` : ''
  return (
    <dialog ref={dialogRef} className="stock-dialog qty-dialog" onClose={onClose}>
      {readings && info && (
        <>
          <h2>{title}</h2>
          <p className="stock-dialog__updated">
            {formatDay(start, locale)} – {formatDay(end, locale)}
            {info.spec ? ` · ${fill(t.printedRange, { spec: info.spec })}` : ''}
          </p>
          <dl className="qty-stats">
            <div><dt>{t.rangeLow}</dt><dd>{values.length ? `${number(Math.min(...values))}${unit}` : '-'}</dd></div>
            <div><dt>{t.rangeHigh}</dt><dd>{values.length ? `${number(Math.max(...values))}${unit}` : '-'}</dd></div>
            <div><dt>{t.outsidePrinted}</dt><dd>{hasLimit(info) ? readings.filter(outsidePrinted).length : '-'}</dd></div>
          </dl>
          <figure className="qc-figure chart-frame qty-chart">
            <DailyBandChart bands={bandsOf(readings)} start={start} end={end} unit={info.unit} min={info.min} max={info.max} />
            <figcaption>{t.labBandCaption}</figcaption>
          </figure>
          <div className="qc-dialog__scroll">
            <table className="prod-table prod-table--fit">
              <thead>
                <tr>
                  <th>{t.date}</th>
                  <th>{t.shift}</th>
                  <th className="num">{t.resultValue}</th>
                  <th>{t.remark}</th>
                </tr>
              </thead>
              <tbody>
                {[...readings].reverse().map((row, index) => (
                  <tr key={`${row.date}-${row.shift}-${index}`}>
                    <td>{formatDay(row.date, locale)}</td>
                    <td>{row.shift ?? row.time ?? '-'}</td>
                    <td className={row.value == null && !row.text ? 'num num--empty' : outsidePrinted(row) ? 'num num--watch' : 'num'}>
                      {row.value == null ? (row.text ?? '-') : number(row.value)}
                    </td>
                    <td className="qc-wrap">{row.remark ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="stock-dialog__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>{t.close}</button>
          </div>
        </>
      )}
    </dialog>
  )
}

export type OpenTag = { form: string; info: TagInfo; group: string | null }

/** A boiler tag across the range, low to high per day. Clicking a day loads that day by hour. */
export function TagHistoryDialog({
  open,
  bands,
  start,
  end,
  siteId,
  onClose,
}: {
  open: OpenTag | null
  bands: DayBand[]
  start: string
  end: string
  siteId: string
  onClose: () => void
}) {
  const { t, locale } = useLocale()
  const number = useNumber()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [hourDate, setHourDate] = useState<string | null>(null)
  const [day, setDay] = useState<UtilityDay | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
    if (!open) setHourDate(null)
  }, [open])

  useEffect(() => {
    if (!open || !hourDate) return
    let cancelled = false
    setDay(null)
    api<UtilityDay>(`/api/v1/sites/${siteId}/utility/day?form=${encodeURIComponent(open.form)}&date=${hourDate}`)
      .then((next) => { if (!cancelled) setDay(next) })
      .catch(() => { if (!cancelled) setDay(null) })
    return () => { cancelled = true }
  }, [open, hourDate, siteId])

  const values = bands.flatMap((band) => [band.low, band.high].filter((value): value is number => value != null))
  const hourly = day && open
    ? day.readings.filter((row) => row.tag === open.info.tag && row.group === open.group).map((row) => ({ time: row.time ?? '-', value: row.value, text: row.text }))
    : []
  const unit = open?.info.unit ? ` ${open.info.unit}` : ''

  return (
    <dialog ref={dialogRef} className="stock-dialog qty-dialog" onClose={onClose}>
      {open && (
        <>
          <h2>{open.info.name ?? open.info.tag}</h2>
          <p className="stock-dialog__updated">
            {formatDay(start, locale)} – {formatDay(end, locale)}
            {open.info.spec ? ` · ${fill(t.printedRange, { spec: open.info.spec })}` : ''}
          </p>
          <dl className="qty-stats">
            <div><dt>{t.rangeLow}</dt><dd>{values.length ? `${number(Math.min(...values))}${unit}` : '-'}</dd></div>
            <div><dt>{t.rangeHigh}</dt><dd>{values.length ? `${number(Math.max(...values))}${unit}` : '-'}</dd></div>
            <div><dt>{t.daysLogged}</dt><dd>{bands.filter((band) => band.count > 0).length}</dd></div>
          </dl>
          <figure className="qc-figure chart-frame qty-chart">
            <DailyBandChart bands={bands} start={start} end={end} unit={open.info.unit} min={open.info.min} max={open.info.max} onDay={setHourDate} />
            <figcaption>{t.dailyBandCaption}</figcaption>
          </figure>
          {hourDate ? (
            <figure className="qc-figure chart-frame qty-chart">
              <h3 className="qc-dialog__chart-title">{formatDay(hourDate, locale)} · {t.byHour}</h3>
              {!day ? <p className="page-note">{t.loading}</p> : hourly.length === 0 ? <p className="empty">{t.notRecorded}</p> : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={hourly} margin={{ top: 8, right: 20, left: 8, bottom: 0 }}>
                    <CartesianGrid stroke="#E0E0E0" vertical={false} />
                    {open.info.min != null && open.info.max != null ? (
                      <ReferenceArea y1={open.info.min} y2={open.info.max} fill="#C4C4C4" fillOpacity={0.3} stroke="none" ifOverflow="extendDomain" />
                    ) : null}
                    {open.info.max != null && open.info.min == null ? <ReferenceLine y={open.info.max} stroke="#92600a" strokeDasharray="4 3" /> : null}
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} height={32} interval={hourly.length > 14 ? 2 : 0} />
                    <YAxis tick={{ fontSize: 11 }} width={60} domain={fitDomain(hourly.flatMap((row) => (row.value == null ? [] : [row.value])))} tickFormatter={(value: number) => number(value, 2)} />
                    <Tooltip formatter={(value) => [`${number(value == null ? null : Number(value))}${unit}`, open.info.name ?? '']} />
                    <Line type="monotone" dataKey="value" stroke="#114C5A" strokeWidth={2} connectNulls={false} isAnimationActive={false} dot />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </figure>
          ) : null}
          <div className="stock-dialog__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>{t.close}</button>
          </div>
        </>
      )}
    </dialog>
  )
}
