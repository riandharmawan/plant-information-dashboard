import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import type { LabHistoryPoint } from '../../domain/types.ts'
import { formatDay, parameter } from '../../domain/format.ts'

export function QualityChart({ points, height = 240 }: { points: LabHistoryPoint[]; height?: number }) {
  const { t, locale } = useLocale()
  const data = points
    .filter((point) => parameter(point.parameters, 'FFA') != null || parameter(point.parameters, 'MI') != null)
    .map((point) => ({
      day: formatDay(point.analysisDate, locale),
      ffa: parameter(point.parameters, 'FFA'),
      moisture: parameter(point.parameters, 'MI'),
    }))
  if (data.length === 0) return <p className="empty">{t.noQuality}</p>

  return (
    <div className="chart-frame">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#E0E0E0" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis yAxisId="ffa" tick={{ fontSize: 11 }} width={40} />
          <YAxis yAxisId="moisture" orientation="right" tick={{ fontSize: 11 }} width={40} />
          <Tooltip />
          <Line yAxisId="ffa" type="monotone" dataKey="ffa" name="FFA %" stroke="#114C5A" strokeWidth={2} dot connectNulls />
          <Line yAxisId="moisture" type="monotone" dataKey="moisture" name="M&I %" stroke="#10B981" strokeWidth={2} dot connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
