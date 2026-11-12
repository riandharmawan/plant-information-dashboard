import { useState } from 'react'
import { ChevronRight, Thermometer } from 'lucide-react'
import type { CommodityStockRow, StockGroup } from '../../domain/commodityStock.ts'
import { commodityStock } from '../../domain/commodityStock.ts'
import type { TankLive } from '../../domain/types.ts'
import { formatMeasure } from '../../domain/format.ts'
import { useMass } from './massUnit.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { CommodityTrendDialog } from './CommodityTrendDialog.tsx'
import { LiveBadge } from './LiveBadge.tsx'
import { fillTone } from './tankAlerts.ts'

export function CommodityStock({ tanks, day, averageTemperature, hasLabData = true }: { tanks: TankLive[]; day: string; averageTemperature: number | null; hasLabData?: boolean }) {
  const { t } = useLocale()
  const rows = commodityStock(tanks)
  const [openCode, setOpenCode] = useState<StockGroup | null>(null)
  // Only a gauge reading taken for today is live. The newest of them says how fresh the screen is.
  const readings = tanks.filter((tank) => tank.readingKind === 'live' && tank.readingAt).map((tank) => tank.readingAt as string).sort()
  const liveAt = readings.at(-1) ?? null

  return (
    <section className="commodity-stock" aria-label={t.commodityStock}>
      <h2 className="card__title">
        {t.commodityStock}
        <LiveBadge readingAt={liveAt} />
      </h2>
      <ul className="commodity-grid">
        {rows.map((row) => (
          <li key={row.code}>
            <CommodityCard row={row} hasLabData={hasLabData} onOpen={() => setOpenCode(row.code)} />
          </li>
        ))}
      </ul>
      <CommodityTrendDialog
        code={openCode}
        tanks={tanks}
        day={day}
        averageTemperature={averageTemperature}
        hasLabData={hasLabData}
        onClose={() => setOpenCode(null)}
      />
    </section>
  )
}

function CommodityCard({ row, hasLabData, onOpen }: { row: CommodityStockRow; hasLabData: boolean; onOpen: () => void }) {
  const { t } = useLocale()
  const mass = useMass()
  const percent = row.utilization == null ? null : row.utilization * 100
  const width = percent == null ? 0 : Math.min(100, Math.max(0, percent))
  const tone = fillTone(row.utilization)
  const blank = t.unavailable
  // The card shows the average. The range behind it is one hover away, so a single off-colour tank is not hidden.
  const range = (stat: { min: number; max: number } | null) => (stat == null ? blank : stat.min === stat.max ? formatMeasure(stat.min, 1) : `${formatMeasure(stat.min, 1)}–${formatMeasure(stat.max, 1)}`)
  const colourCount = Math.max(row.colourR?.count ?? 0, row.colourY?.count ?? 0)
  const colourTitle = colourCount > 1
    ? t.colourRangeHint.replace('{r}', range(row.colourR)).replace('{y}', range(row.colourY))
    : colourCount === 1 ? t.colourOneTank : undefined
  const quantity = row.capacityKg == null
    ? blank
    : `${mass.compact(row.quantityKg)} / ${mass.compact(row.capacityKg)} ${mass.symbol}`

  return (
    <button
      type="button"
      className={`commodity-card commodity-card--${tone}`}
      aria-label={`${row.code}. ${t.stockSources}`}
      disabled={row.tankCount === 0}
      onClick={onOpen}
    >
      <span className="commodity-card__head">
        <strong className="commodity-card__name">{row.code}</strong>
        <span className="commodity-card__tanks">
          {t.tanksHolding.replace('{held}', String(row.holdingTanks)).replace('{total}', String(row.tankCount))}
        </span>
        <ChevronRight className="commodity-card__go" size={16} aria-hidden="true" />
      </span>
      <span className="commodity-card__util">
        <span className="commodity-card__pct">{percent == null ? blank : `${percent.toFixed(1)}%`}</span>
        <span className="commodity-card__qty">{quantity}</span>
      </span>
      <span className="commodity-card__gauge" aria-hidden="true">
        <span className="commodity-card__gauge-fill" style={{ width: `${width}%` }} />
      </span>
      <span className="commodity-card__facts">
        <span className="commodity-card__fact">
          <Thermometer size={13} aria-hidden="true" />
          {row.avgTemperatureC == null ? blank : `${formatMeasure(row.avgTemperatureC, 1)} °C`}
        </span>
        {hasLabData && (
          <>
            <span className="commodity-card__fact" title={t.avgQuality}>
              FFA {row.avgFfa == null ? blank : `${formatMeasure(row.avgFfa, 2)}%`}
              {' · '}
              M&I {row.avgMi == null ? blank : `${formatMeasure(row.avgMi, 2)}%`}
            </span>
            <span className="commodity-card__fact" title={colourTitle}>
              R {row.colourR == null ? blank : formatMeasure(row.colourR.average, 1)}
              {' · '}
              Y {row.colourY == null ? blank : formatMeasure(row.colourY.average, 1)}
            </span>
          </>
        )}
      </span>
    </button>
  )
}
