import { CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDay } from '../../domain/format.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import type { SoundingPoint } from '../../domain/types.ts'

export function TrendChart({ points, height = 280 }: { points: SoundingPoint[]; height?: number }) {
  const { t, locale } = useLocale()
  if (points.length === 0) return <p className="empty">{t.noHistory}</p>

  const data = points.map((point) => ({
    day: point.recordedOn ?? '',
    level: point.soundingLevelM,
    temp: point.temperatureC,
  }))

  return (
    <div className="chart-frame">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#E0E0E0" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11 }}
            interval={Math.max(0, Math.ceil(data.length / 6) - 1)}
            tickFormatter={shortDay}
            height={32}
          />
          <YAxis yAxisId="level" tick={{ fontSize: 11 }} width={40} />
          <YAxis yAxisId="temp" orientation="right" tick={{ fontSize: 11 }} width={40} />
          <Tooltip content={<TrendTooltip locale={locale} levelLabel={t.levelAxis} tempLabel={t.tempAxis} qualityLabel={t.specPending} />} />
          <Line yAxisId="level" type="monotone" dataKey="level" name={t.levelAxis} stroke="#114C5A" strokeWidth={2} dot={false} connectNulls />
          <Line yAxisId="temp" type="monotone" dataKey="temp" name={t.tempAxis} stroke="#DC2626" strokeWidth={2} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function shortDay(iso: string): string {
  const [, month, day] = iso.split('-')
  if (!month || !day) return iso
  return `${Number(day)}/${Number(month)}`
}

function TrendTooltip({
  active,
  payload,
  label,
  locale,
  levelLabel,
  tempLabel,
  qualityLabel,
}: {
  active?: boolean
  payload?: Array<{ value?: number | null; dataKey?: string }>
  label?: string | number
  locale: 'en' | 'id'
  levelLabel: string
  tempLabel: string
  qualityLabel: string
}) {
  if (!active || !payload?.length) return null
  const level = payload.find((item) => item.dataKey === 'level')?.value
  const temp = payload.find((item) => item.dataKey === 'temp')?.value
  return (
    <div className="chart-tip">
      <strong>{formatDay(label == null ? null : String(label), locale)}</strong>
      <p>{levelLabel}: {level ?? '—'}</p>
      <p>{tempLabel}: {temp ?? '—'}</p>
      <p>{qualityLabel}</p>
    </div>
  )
}
