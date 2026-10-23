import {
  CartesianGrid,
  Cell,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { useParam } from './qcChrome.tsx'

const NEUTRAL = '#114C5A'
const BREACH = '#DC2626'

export type ContractPoint = {
  key: string
  title: string
  detail?: string | null
  ffa: number
  moisture: number
  ffaMax: number | null
  moistureMax: number | null
}

function overContract(point: ContractPoint): boolean {
  return (point.ffaMax != null && point.ffa > point.ffaMax) || (point.moistureMax != null && point.moisture > point.moistureMax)
}

function ContractTip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: ContractPoint }> }) {
  const { t } = useLocale()
  const param = useParam()
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="chart-tip">
      <strong>{point.title}</strong>
      {point.detail ? <p>{point.detail}</p> : null}
      <p>FFA {param('ffa', point.ffa)} %</p>
      <p>M&I {param('moisture', point.moisture)} %</p>
      {overContract(point) ? <p className="qc-split__rejected">{t.overMax}</p> : null}
    </div>
  )
}

/** FFA against M&I. The box under both contract limits is the accepted area. */
export function ContractScatter({
  points,
  ffaMax,
  moistureMax,
  caption,
  selectedKey,
  onPick,
  height = 260,
}: {
  points: ContractPoint[]
  ffaMax: number | null
  moistureMax: number | null
  caption: string
  selectedKey?: string | null
  onPick?: (key: string) => void
  height?: number
}) {
  const { t } = useLocale()
  const param = useParam()
  if (points.length === 0) return <p className="empty">{t.noQcRows}</p>
  const niceTop = (value: number) => {
    const step = 10 ** Math.floor(Math.log10(value || 1)) / 2
    return Math.ceil(value / step) * step
  }
  const ffaTop = niceTop(Math.max(...points.map((point) => point.ffa), ffaMax ?? 0) * 1.08)
  const moistureTop = niceTop(Math.max(...points.map((point) => point.moisture), moistureMax ?? 0) * 1.08)
  return (
    <figure className="qc-figure chart-frame">
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="#E0E0E0" />
          {ffaMax != null && moistureMax != null ? (
            <ReferenceArea x1={0} x2={ffaMax} y1={0} y2={moistureMax} fill="#10B981" fillOpacity={0.08} stroke="none" />
          ) : null}
          <XAxis
            type="number"
            dataKey="ffa"
            name="FFA"
            domain={[0, ffaTop]}
            tick={{ fontSize: 11 }}
            tickFormatter={(value: number) => param('ffa', value)}
            label={{ value: t.ffaPct, position: 'insideBottomRight', offset: -4, fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="moisture"
            name="M&I"
            domain={[0, moistureTop]}
            width={56}
            tick={{ fontSize: 11 }}
            tickFormatter={(value: number) => param('moisture', value)}
            label={{ value: t.moisturePct, angle: -90, position: 'insideLeft', fontSize: 11 }}
          />
          {ffaMax != null ? (
            <ReferenceLine x={ffaMax} stroke="#2B2B2B" strokeDasharray="4 3" label={{ value: `FFA ${t.contractMax.replace('{value}', String(ffaMax))}`, position: 'top', fontSize: 10, fill: '#2B2B2B' }} />
          ) : null}
          {moistureMax != null ? (
            <ReferenceLine y={moistureMax} stroke="#2B2B2B" strokeDasharray="4 3" label={{ value: `M&I ${t.contractMax.replace('{value}', String(moistureMax))}`, position: 'insideTopLeft', fontSize: 10, fill: '#2B2B2B' }} />
          ) : null}
          <Tooltip content={<ContractTip />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter
            data={points}
            isAnimationActive={false}
            onClick={(entry: { payload?: ContractPoint }) => {
              if (entry?.payload && onPick) onPick(entry.payload.key)
            }}
            style={{ cursor: onPick ? 'pointer' : 'default' }}
          >
            {points.map((point) => {
              const over = overContract(point)
              const selected = point.key === selectedKey
              return (
                <Cell
                  key={point.key}
                  fill={over ? BREACH : NEUTRAL}
                  fillOpacity={over || selected ? 1 : 0.55}
                  stroke={selected ? '#2B2B2B' : '#FFFFFF'}
                  strokeWidth={selected ? 2 : 1}
                />
              )
            })}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <figcaption>{caption}</figcaption>
    </figure>
  )
}

export type HoldPoint = { key: string; hold: string; sample: string | null; value: number }

function HoldTip({ active, payload, code }: { active?: boolean; payload?: Array<{ payload?: HoldPoint }>; code: 'ffa' | 'moisture' }) {
  const param = useParam()
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="chart-tip">
      <strong>{point.hold}{point.sample ? ` · ${point.sample}` : ''}</strong>
      <p>{param(code, point.value)} %</p>
    </div>
  )
}

/** One dot per hold sample with a line at the contract max, so the hold that drives a rejection stands out. */
export function HoldStrip({
  points,
  max,
  label,
  code,
  caption,
}: {
  points: HoldPoint[]
  max: number | null
  label: string
  code: 'ffa' | 'moisture'
  caption: string
}) {
  const { t } = useLocale()
  const param = useParam()
  if (points.length === 0) return null
  const holds = [...new Set(points.map((point) => point.hold))]
  const data = points.map((point) => ({ ...point, x: holds.indexOf(point.hold) }))
  const values = points.map((point) => point.value)
  const low = Math.min(...values, max ?? Infinity)
  const high = Math.max(...values, max ?? -Infinity)
  const pad = Math.max((high - low) * 0.2, high * 0.02, 0.01)
  return (
    <figure className="qc-figure chart-frame">
      <h3 className="qc-dialog__chart-title">{label}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <ScatterChart margin={{ top: 12, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#E0E0E0" vertical={false} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[-0.5, holds.length - 0.5]}
            ticks={holds.map((_, index) => index)}
            tickFormatter={(index: number) => holds[index] ?? ''}
            tick={{ fontSize: 11 }}
            allowDecimals={false}
          />
          <YAxis
            type="number"
            dataKey="value"
            domain={[Math.max(0, low - pad), high + pad]}
            width={56}
            tick={{ fontSize: 11 }}
            tickFormatter={(value: number) => param(code, value)}
          />
          {max != null ? (
            <ReferenceLine y={max} stroke="#2B2B2B" strokeDasharray="4 3" label={{ value: t.contractMax.replace('{value}', String(max)), position: 'insideTopRight', fontSize: 10, fill: '#2B2B2B' }} />
          ) : null}
          <Tooltip content={<HoldTip code={code} />} cursor={false} />
          <Scatter data={data} isAnimationActive={false}>
            {data.map((point) => (
              <Cell key={point.key} fill={max != null && point.value > max ? BREACH : NEUTRAL} fillOpacity={0.8} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <figcaption>{caption}</figcaption>
    </figure>
  )
}
