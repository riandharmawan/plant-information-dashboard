import { useState } from 'react'
import type { StockGroup } from '../../domain/commodityStock.ts'
import { commodityStock } from '../../domain/commodityStock.ts'
import type { TankLive } from '../../domain/types.ts'
import { formatKg } from '../../domain/format.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { CommodityTrendDialog } from './CommodityTrendDialog.tsx'

export function CommodityStock({ tanks, start, end }: { tanks: TankLive[]; start: string; end: string }) {
  const { t } = useLocale()
  const rows = commodityStock(tanks)
  const [openCode, setOpenCode] = useState<StockGroup | null>(null)

  return (
    <section className="commodity-stock" aria-label={t.commodityStock}>
      <h2 className="card__title">{t.commodityStock}</h2>
      <ul className="commodity-stock__list">
        {rows.map((row) => {
          const percent = row.utilization == null ? null : Math.round(row.utilization * 100)
          const width = percent == null ? 0 : Math.min(100, Math.max(0, percent))
          return (
            <li key={row.code} className="commodity-stock__row">
              <span className="commodity-stock__name">{row.code}</span>
              <button
                type="button"
                className="commodity-stock__track"
                aria-label={`${row.code}. ${t.stockSources}`}
                onClick={() => setOpenCode(row.code)}
              >
                <span className="commodity-stock__fill" style={{ width: `${width}%` }} />
              </button>
              <span className="commodity-stock__pct">{percent == null ? t.unavailable : `${percent}%`}</span>
              <span className="commodity-stock__qty">
                {row.quantityKg == null ? t.unavailable : `${formatKg(row.quantityKg)} kg`}
              </span>
            </li>
          )
        })}
      </ul>
      <CommodityTrendDialog code={openCode} tanks={tanks} start={start} end={end} onClose={() => setOpenCode(null)} />
    </section>
  )
}
