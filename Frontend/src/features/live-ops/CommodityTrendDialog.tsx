import { useEffect, useMemo, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useRepository } from '../../data/OperationsContext.tsx'
import type { StockGroup } from '../../domain/commodityStock.ts'
import { commoditySources } from '../../domain/commodityStock.ts'
import { formatDay, formatMeasure, parameter, tankLabel } from '../../domain/format.ts'
import type { SoundingPoint, TankLive } from '../../domain/types.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { DateRangeFilter } from '../daily-production/DateRangeFilter.tsx'
import { addDays } from '../usePeriodRange.ts'
import { useMass } from './massUnit.ts'
import { commodityDayReading, commodityQuantitySeries, type HistoryDay } from './quantitySeries.ts'
import { isOverfilled, isTempAnomaly } from './tankAlerts.ts'

const DEFAULT_DAYS = 30

export function CommodityTrendDialog({
  code,
  tanks,
  day,
  averageTemperature,
  onClose,
}: {
  code: StockGroup | null
  tanks: TankLive[]
  /** Dashboard day. The dialog range defaults to the 30 days ending here. */
  day: string
  averageTemperature: number | null
  onClose: () => void
}) {
  const { t, locale } = useLocale()
  const mass = useMass()
  const repository = useRepository()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [histories, setHistories] = useState<Array<{ tankId: string; points: SoundingPoint[] }>>([])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [range, setRange] = useState(() => defaultRange(day))
  const { start, end } = range
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
    if (code) setRange(defaultRange(day))
  }, [code, day])

  const changeRange = (nextStart: string, nextEnd: string) => {
    setRange({ start: nextStart, end: nextEnd })
    if (selectedDay && (selectedDay < nextStart || selectedDay > nextEnd)) setSelectedDay(null)
  }

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
  const soundingDays = useMemo(() => [...new Set(histories.flatMap((history) => history.points.flatMap((point) => (point.recordedOn ? [point.recordedOn] : []))))], [histories])

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
          <div className="stock-dialog__head">
            <div>
              <h2>{code} - {t.quantity}</h2>
              <p className="stock-dialog__updated">
                {t.tanksHolding.replace('{held}', String(sources.filter((tank) => tank.quantityKg != null && tank.quantityKg > 0).length)).replace('{total}', String(sources.length))}
              </p>
            </div>
            {start && end && (
              <DateRangeFilter start={start} end={end} dataDates={soundingDays} onChange={changeRange} />
            )}
          </div>
          <dl className="qty-stats">
            <div>
              <dt>{t.rangeAverage}</dt>
              <dd>{stats ? `${mass.amount(stats.average)} ${mass.symbol}` : t.unavailable}</dd>
            </div>
            <div>
              <dt>{t.rangeMax}</dt>
              <dd>{stats ? `${mass.amount(stats.max)} ${mass.symbol}` : t.unavailable}</dd>
            </div>
            <div>
              <dt>{t.rangeMin}</dt>
              <dd>{stats ? `${mass.amount(stats.min)} ${mass.symbol}` : t.unavailable}</dd>
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
                      <th className="num">{t.quantity} ({mass.symbol})</th>
                      <th className="num">{t.emptySpace} ({mass.symbol})</th>
                      <th className="num">{t.loadable} ({mass.symbol})</th>
                      <th className="num">{t.tankLevelPct}</th>
                      <th className="num">{t.tempAxis}</th>
                      <th className="num">FFA</th>
                      <th className="num">M&I</th>
                      <th>{t.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readings.map(({ tank, reading }) => {
                      const overfilled = isOverfilled(reading?.levelRatio)
                      const hot = isTempAnomaly(reading?.temperatureC, averageTemperature)
                      const ffa = parameter(tank.quality?.parameters, 'FFA')
                      const moisture = parameter(tank.quality?.parameters, 'MI')
                      const status = reading?.operationalStatus || tank.operationalStatus || t.unavailable
                      return (
                        <tr key={tank.tankId} className={overfilled || hot ? 'stock-dialog__row--alert' : undefined}>
                          <td>{tankLabel(tank.tankId)}</td>
                          <td className="num">{reading?.soundingLevelM == null ? t.unavailable : formatMeasure(reading.soundingLevelM, 3)}</td>
                          <td className="num">{reading?.quantityKg == null ? t.unavailable : mass.amount(reading.quantityKg)}</td>
                          <td className="num">{reading?.emptySpaceKg == null ? t.unavailable : mass.amount(reading.emptySpaceKg)}</td>
                          <td className="num">{reading?.loadableKg == null ? t.unavailable : mass.amount(reading.loadableKg)}</td>
                          <td className="num"><LevelCue ratio={reading?.levelRatio ?? null} blank={t.unavailable} /></td>
                          <td className={hot ? 'num stock-dialog__alert' : 'num'}>
                            {reading?.temperatureC == null ? t.unavailable : `${formatMeasure(reading.temperatureC, 1)} °C`}
                          </td>
                          <td className="num">{ffa == null ? t.unavailable : formatMeasure(ffa, 2)}</td>
                          <td className="num">{moisture == null ? t.unavailable : formatMeasure(moisture, 2)}</td>
                          <td>
                            <span className={status === 'EMPTY' ? 'badge badge--muted' : overfilled ? 'badge badge--danger' : 'badge'}>{status}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>{t.totalQuantity}</td>
                      <td />
                      <td className="num">{quantityTotal == null ? t.unavailable : mass.amount(quantityTotal)}</td>
                      <td className="num">{emptyTotal == null ? t.unavailable : mass.amount(emptyTotal)}</td>
                      <td className="num">{loadableTotal == null ? t.unavailable : mass.amount(loadableTotal)}</td>
                      <td colSpan={5} />
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

function defaultRange(day: string): { start: string; end: string } {
  if (!day) return { start: '', end: '' }
  return { start: addDays(day, -(DEFAULT_DAYS - 1)), end: day }
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
  const mass = useMass()
  return (
    <div className="chart-frame qty-chart">
      <ResponsiveContainer width="100%" height={168}>
        <LineChart
          data={series}
          margin={{ top: 16, right: 8, left: 8, bottom: 0 }}
          onClick={(state) => {
            const day = state?.activeLabel
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
          <YAxis tick={{ fontSize: 11 }} width={72} tickFormatter={(value: number) => mass.axis(value)} />
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
  x?: number | string
  y?: number | string
  payload?: { value?: string }
  selectedDay?: string | null
}) {
  const day = payload?.value ?? ''
  const selected = day === selectedDay
  return (
    <text x={x} y={Number(y ?? 0) + 12} textAnchor="middle" fill={selected ? '#c2410c' : '#6b6b6b'} fontSize={11} fontWeight={selected ? 700 : 400}>
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
  const mass = useMass()
  const row = payload?.[0]?.payload
  if (!active || !row || row.value == null || row.kind === 'gap') return null
  return (
    <div className="chart-tip">
      <strong>{formatDay(label == null ? null : String(label), locale)}</strong>
      <p>{t.quantity}: {mass.amount(row.value)} {mass.symbol}</p>
    </div>
  )
}

function sumKnown(values: Array<number | null>): number | null {
  const nums = values.filter((value): value is number => value != null)
  if (nums.length === 0) return null
  return nums.reduce((sum, value) => sum + value, 0)
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
