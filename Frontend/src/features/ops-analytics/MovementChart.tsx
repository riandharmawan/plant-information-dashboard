import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import type { MovementTotal } from '../../domain/types.ts'

export function MovementChart({ rows, height = 240 }: { rows: MovementTotal[]; height?: number }) {
  const { t } = useLocale()
  if (rows.length === 0) return <p className="empty">{t.awaiting}</p>

  return (
    <div className="movement-split">
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
            <CartesianGrid stroke="#E0E0E0" vertical={false} />
            <XAxis dataKey="commodity" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 11 }} width={32} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="outbound" name={t.outbound} stackId="moves" fill="#114C5A" />
            <Bar dataKey="inbound" name={t.inbound} stackId="moves" fill="#10B981" />
            <Bar dataKey="unknown" name={t.notClassified} stackId="moves" fill="#C4C4C4" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <table className="movement-table">
          <thead>
            <tr>
              <th>{t.allCommodities}</th>
              <th>{t.outbound}</th>
              <th>{t.inbound}</th>
              <th>{t.notClassified}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.commodity}>
                <td>{row.commodity}</td>
                <td>{row.outbound}</td>
                <td>{row.inbound}</td>
                <td>{row.unknown}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="page-note">{t.movementNote}</p>
      </div>
    </div>
  )
}
