import { Lock } from 'lucide-react'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import type { LogisticsVehicle } from '../../domain/types.ts'
import { formatDay, formatMeasure } from '../../domain/format.ts'

export function LogisticsList({ vehicles }: { vehicles: LogisticsVehicle[] }) {
  const { t, locale } = useLocale()
  const vessels = vehicles.filter((item) => item.mode === 'vessel')
  const trucks = vehicles.filter((item) => item.mode === 'truck' && !item.routingLocked)
  const held = vehicles.filter((item) => item.mode === 'truck' && item.routingLocked)
  const truckCount = vehicles.filter((item) => item.mode === 'truck').length
  const rejected = vehicles.filter((item) => item.routingLocked).length
  const dates = [...new Set(trucks.map((item) => item.sampledOn ?? ''))]

  return (
    <div className="logistics">
      <p className="gatekeeper__kicker">
        {vessels.length} · {truckCount} · {rejected} {t.rejected}
      </p>
      {vehicles.length === 0 && <p className="empty">{t.noVehicles}</p>}
      {held.map((truck) => <TruckRow key={truck.id} truck={truck} />)}
      {vessels.map((vessel) => <VehicleCard key={vessel.id} vehicle={vessel} />)}
      {dates.map((date) => (
        <section key={date || 'undated'}>
          <h3 className="logistics__date">{formatDay(date || null, locale)}</h3>
          {trucks.filter((truck) => (truck.sampledOn ?? '') === date).map((truck) => (
            <TruckRow key={truck.id} truck={truck} />
          ))}
        </section>
      ))}
    </div>
  )
}

function Verdict({ vehicle }: { vehicle: LogisticsVehicle }) {
  const { t } = useLocale()
  if (vehicle.verdict === 'rejected') return <span className="badge badge--danger">{t.rejected}</span>
  if (vehicle.verdict === 'pass') return <span className="badge badge--pass">{t.pass}</span>
  return <span className="badge badge--muted">{t.specPending}</span>
}

function VehicleCard({ vehicle }: { vehicle: LogisticsVehicle }) {
  const { t, locale } = useLocale()
  return (
    <article className={vehicle.routingLocked ? 'vessel-card vessel-card--rejected' : 'vessel-card'}>
      <header className="vessel-card__head">
        <span className={vehicle.routingLocked ? 'status-dot status-dot--rejected' : 'status-dot'} aria-hidden="true" />
        <strong>{vehicle.name}</strong>
        <Verdict vehicle={vehicle} />
      </header>
      <p className="vessel-card__meta">{vehicle.commodity} · {formatDay(vehicle.sampledOn, locale)}</p>
      <p className="vessel-card__meta">FFA {formatMeasure(vehicle.ffa)}% · M&I {formatMeasure(vehicle.moisture)}%</p>
      {vehicle.detailLines.map((line) => <p key={line} className="vessel-card__detail">{line}</p>)}
      {vehicle.targetLabel && <p className="vessel-card__target">{t.target}: {vehicle.targetLabel}</p>}
      {vehicle.routingLocked && (
        <p className="vessel-card__lock"><Lock size={12} aria-hidden="true" /> FFA &gt; 5%</p>
      )}
    </article>
  )
}

function TruckRow({ truck }: { truck: LogisticsVehicle }) {
  const { t } = useLocale()
  return (
    <article className={truck.routingLocked ? 'truck-row truck-row--rejected' : 'truck-row'}>
      <div className="truck-row__title">
        <span className={truck.routingLocked ? 'status-dot status-dot--rejected' : 'status-dot'} aria-hidden="true" />
        <strong>{truck.name}</strong>
        <Verdict vehicle={truck} />
      </div>
      <p>FFA {formatMeasure(truck.ffa)}% · M&I {formatMeasure(truck.moisture)}%</p>
      {truck.targetLabel && <p>{t.target}: {truck.targetLabel}</p>}
      {truck.routingLocked && (
        <p className="vessel-card__lock"><Lock size={12} aria-hidden="true" /> FFA &gt; 5%</p>
      )}
    </article>
  )
}
