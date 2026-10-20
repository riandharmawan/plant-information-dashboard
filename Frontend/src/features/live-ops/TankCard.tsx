import { useLocale } from '../../i18n/LocaleContext.tsx'
import type { TankLive } from '../../domain/types.ts'
import { formatDay, formatKg, formatMeasure, levelPercent, parameter, tankLabel } from '../../domain/format.ts'
import type { HistoryMetric } from './quantitySeries.ts'

export function TankCard({ tank, averageTemperature, onHistory }: { tank: TankLive; averageTemperature: number | null; onHistory: (tankId: string, metric: HistoryMetric) => void }) {
  const { t, locale } = useLocale()
  const empty = tank.operationalStatus === 'EMPTY' || (tank.soundingLevelM == null && !tank.productName)
  const quarantined = tank.quality?.storageVerdict === 'quarantine'
  const ffa = parameter(tank.quality?.parameters, 'FFA')
  const moisture = parameter(tank.quality?.parameters, 'MI')
  const stale = tank.quality?.ageDays != null && tank.quality.ageDays > 7
  const ageTitle = stale && tank.quality?.analysisDate
    ? t.qualityAge.replace('{age}', String(tank.quality.ageDays)).replace('{day}', formatDay(tank.quality.analysisDate, locale))
    : undefined
  const status = tank.operationalStatus || '—'

  return (
    <article className={[
      'tank-card',
      empty ? 'tank-card--empty' : '',
      quarantined ? 'tank-card--quarantine' : '',
    ].filter(Boolean).join(' ')}>
      <header className="tank-card__head">
        <strong>{tankLabel(tank.tankId)}</strong>
        <span>{tank.productName || '—'}</span>
      </header>
      <div className="tank-card__body">
        <div className="tank-bar" aria-hidden="true">
          <div className="tank-bar__fill" style={{ height: `${barPercent(tank)}%` }} />
        </div>
        <dl className="tank-card__metrics">
          <Metric label={t.capacity} value={kg(tank.capacityKg, t.unavailable)} />
          <Metric label={t.levelAxis} value={tank.soundingLevelM == null ? t.unavailable : `${formatMeasure(tank.soundingLevelM, 3)} m`} onClick={() => onHistory(tank.tankId, 'level')} />
          <Metric label={t.quantity} value={kgAmount(tank.quantityKg, t.unavailable)} onClick={() => onHistory(tank.tankId, 'quantity')} />
          <Metric label={t.emptySpace} value={kgAmount(tank.emptySpaceKg, t.unavailable)} onClick={() => onHistory(tank.tankId, 'emptySpace')} />
          <Metric label={t.loadable} value={kgAmount(tank.loadableKg, t.unavailable)} onClick={() => onHistory(tank.tankId, 'loadable')} />
          <Metric label={t.tankLevelPct} value={tank.fillRatio == null ? t.unavailable : `${(tank.fillRatio * 100).toFixed(1)}%`} alert={tank.fillRatio != null && tank.fillRatio > 0.8} onClick={() => onHistory(tank.tankId, 'levelTank')} />
          <Metric label={t.tempAxis} value={tank.temperatureC == null ? t.unavailable : `${formatMeasure(tank.temperatureC, 1)} °C`} alert={tank.temperatureC != null && averageTemperature != null && averageTemperature > 0 && tank.temperatureC > averageTemperature * 1.3} onClick={() => onHistory(tank.tankId, 'temperature')} />
        </dl>
      </div>
      <footer className="tank-card__foot">
        <span className={status === 'EMPTY' ? 'badge badge--muted' : 'badge'}>{status}</span>
        {tank.recordedOn && <span className="badge badge--muted">{formatDay(tank.recordedOn, locale)}</span>}
        {tank.quality?.retestRequired && <span className="badge badge--warning">{t.retest}</span>}
        {quarantined && <span className="badge badge--danger">QUARANTINE</span>}
      </footer>
      <p className="tank-card__lab">
        <button
          type="button"
          className={ffa == null ? 'qty-link' : stale ? 'qty-link qty-link--alert' : 'qty-link'}
          title={ffa != null ? ageTitle : undefined}
          onClick={() => onHistory(tank.tankId, 'ffa')}
        >
          FFA {ffa == null ? t.unavailable : `${formatMeasure(ffa)}%`}
        </button>
        {' · '}
        <button
          type="button"
          className={moisture == null ? 'qty-link' : stale ? 'qty-link qty-link--alert' : 'qty-link'}
          title={moisture != null ? ageTitle : undefined}
          onClick={() => onHistory(tank.tankId, 'moisture')}
        >
          M&I {moisture == null ? t.unavailable : `${formatMeasure(moisture)}%`}
        </button>
        {tank.quality?.analysisDate ? ` · ${formatDay(tank.quality.analysisDate, locale)}` : ''}
      </p>
    </article>
  )
}

function Metric({ label, value, onClick, alert = false }: { label: string; value: string; onClick?: () => void; alert?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {onClick
          ? <button type="button" className={alert ? 'qty-link qty-link--alert' : 'qty-link'} onClick={onClick}>{value}</button>
          : value}
      </dd>
    </div>
  )
}

function kg(value: number | null | undefined, blank: string): string {
  if (value == null) return blank
  return `${formatMeasure(value, 0)} kg`
}

function kgAmount(value: number | null | undefined, blank: string): string {
  if (value == null) return blank
  return `${formatKg(value)} kg`
}

function barPercent(tank: TankLive): number {
  if (tank.fillRatio == null) return levelPercent(tank.soundingLevelM)
  return Math.min(100, Math.max(0, tank.fillRatio * 100))
}
