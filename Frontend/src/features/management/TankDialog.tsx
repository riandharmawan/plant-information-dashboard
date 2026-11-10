import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../../data/api.ts'
import { formatPercent, formatTonnes, type PortfolioSite, type PortfolioTank, type TankHistoryPoint } from '../../domain/management.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { prefersReducedMotion } from './motion.tsx'
import { ClassDot, StatusChip, StockBar, useClassLabel } from './parts.tsx'

/** One tank: where it stands now and how its stock has moved. */
export function TankDialog({ site, tank, onClose }: { site: PortfolioSite; tank: PortfolioTank; onClose: () => void }) {
  const { t, locale } = useLocale()
  const label = useClassLabel()
  const [points, setPoints] = useState<TankHistoryPoint[] | null>(null)
  const [closing, setClosing] = useState(false)

  // Fade the dialog out before it goes, so it does not just vanish.
  const close = useCallback(() => {
    setClosing(true)
    window.setTimeout(onClose, prefersReducedMotion() ? 0 : 160)
  }, [onClose])

  useEffect(() => {
    let alive = true
    api<TankHistoryPoint[]>(`/api/v1/portfolio/sites/${encodeURIComponent(site.id)}/tanks/${encodeURIComponent(tank.tankId)}/history`)
      .then((rows) => alive && setPoints(rows))
      .catch(() => alive && setPoints([]))
    return () => {
      alive = false
    }
  }, [site.id, tank.tankId])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  // One point per day: the last reading of the day.
  const series = useMemo(() => {
    const byDay = new Map<string, TankHistoryPoint>()
    for (const point of points ?? []) if (point.quantityKg != null) byDay.set(point.recordedOn, point)
    return [...byDay.values()].map((point) => ({ day: point.recordedOn, tonnes: (point.quantityKg ?? 0) / 1000 }))
  }, [points])

  const capacityTonnes = tank.capacityKg != null ? tank.capacityKg / 1000 : null

  return (
    <div className={closing ? 'mg-overlay is-closing' : 'mg-overlay'} role="presentation" onClick={close}>
      <div className="mg-dialog" role="dialog" aria-modal="true" aria-labelledby="mg-tank-title" onClick={(event) => event.stopPropagation()}>
        <header className="mg-dialog__head">
          <div>
            <h2 id="mg-tank-title">
              {tank.tankId} <span className="mg-muted">· {site.name}</span>
            </h2>
            <p className="mg-dialog__sub">
              <ClassDot code={tank.commodityClass} /> {label(tank.commodityClass)}
              {tank.productName ? ` · ${tank.productName}` : ''}
            </p>
          </div>
          <button type="button" className="mg-icon-btn" aria-label={t.mgClose} onClick={close}>
            <X size={18} />
          </button>
        </header>

        <dl className="mg-facts">
          <div><dt>{t.mgColQty}</dt><dd>{formatTonnes(tank.quantityKg, locale)}</dd></div>
          <div><dt>{t.mgColCap}</dt><dd>{formatTonnes(tank.capacityKg, locale)}</dd></div>
          <div><dt>{t.mgColFill}</dt><dd>{formatPercent(tank.fillRatio, locale)}</dd></div>
          <div><dt>{t.mgColTemp}</dt><dd>{tank.temperatureC == null ? '—' : tank.temperatureC.toFixed(1)}</dd></div>
          <div><dt>{t.mgColStatus}</dt><dd><StatusChip status={tank.status} /></dd></div>
        </dl>
        {tank.capacityKg != null && tank.quantityKg != null ? (
          <StockBar quantityKg={tank.quantityKg} capacityTotalKg={tank.capacityKg} scaleMax={tank.capacityKg} tick={0.9} />
        ) : null}

        <h3 className="mg-dialog__section">{t.mgHistory}</h3>
        {points == null ? (
          <p className="mg-muted">{t.loading}</p>
        ) : series.length < 2 ? (
          <p className="mg-muted">{t.mgHistoryNone}</p>
        ) : (
          <div className="mg-chart">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--mg-grid)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(day: string) => day.slice(5)} stroke="var(--mg-axis)" />
                <YAxis tick={{ fontSize: 11 }} width={48} domain={[0, capacityTonnes ?? 'auto']} tickFormatter={(value: number) => formatTonnes(value * 1000, locale)} stroke="var(--mg-axis)" />
                <Tooltip formatter={(value) => [`${formatTonnes(Number(value) * 1000, locale)} t`, t.mgColQty]} labelFormatter={(day) => String(day)} />
                {capacityTonnes != null ? <ReferenceLine y={capacityTonnes} stroke="var(--mg-axis)" strokeDasharray="4 4" /> : null}
                <Line type="monotone" dataKey="tonnes" stroke="var(--mg-stock)" strokeWidth={2} dot={series.length < 20} isAnimationActive={!prefersReducedMotion()} animationDuration={700} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
