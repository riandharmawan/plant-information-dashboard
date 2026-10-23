import { useLocale } from '../../i18n/LocaleContext.tsx'
import type { TankLive } from '../../domain/types.ts'
import { formatDay, formatMeasure, levelPercent, parameter, tankLabel } from '../../domain/format.ts'
import { useMass } from './massUnit.ts'
import type { HistoryMetric } from './quantitySeries.ts'
import { fillTone, isCritical, isEmptyTank, isTempAnomaly } from './tankAlerts.ts'
import { TankVessel } from './TankVessel.tsx'

export function TankCard({ tank, averageTemperature, onHistory }: { tank: TankLive; averageTemperature: number | null; onHistory: (tankId: string, metric: HistoryMetric) => void }) {
  const { t, locale } = useLocale()
  const mass = useMass()
  const empty = isEmptyTank(tank)
  const quarantined = tank.quality?.storageVerdict === 'quarantine'
  const hot = isTempAnomaly(tank.temperatureC, averageTemperature)
  const critical = isCritical(tank, averageTemperature)
  const ffa = parameter(tank.quality?.parameters, 'FFA')
  const moisture = parameter(tank.quality?.parameters, 'MI')
  const stale = tank.quality?.ageDays != null && tank.quality.ageDays > 7
  const ageTitle = stale && tank.quality?.analysisDate
    ? t.qualityAge.replace('{age}', String(tank.quality.ageDays)).replace('{day}', formatDay(tank.quality.analysisDate, locale))
    : undefined
  const status = tank.operationalStatus || '—'
  const massAmount = (kg: number | null) => (kg == null ? t.unavailable : `${mass.amount(kg)} ${mass.symbol}`)

  return (
    <article className={[
      'tank-card',
      empty ? 'tank-card--empty' : '',
      quarantined ? 'tank-card--quarantine' : '',
      critical && !empty ? 'tank-card--critical' : '',
    ].filter(Boolean).join(' ')}>
      <header className="tank-card__head">
        <strong>{tankLabel(tank.tankId)}</strong>
        <span>{tank.productName || '—'}</span>
      </header>
      <div className="tank-card__body">
        <TankVessel
          percent={barPercent(tank)}
          tone={empty ? 'empty' : quarantined ? 'quarantine' : fillTone(tank.fillRatio)}
          temperatureC={tank.temperatureC}
          hot={hot}
          capacityKg={tank.capacityKg}
          capacityLabel={t.capacity}
          blank={t.unavailable}
        />
        <dl className="tank-card__metrics">
          <Metric label={t.capacity} value={tank.capacityKg == null ? t.unavailable : `${mass.whole(tank.capacityKg)} ${mass.symbol}`} />
          <Metric label={t.levelAxis} value={tank.soundingLevelM == null ? t.unavailable : `${formatMeasure(tank.soundingLevelM, 3)} m`} onClick={() => onHistory(tank.tankId, 'level')} />
          <Metric label={t.quantity} value={massAmount(tank.quantityKg)} onClick={() => onHistory(tank.tankId, 'quantity')} />
          <Metric label={t.emptySpace} value={massAmount(tank.emptySpaceKg)} onClick={() => onHistory(tank.tankId, 'emptySpace')} />
          <Metric label={t.loadable} value={massAmount(tank.loadableKg)} onClick={() => onHistory(tank.tankId, 'loadable')} />
          <Metric label={t.tankLevelPct} value={tank.fillRatio == null ? t.unavailable : `${(tank.fillRatio * 100).toFixed(1)}%`} alert={tank.fillRatio != null && tank.fillRatio > 0.8} onClick={() => onHistory(tank.tankId, 'levelTank')} />
          <Metric label={t.tempAxis} value={tank.temperatureC == null ? t.unavailable : `${formatMeasure(tank.temperatureC, 1)} °C`} alert={hot} onClick={() => onHistory(tank.tankId, 'temperature')} />
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

function barPercent(tank: TankLive): number {
  if (tank.fillRatio == null) return levelPercent(tank.soundingLevelM)
  return Math.min(100, Math.max(0, tank.fillRatio * 100))
}
