import { useEffect, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useRepository } from '../../data/OperationsContext.tsx'
import { formatDay, formatKg, formatMeasure, tankLabel } from '../../domain/format.ts'
import { profileOf } from '../../domain/tankStock.ts'
import type { LabHistoryPoint, SoundingPoint } from '../../domain/types.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { historySeries, isLabMetric, labHistorySeries, type HistoryDay, type HistoryMetric } from './quantitySeries.ts'

export function QuantityHistoryDialog({
  tankId,
  commodity,
  metric,
  start,
  end,
  onClose,
}: {
  tankId: string | null
  commodity: string
  metric: HistoryMetric
  start: string
  end: string
  onClose: () => void
}) {
  const { t, locale } = useLocale()
  const repository = useRepository()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [soundings, setSoundings] = useState<{ tankId: string; points: SoundingPoint[] } | null>(null)
  const [labs, setLabs] = useState<{ tankId: string; points: LabHistoryPoint[] } | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (tankId && !dialog.open) dialog.showModal()
    if (!tankId && dialog.open) dialog.close()
  }, [tankId])

  useEffect(() => {
    if (!tankId) return
    let active = true
    if (isLabMetric(metric)) {
      repository.getLabHistory(tankId).then((next) => {
        if (active) setLabs({ tankId, points: next })
      })
    } else {
      repository.getSoundingHistory(tankId).then((next) => {
        if (active) setSoundings({ tankId, points: next })
      })
    }
    return () => {
      active = false
    }
  }, [repository, tankId, metric])

  const series = !tankId
    ? []
    : isLabMetric(metric)
      ? labHistorySeries(labs?.tankId === tankId ? labs.points : [], start, end, metric === 'ffa' ? 'FFA' : 'MI')
      : historySeries(tankId, soundings?.tankId === tankId ? soundings.points : [], start, end, metric)
  const hasValue = series.some((point) => point.value != null)
  const stats = seriesStats(series)
  const bottomStock = metric === 'loadable' ? profileOf(tankId ?? '')?.bottomStockKg ?? null : null
  const title = metricTitle(metric, t)

  return (
    <dialog ref={dialogRef} className="stock-dialog qty-dialog" onClose={onClose}>
      {tankId && (
        <>
          <h2>{dialogHeading(tankId, commodity, title)}</h2>
          <p className="stock-dialog__updated">{formatDay(start, locale)} – {formatDay(end, locale)}</p>
          <dl className="qty-stats">
            <div>
              <dt>{t.rangeAverage}</dt>
              <dd>{stats ? formatTip(metric, stats.average) : t.unavailable}</dd>
            </div>
            <div>
              <dt>{t.rangeMax}</dt>
              <dd>{stats ? formatTip(metric, stats.max) : t.unavailable}</dd>
            </div>
            <div>
              <dt>{t.rangeMin}</dt>
              <dd>{stats ? formatTip(metric, stats.min) : t.unavailable}</dd>
            </div>
            {metric === 'loadable' && (
              <div>
                <dt>{t.bottomStock}</dt>
                <dd>{bottomStock == null ? t.unavailable : `${formatKg(bottomStock)} kg`}</dd>
              </div>
            )}
          </dl>
          {hasValue
            ? <QuantityChart series={series} metric={metric} title={title} />
            : <p className="empty">{t.unavailable}</p>}
          <ul className="qty-legend">
            <li><span className="qty-dot qty-dot--measured" aria-hidden="true" />{isLabMetric(metric) ? t.analysisDay : t.soundingDay}</li>
          </ul>
          <div className="stock-dialog__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>{t.close}</button>
          </div>
        </>
      )}
    </dialog>
  )
}

function seriesStats(series: HistoryDay[]): { average: number; max: number; min: number } | null {
  const values = series.flatMap((point) => (point.kind === 'measured' && point.value != null ? [point.value] : []))
  if (values.length === 0) return null
  const sum = values.reduce((total, value) => total + value, 0)
  return { average: sum / values.length, max: Math.max(...values), min: Math.min(...values) }
}

function dialogHeading(tankId: string, commodity: string, metricLabel: string): string {
  const tank = tankLabel(tankId)
  if (!commodity) return `${tank} - ${metricLabel}`
  return `${tank} - ${commodity} - ${metricLabel}`
}

function metricTitle(metric: HistoryMetric, t: { levelAxis: string; quantity: string; emptySpace: string; loadable: string; tankLevelPct: string; tempAxis: string }): string {
  if (metric === 'level') return t.levelAxis
  if (metric === 'quantity') return t.quantity
  if (metric === 'emptySpace') return t.emptySpace
  if (metric === 'loadable') return t.loadable
  if (metric === 'levelTank') return t.tankLevelPct
  if (metric === 'temperature') return t.tempAxis
  if (metric === 'ffa') return 'FFA'
  return 'M&I'
}

function QuantityChart({ series, metric, title }: { series: HistoryDay[]; metric: HistoryMetric; title: string }) {
  const { locale } = useLocale()
  const wide = metric === 'quantity' || metric === 'emptySpace' || metric === 'loadable'
  return (
    <div className="chart-frame qty-chart">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#E0E0E0" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11 }}
            interval={Math.max(0, Math.ceil(series.length / 6) - 1)}
            tickFormatter={shortDay}
            height={32}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            width={wide ? 72 : 48}
            tickFormatter={(value: number) => formatAxis(metric, value)}
          />
          <Tooltip content={<QuantityTooltip locale={locale} metric={metric} title={title} />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#114C5A"
            strokeWidth={2}
            connectNulls={false}
            isAnimationActive={false}
            dot={<QuantityDot />}
            activeDot={<QuantityDot active />}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function shortDay(iso: string): string {
  const [, month, day] = iso.split('-')
  if (!month || !day) return iso
  return `${Number(day)}/${Number(month)}`
}

function QuantityDot({
  cx,
  cy,
  payload,
  active = false,
}: {
  cx?: number
  cy?: number
  payload?: HistoryDay
  active?: boolean
}) {
  if (cx == null || cy == null || payload?.value == null || payload.kind === 'gap') return <g />
  const radius = active ? 5 : 3.5
  const shared = {
    cx,
    cy,
    r: radius,
    'data-day': payload.day,
    'data-kind': payload.kind,
    'data-qty': payload.value,
  }
  return <circle {...shared} fill="#114C5A" stroke="#114C5A" />
}

function QuantityTooltip({
  active,
  payload,
  label,
  locale,
  metric,
  title,
}: {
  active?: boolean
  payload?: Array<{ payload?: HistoryDay }>
  label?: string | number
  locale: 'en' | 'id'
  metric: HistoryMetric
  title: string
}) {
  const row = payload?.[0]?.payload
  if (!active || !row || row.value == null || row.kind === 'gap') return null
  return (
    <div className="chart-tip">
      <strong>{formatDay(label == null ? null : String(label), locale)}</strong>
      <p>{title}: {formatTip(metric, row.value)}</p>
    </div>
  )
}

function formatAxis(metric: HistoryMetric, value: number): string {
  if (metric === 'quantity' || metric === 'emptySpace' || metric === 'loadable') return formatKg(value).replace(/\.00$/, '')
  if (metric === 'levelTank') return `${Math.round(value)}%`
  if (metric === 'temperature') return formatMeasure(value, 0)
  if (metric === 'level') return formatMeasure(value, 1)
  return formatMeasure(value, 2)
}

function formatTip(metric: HistoryMetric, value: number): string {
  if (metric === 'quantity' || metric === 'emptySpace' || metric === 'loadable') return `${formatKg(value)} kg`
  if (metric === 'level') return `${formatMeasure(value, 3)} m`
  if (metric === 'levelTank') return `${value.toFixed(1)}%`
  if (metric === 'temperature') return `${formatMeasure(value, 1)} °C`
  return `${formatMeasure(value)}%`
}
