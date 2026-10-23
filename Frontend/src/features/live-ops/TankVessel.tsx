import { useId } from 'react'
import { Thermometer } from 'lucide-react'
import { formatMeasure } from '../../domain/format.ts'
import { useMass } from './massUnit.ts'
import { CRITICAL_FILL } from './tankAlerts.ts'

const TOP = 24
const BOTTOM = 184
const SPAN = BOTTOM - TOP
const LEFT = 12
const RIGHT = 108
const RX = (RIGHT - LEFT) / 2
const CX = LEFT + RX
const RY = 7

export type VesselTone = 'low' | 'high' | 'critical' | 'quarantine' | 'empty'

export function TankVessel({
  percent,
  tone,
  temperatureC,
  hot,
  capacityKg,
  capacityLabel,
  blank,
}: {
  /** Fill from 0 to 100. */
  percent: number
  tone: VesselTone
  temperatureC: number | null
  hot: boolean
  capacityKg: number | null
  capacityLabel: string
  blank: string
}) {
  const mass = useMass()
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const level = Math.min(100, Math.max(0, percent))
  const surface = BOTTOM - (level / 100) * SPAN
  const shell = `M${LEFT},${TOP} V${BOTTOM} A${RX},${RY} 0 0 0 ${RIGHT},${BOTTOM} V${TOP} A${RX},${RY} 0 0 0 ${LEFT},${TOP} Z`
  const critical = BOTTOM - CRITICAL_FILL * SPAN
  const showLiquid = tone !== 'empty' && level > 0

  return (
    <figure className={`tank-vessel tank-vessel--${tone}`}>
      <svg viewBox="0 0 120 200" role="img" aria-label={`${level.toFixed(1)}%`}>
        <defs>
          <linearGradient id={`${id}-metal`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" className="tank-vessel__metal-edge" />
            <stop offset="0.28" className="tank-vessel__metal-light" />
            <stop offset="0.62" className="tank-vessel__metal-mid" />
            <stop offset="1" className="tank-vessel__metal-edge" />
          </linearGradient>
          <linearGradient id={`${id}-glass`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" className="tank-vessel__glass-edge" />
            <stop offset="0.5" className="tank-vessel__glass-mid" />
            <stop offset="1" className="tank-vessel__glass-edge" />
          </linearGradient>
          <linearGradient id={`${id}-liquid`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" className="tank-vessel__liquid-deep" />
            <stop offset="0.35" className="tank-vessel__liquid-light" />
            <stop offset="1" className="tank-vessel__liquid-deep" />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <path d={shell} />
          </clipPath>
        </defs>

        <ellipse cx={CX} cy={BOTTOM + 10} rx={RX + 4} ry={5} className="tank-vessel__shadow" />
        <path d={shell} fill={`url(#${id}-glass)`} />

        {showLiquid && (
          <g clipPath={`url(#${id}-clip)`}>
            <g className="tank-vessel__liquid" style={{ transform: `translateY(${surface}px)` }}>
              <rect x={LEFT} y={0} width={RIGHT - LEFT} height={SPAN + RY * 2} fill={`url(#${id}-liquid)`} />
              <ellipse cx={CX} cy={0} rx={RX} ry={RY} className="tank-vessel__surface" />
              <path
                className="tank-vessel__wave"
                d={`M${LEFT - 100},0 q25,-4 50,0 t50,0 t50,0 t50,0 t50,0 t50,0 V8 H${LEFT - 100} Z`}
              />
            </g>
          </g>
        )}

        {[0.25, 0.5, 0.75].map((mark) => {
          const y = BOTTOM - mark * SPAN
          return <line key={mark} x1={RIGHT - 9} x2={RIGHT - 2} y1={y} y2={y} className="tank-vessel__tick" />
        })}
        <rect x={LEFT + 10} y={TOP + 10} width={8} height={SPAN - 16} rx={4} className="tank-vessel__shine" />
        <path d={shell} className="tank-vessel__outline" />
        <ellipse cx={CX} cy={TOP} rx={RX} ry={RY} fill={`url(#${id}-metal)`} className="tank-vessel__lid" />
        <rect x={CX - 9} y={TOP - 9} width={18} height={6} rx={2} fill={`url(#${id}-metal)`} className="tank-vessel__lid" />
        <line x1={LEFT} x2={RIGHT} y1={critical} y2={critical} className="tank-vessel__critical" />
        <text x={CX} y={(TOP + BOTTOM) / 2 + 6} className="tank-vessel__pct">
          {tone === 'empty' ? blank : `${level.toFixed(0)}%`}
        </text>
      </svg>
      <figcaption className="tank-vessel__caption">
        <span className={hot ? 'tank-vessel__temp tank-vessel__temp--hot' : 'tank-vessel__temp'}>
          <Thermometer size={12} aria-hidden="true" />
          {temperatureC == null ? blank : `${formatMeasure(temperatureC, 1)} °C`}
        </span>
        <span className="tank-vessel__cap">
          {capacityLabel} {capacityKg == null ? blank : `${mass.compact(capacityKg)} ${mass.symbol}`}
        </span>
      </figcaption>
    </figure>
  )
}
