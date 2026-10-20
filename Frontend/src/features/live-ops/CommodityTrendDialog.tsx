import { useEffect, useMemo, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useRepository } from '../../data/OperationsContext.tsx'
import type { StockGroup } from '../../domain/commodityStock.ts'
import { commoditySources } from '../../domain/commodityStock.ts'
import { formatDay, formatKg, formatMeasure, tankLabel } from '../../domain/format.ts'
import type { SoundingPoint, TankLive } from '../../domain/types.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { commodityDayReading, commodityQuantitySeries, type HistoryDay } from './quantitySeries.ts'

export function CommodityTrendDialog({
  code,
  tanks,
  start,
  end,
  onClose,
}: {
  code: StockGroup | null
  tanks: TankLive[]
  start: string
  end: string
  onClose: () => void
}) {
  const { t, locale } = useLocale()
  const repository = useRepository()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [histories, setHistories] = useState<Array<{ tankId: string; points: SoundingPoint[] }>>([])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const sources = code ? commoditySources(tanks, code) : []
  const sourceKey = sources.map((tank) => tank.tankId).join(',')
  const series = useMemo(() => {
    const ids = new Set(sourceKey ? sourceKey.split(',') : [])
    const matching = histories.filter((history) => ids.has(history.tankId))
    if (ids.size === 0 || matching.length !== ids.size) return []
    return commodityQuantitySeries(matching, start, end)
  }, [histories, sourceKey, start, end])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (code && !dialog.open) dialog.showModal()
    if (!code && dialog.open) dialog.close()
  }, [code])

  useEffect(() => {
    setSelectedDay(null)
    setHistories([])
  }, [code])

  useEffect(() => {
    if (!code) return
    const ids = sourceKey ? sourceKey.split(',') : []
    let active = true
    Promise.all(ids.map(async (tankId) => ({ tankId, points: await repository.getSoundingHistory(tankId) }))).then((rows) => {
      if (active) setHistories(rows)
    })
    return () => {
      active = false
    }
  }, [repository, code, sourceKey])

  const stats = seriesStats(series)
  const historyByTank = useMemo(() => new Map(histories.map((history) => [history.tankId, history.points])), [histories])

  useEffect(() => {
    if (selectedDay || series.length === 0) return
    const latest = [...series].reverse().find((point) => point.value != null)
    if (latest) setSelectedDay(latest.day)
  }, [series, selectedDay])

  const readings = sources.map((tank) => {
    const reading = selectedDay ? commodityDayReading(tank.tankId, historyByTank.get(tank.tankId) ?? [], selectedDay) : null
    return { tank, reading }
  })
  const quantityTotal = sumKnown(readings.map((row) => row.reading?.quantityKg ?? null))
  const emptyTotal = sumKnown(readings.map((row) => row.reading?.emptySpaceKg ?? null))
  const loadableTotal = sumKnown(readings.map((row) => row.reading?.loadableKg ?? null))

  return (
    <dialog ref={dialogRef} className="stock-dialog stock-dialog--wide stock-dialog--trend" onClose={onClose}>
      {code && (
        <>
          <h2>{code} - {t.quantity}</h2>
          <p className="stock-dialog__updated">{formatDay(start, locale)} – {formatDay(end, locale)}</p>
          <dl className="qty-stats">
            <div>
              <dt>{t.rangeAverage}</dt>
              <dd>{stats ? `${formatKg(stats.average)} kg` : t.unavailable}</dd>
            </div>
            <div>
              <dt>{t.rangeMax}</dt>
              <dd>{stats ? `${formatKg(stats.max)} kg` : t.unavailable}</dd>
            </div>
            <div>
              <dt>{t.rangeMin}</dt>
              <dd>{stats ? `${formatKg(stats.min)} kg` : t.unavailable}</dd>
            </div>
          </dl>
          {stats
            ? (
              <CommodityChart
                series={series}
                selectedDay={selectedDay}
                onSelect={setSelectedDay}
              />
            )
            : <p className="empty">{t.unavailable}</p>}
          <ul className="qty-legend">
            <li><span className="qty-dot qty-dot--measured" aria-hidden="true" />{t.soundingDay}</li>
          </ul>
          {selectedDay && (
            <>
              <p className="stock-dialog__kicker">
                {t.stockSources}
                <span className="trend-day">{formatDay(selectedDay, locale)}</span>
              </p>
              <div className="stock-dialog__scroll">
                <table className="stock-dialog__table">
                  <thead>
                    <tr>
                      <th>{t.tank}</th>
                      <th className="num">{t.levelAxis}</th>
                      <th className="num">{t.quantity} (kg)</th>
                      <th className="num">{t.emptySpace} (kg)</th>
                      <th className="num">{t.loadable} (kg)</th>
                      <th className="num">{t.tankLevelPct}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readings.map(({ tank, reading }) => (
                      <tr key={tank.tankId}>
                        <td>{tankLabel(tank.tankId)}</td>
                        <td className="num">{reading?.soundingLevelM == null ? t.unavailable : formatMeasure(reading.soundingLevelM, 3)}</td>
                        <td className="num">{kgAmount(reading?.quantityKg ?? null, t.unavailable)}</td>
                        <td className="num">{kgAmount(reading?.emptySpaceKg ?? null, t.unavailable)}</td>
                        <td className="num">{kgAmount(reading?.loadableKg ?? null, t.unavailable)}</td>
                        <td className="num"><LevelCue ratio={reading?.levelRatio ?? null} blank={t.unavailable} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>{t.totalQuantity}</td>
                      <td />
                      <td className="num">{quantityTotal == null ? t.unavailable : formatKg(quantityTotal)}</td>
                      <td className="num">{emptyTotal == null ? t.unavailable : formatKg(emptyTotal)}</td>
                      <td className="num">{loadableTotal == null ? t.unavailable : formatKg(loadableTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
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

function CommodityChart({
  series,
  selectedDay,
  onSelect,
}: {
  series: HistoryDay[]
  selectedDay: string | null
  onSelect: (day: string) => void
}) {
  const { locale } = useLocale()
  return (
    <div className="chart-frame qty-chart">
      <ResponsiveContainer width="100%" height={168}>
        <LineChart
          data={series}
          margin={{ top: 16, right: 8, left: 8, bottom: 0 }}
          onClick={(state) => {
            const payloadDay = state?.activePayload?.[0]?.payload?.day
            const day = typeof payloadDay === 'string' ? payloadDay : state?.activeLabel
            if (typeof day === 'string') onSelect(day)
          }}
        >
          <CartesianGrid stroke="#E0E0E0" vertical={false} />
          <XAxis
            dataKey="day"
            tick={(props) => <DayTick {...props} selectedDay={selectedDay} />}
            interval={Math.max(0, Math.ceil(series.length / 6) - 1)}
            height={24}
          />
          <YAxis tick={{ fontSize: 11 }} width={72} tickFormatter={(value: number) => formatKg(value).replace(/\.00$/, '')} />
          <Tooltip content={<CommodityTooltip locale={locale} />} />
          {selectedDay && (
            <ReferenceLine
              x={selectedDay}
              stroke="#c2410c"
              strokeDasharray="3 3"
              label={{ value: shortDay(selectedDay), position: 'top', fill: '#c2410c', fontSize: 11, fontWeight: 700 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#114C5A"
            strokeWidth={2}
            connectNulls={false}
            isAnimationActive={false}
            dot={<CommodityDot selectedDay={selectedDay} onSelect={onSelect} />}
            activeDot={<CommodityDot selectedDay={selectedDay} onSelect={onSelect} active />}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function DayTick({
  x,
  y,
  payload,
  selectedDay,
}: {
  x?: number
  y?: number
  payload?: { value?: string }
  selectedDay?: string | null
}) {
  const day = payload?.value ?? ''
  const selected = day === selectedDay
  return (
    <text x={x} y={(y ?? 0) + 12} textAnchor="middle" fill={selected ? '#c2410c' : '#6b6b6b'} fontSize={11} fontWeight={selected ? 700 : 400}>
      {shortDay(day)}
    </text>
  )
}

function shortDay(iso: string): string {
  const [, month, day] = iso.split('-')
  if (!month || !day) return iso
  return `${Number(day)}/${Number(month)}`
}

function CommodityDot({
  cx,
  cy,
  payload,
  selectedDay,
  onSelect,
  active = false,
}: {
  cx?: number
  cy?: number
  payload?: HistoryDay
  selectedDay?: string | null
  onSelect?: (day: string) => void
  active?: boolean
}) {
  if (cx == null || cy == null || payload?.value == null || payload.kind === 'gap') return <g />
  const selected = payload.day === selectedDay
  return (
    <circle
      cx={cx}
      cy={cy}
      r={selected ? 6 : active ? 5 : 3.5}
      fill={selected ? '#c2410c' : '#114C5A'}
      stroke={selected ? '#ffffff' : '#114C5A'}
      strokeWidth={selected ? 2 : 1}
      style={{ cursor: 'pointer' }}
      onClick={() => onSelect?.(payload.day)}
    />
  )
}

function CommodityTooltip({
  active,
  payload,
  label,
  locale,
}: {
  active?: boolean
  payload?: Array<{ payload?: HistoryDay }>
  label?: string | number
  locale: 'en' | 'id'
}) {
  const { t } = useLocale()
  const row = payload?.[0]?.payload
  if (!active || !row || row.value == null || row.kind === 'gap') return null
  return (
    <div className="chart-tip">
      <strong>{formatDay(label == null ? null : String(label), locale)}</strong>
      <p>{t.quantity}: {formatKg(row.value)} kg</p>
    </div>
  )
}

function sumKnown(values: Array<number | null>): number | null {
  const nums = values.filter((value): value is number => value != null)
  if (nums.length === 0) return null
  return nums.reduce((sum, value) => sum + value, 0)
}

function kgAmount(value: number | null, blank: string): string {
  if (value == null) return blank
  return formatKg(value)
}

function LevelCue({ ratio, blank }: { ratio: number | null; blank: string }) {
  if (ratio == null) return blank
  const percent = Math.min(100, Math.max(0, ratio * 100))
  const tone = percent >= 85 ? 'high' : percent >= 50 ? 'mid' : 'low'
  return (
    <span className={`level-cue level-cue--${tone}`}>
      <span className="level-cue__track" aria-hidden="true">
        <span className="level-cue__fill" style={{ width: `${percent}%` }} />
      </span>
      <span className="level-cue__value">{percent.toFixed(1)}%</span>
    </span>
  )
}
