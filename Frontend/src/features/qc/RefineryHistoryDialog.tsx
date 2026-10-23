import { useEffect, useRef, useState } from 'react'
import { api } from '../../data/api.ts'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDay } from '../../domain/format.ts'
import { historyFor, hourlyFor, type HistoryPoint, type HourlySheet, type SpotMark } from '../../domain/refineryQuality.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { useParam, type ParamCode } from './qcChrome.tsx'
import { Flow } from './qcVisual.tsx'

function axisDay(iso: string, locale: 'en' | 'id'): string {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

function fitDomain(values: number[]): [number, number] | undefined {
  if (values.length === 0) return undefined
  const low = Math.min(...values)
  const high = Math.max(...values)
  const pad = Math.max((high - low) * 0.25, 0.002)
  return [low - pad, high + pad]
}

function ClickDot({
  cx,
  cy,
  fill,
  payload,
  onDay,
}: {
  cx?: number
  cy?: number
  fill?: string
  payload?: { productionDate?: string }
  onDay: (date: string) => void
}) {
  if (cx == null || cy == null || !payload?.productionDate) return null
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={fill}
      stroke="#FFFFFF"
      strokeWidth={1.5}
      style={{ cursor: 'pointer' }}
      onClick={(event) => {
        event.stopPropagation()
        onDay(payload.productionDate as string)
      }}
    />
  )
}

type BandPoint = HistoryPoint & { label: string; band: [number, number] }

function BandTip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: BandPoint }> }) {
  const { t, locale } = useLocale()
  const param = useParam()
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="chart-tip">
      <strong>{formatDay(point.productionDate, locale)}</strong>
      <p>{t.rangeLow} {param('ffa', point.low)} %</p>
      <p>{t.rangeHigh} {param('ffa', point.high)} %</p>
      <p>{point.count} {t.hoursLogged.toLowerCase()}</p>
    </div>
  )
}

export function DailyQualityChart({
  start,
  end,
  oil,
  onDay,
  points: given,
}: {
  start: string
  end: string
  oil: string | null
  onDay: (date: string) => void
  points?: HistoryPoint[]
}) {
  const { t, locale } = useLocale()
  const param = useParam()
  const points = given ?? (oil ? historyFor(start, end, oil, 'lab.ffa', 'finished_good') : [])
  const data: BandPoint[] = points.map((point) => ({
    ...point,
    label: axisDay(point.productionDate, locale),
    band: [point.low, point.high],
  }))
  const domain = fitDomain(points.flatMap((point) => [point.low, point.high]))
  const open = (state: { activeIndex?: number | string | null } | null) => {
    const index = Number(state?.activeIndex)
    const date = Number.isInteger(index) ? data[index]?.productionDate : undefined
    if (date) onDay(date)
  }
  const title = `${oil ? `${oil} · ` : ''}${t.finishedFfa} %, ${t.dailyLowHigh}`
  return (
    <section className="prod-panel" aria-label={title}>
      <h2 className="card__title">{title}</h2>
      {points.length === 0 ? <p className="empty">-</p> : (
        <figure className="qc-figure chart-frame qty-chart">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} onClick={open} style={{ cursor: 'pointer' }}>
              <CartesianGrid stroke="#E0E0E0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} height={32} />
              <YAxis tick={{ fontSize: 11 }} width={56} domain={domain} tickFormatter={(value: number) => param('ffa', value)} />
              <Tooltip content={<BandTip />} />
              <Area
                type="monotone"
                dataKey="band"
                name={t.dailyLowHigh}
                stroke="#114C5A"
                strokeWidth={1}
                fill="#114C5A"
                fillOpacity={0.16}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="low"
                name={t.rangeLow}
                stroke="#114C5A"
                strokeOpacity={0}
                legendType="none"
                connectNulls={false}
                isAnimationActive={false}
                dot={<ClickDot fill="#114C5A" onDay={onDay} />}
                activeDot={<ClickDot fill="#114C5A" onDay={onDay} />}
              />
              <Line
                type="monotone"
                dataKey="high"
                name={t.rangeHigh}
                stroke="#114C5A"
                strokeOpacity={0}
                legendType="none"
                connectNulls={false}
                isAnimationActive={false}
                dot={<ClickDot fill="#114C5A" onDay={onDay} />}
                activeDot={<ClickDot fill="#114C5A" onDay={onDay} />}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <figcaption>{t.dailyBandCaption}</figcaption>
        </figure>
      )}
    </section>
  )
}

const useApi = import.meta.env.VITE_DATA_SOURCE === 'api'

function distinct(values: Array<string | null | undefined>): string {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].join(', ')
}

export function HourlyQualityDialog({
  date,
  oil,
  siteId,
  onClose,
}: {
  date: string | null
  oil: string | null
  siteId: string
  onClose: () => void
}) {
  const { t, locale } = useLocale()
  const param = useParam()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [remote, setRemote] = useState<HourlySheet | null>(null)
  useEffect(() => {
    if (!useApi || !date || !oil) return
    let cancelled = false
    setRemote(null)
    api<HourlySheet>(`/api/v1/sites/${siteId}/qc/refinery/hourly?date=${date}&oil=${encodeURIComponent(oil)}`)
      .then((sheet) => { if (!cancelled) setRemote(sheet) })
      .catch(() => { if (!cancelled) setRemote(null) })
    return () => { cancelled = true }
  }, [date, oil, siteId])
  const sheet = useApi ? remote : (date && oil ? hourlyFor(date, oil) : null)
  const values = sheet?.points.map((point) => point.finishedFfa).filter((value): value is number => value != null) ?? []
  const low = values.length ? Math.min(...values) : null
  const high = values.length ? Math.max(...values) : null
  const ownHours = sheet?.points.filter((point) => point.finishedOil === sheet.oil) ?? []

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (date && !dialog.open) dialog.showModal()
    if (!date && dialog.open) dialog.close()
  }, [date])

  return (
    <dialog ref={dialogRef} className="stock-dialog qty-dialog" onClose={onClose}>
      {sheet && (
        <>
          <h2>{sheet.oil} · {t.finishedFfa} %</h2>
          <p className="stock-dialog__updated">{formatDay(sheet.productionDate, locale)}</p>
          {ownHours.length > 0 ? (
            <Flow
              label={t.dayFlow}
              steps={[
                { kicker: t.fromTank, place: distinct(ownHours.map((point) => point.fromTank)) || null },
                { kicker: t.finishedOil, product: sheet.oil, value: low == null ? null : `FFA ${param('ffa', low)}–${param('ffa', high)} %` },
                { kicker: t.toTank, place: distinct(ownHours.map((point) => point.toTank)) || null },
              ]}
            />
          ) : null}
          <dl className="qty-stats">
            <div>
              <dt>{t.rangeLow}</dt>
              <dd>{param('ffa', low)}</dd>
            </div>
            <div>
              <dt>{t.rangeHigh}</dt>
              <dd>{param('ffa', high)}</dd>
            </div>
          </dl>
          <HourlyChart sheet={sheet} />
          <div className="stock-dialog__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>{t.close}</button>
          </div>
        </>
      )}
    </dialog>
  )
}

type HourPoint = {
  index: number
  time: string
  ffa: number | null
  oil: string | null
  fromTank: string | null
  toTank: string | null
}

function HourTip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: HourPoint }> }) {
  const { t } = useLocale()
  const param = useParam()
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="chart-tip">
      <strong>{point.time}{point.oil ? ` · ${point.oil}` : ''}</strong>
      <p>{t.finishedFfa} {point.ffa == null ? '-' : `${param('ffa', point.ffa)} %`}</p>
      <p>{point.fromTank ?? '-'} → {point.toTank ?? '-'}</p>
    </div>
  )
}

function productRuns(points: HourPoint[]): Array<{ oil: string; from: string; to: string }> {
  const runs: Array<{ oil: string; from: string; to: string }> = []
  for (const point of points) {
    if (!point.oil) continue
    const last = runs.at(-1)
    if (last && last.oil === point.oil) last.to = point.time
    else runs.push({ oil: point.oil, from: point.time, to: point.time })
  }
  return runs
}

function HourlyChart({ sheet }: { sheet: HourlySheet }) {
  const { t } = useLocale()
  const param = useParam()
  const data: HourPoint[] = sheet.points.map((point, index) => ({
    index,
    time: point.time,
    ffa: point.finishedFfa,
    oil: point.finishedOil ?? null,
    fromTank: point.fromTank ?? null,
    toTank: point.toTank ?? null,
  }))
  const runs = productRuns(data)
  const domain = fitDomain(data.flatMap((point) => (point.ffa == null ? [] : [point.ffa])))
  const lanes: Array<{ label: string; code: ParamCode; marks: SpotMark[] }> = [
    { label: t.feedFfa, code: 'ffa', marks: sheet.feed },
    { label: t.bleachRed, code: 'colorR', marks: sheet.bleach },
    { label: t.byproductFfa, code: 'ffa', marks: sheet.byproduct },
    { label: t.spentEarthOc, code: 'oc', marks: sheet.spentEarth },
  ]
  return (
    <>
      <figure className="qc-figure chart-frame qty-chart">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 18, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="#E0E0E0" vertical={false} />
            {runs.map((run) => (
              <ReferenceArea
                key={`${run.oil}-${run.from}`}
                x1={run.from}
                x2={run.to}
                fill={run.oil === sheet.oil ? '#114C5A' : '#9E9E9E'}
                fillOpacity={run.oil === sheet.oil ? 0.06 : 0.18}
                stroke="none"
                label={runs.length > 1 ? { value: run.oil, position: 'insideTopLeft', fontSize: 10, fill: '#6B6B6B' } : undefined}
              />
            ))}
            <XAxis dataKey="time" tick={{ fontSize: 11 }} height={32} interval={data.length > 14 ? 2 : 0} />
            <YAxis tick={{ fontSize: 11 }} width={56} domain={domain} tickFormatter={(value: number) => param('ffa', value)} />
            <Tooltip content={<HourTip />} />
            <Line
              type="monotone"
              dataKey="ffa"
              name={t.finishedFfa}
              stroke="#114C5A"
              strokeWidth={2}
              connectNulls={false}
              isAnimationActive={false}
              dot
            />
          </LineChart>
        </ResponsiveContainer>
        <figcaption>{t.hourlyCaption}</figcaption>
      </figure>
      <div className="rq-lanes">
        {lanes.map((lane) => (
          <div key={lane.label} className="rq-lane">
            <span className="rq-lane__name">{lane.label}</span>
            <div className="rq-lane__track">
              {lane.marks.length === 0 ? <span className="rq-lane__empty">{t.noSample}</span> : lane.marks.map((mark) => (
                <span
                  key={`${lane.label}-${mark.index}`}
                  className="rq-lane__mark"
                  style={{ left: `${(mark.index / Math.max(sheet.points.length - 1, 1)) * 100}%` }}
                >
                  {param(lane.code, mark.value)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
