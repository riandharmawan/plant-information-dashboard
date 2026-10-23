import { useEffect, useRef } from 'react'
import { formatDay, formatMeasure, tankLabel } from '../../domain/format.ts'
import type { LogisticsVehicle, TankLive } from '../../domain/types.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { LevelCue } from './LevelCue.tsx'
import { useMass } from './massUnit.ts'
import { isEmptyTank, isOverfilled, isTempAnomaly } from './tankAlerts.ts'

export type KpiKind = 'utilization' | 'activeEmpty' | 'alerts' | 'approval'

export function KpiDetailDialog({
  kind,
  title,
  tanks,
  averageTemperature,
  judged,
  day,
  windowStart,
  onClose,
}: {
  kind: KpiKind | null
  title: string
  tanks: TankLive[]
  averageTemperature: number | null
  judged: LogisticsVehicle[]
  day: string
  windowStart: string
  onClose: () => void
}) {
  const { t, locale } = useLocale()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (kind && !dialog.open) dialog.showModal()
    if (!kind && dialog.open) dialog.close()
  }, [kind])

  return (
    <dialog ref={dialogRef} className="stock-dialog stock-dialog--wide kpi-dialog" onClose={onClose}>
      {kind && (
        <>
          <h2>{title}</h2>
          <p className="stock-dialog__updated">
            {kind === 'approval'
              ? t.gateSamplesWindow.replace('{start}', formatDay(windowStart, locale)).replace('{end}', formatDay(day, locale))
              : formatDay(day, locale)}
          </p>
          {kind === 'utilization' && <UtilizationDetail tanks={tanks} />}
          {kind === 'activeEmpty' && <ActiveEmptyDetail tanks={tanks} />}
          {kind === 'alerts' && <AlertDetail tanks={tanks} averageTemperature={averageTemperature} />}
          {kind === 'approval' && <ApprovalDetail judged={judged} />}
          <div className="stock-dialog__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>{t.close}</button>
          </div>
        </>
      )}
    </dialog>
  )
}

function UtilizationDetail({ tanks }: { tanks: TankLive[] }) {
  const { t } = useLocale()
  const mass = useMass()
  const rows = tanks
    .filter((tank) => tank.capacityKg != null && tank.capacityKg > 0)
    .sort((left, right) => (right.fillRatio ?? -1) - (left.fillRatio ?? -1))
  const capacity = rows.reduce((sum, tank) => sum + (tank.capacityKg ?? 0), 0)
  const quantity = rows.reduce((sum, tank) => sum + (tank.quantityKg ?? 0), 0)
  const empty = rows.reduce((sum, tank) => sum + (tank.emptySpaceKg ?? 0), 0)

  return (
    <>
      <dl className="qty-stats">
        <Stat label={`${t.capacity} (${mass.symbol})`} value={mass.whole(capacity)} />
        <Stat label={`${t.quantity} (${mass.symbol})`} value={mass.amount(quantity)} />
        <Stat label={`${t.emptySpace} (${mass.symbol})`} value={mass.amount(empty)} />
      </dl>
      <div className="stock-dialog__scroll">
        <table className="stock-dialog__table">
          <thead>
            <tr>
              <th>{t.tank}</th>
              <th>{t.commodity}</th>
              <th className="num">{t.capacity} ({mass.symbol})</th>
              <th className="num">{t.quantity} ({mass.symbol})</th>
              <th className="num">{t.emptySpace} ({mass.symbol})</th>
              <th className="num">{t.tankLevelPct}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tank) => (
              <tr key={tank.tankId} className={isOverfilled(tank.fillRatio) ? 'stock-dialog__row--alert' : undefined}>
                <td>{tankLabel(tank.tankId)}</td>
                <td>{tank.productName || t.unavailable}</td>
                <td className="num">{mass.whole(tank.capacityKg)}</td>
                <td className="num">{tank.quantityKg == null ? t.unavailable : mass.amount(tank.quantityKg)}</td>
                <td className="num">{tank.emptySpaceKg == null ? t.unavailable : mass.amount(tank.emptySpaceKg)}</td>
                <td className="num"><LevelCue ratio={tank.fillRatio} blank={t.unavailable} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>{t.totalQuantity}</td>
              <td className="num">{mass.whole(capacity)}</td>
              <td className="num">{mass.amount(quantity)}</td>
              <td className="num">{mass.amount(empty)}</td>
              <td className="num"><LevelCue ratio={capacity > 0 ? quantity / capacity : null} blank={t.unavailable} /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  )
}

function ActiveEmptyDetail({ tanks }: { tanks: TankLive[] }) {
  const { t } = useLocale()
  const mass = useMass()
  const empty = tanks.filter(isEmptyTank)
  const active = tanks.filter((tank) => !isEmptyTank(tank))

  return (
    <div className="kpi-detail__split">
      <section>
        <p className="stock-dialog__kicker">{t.activeTanks} · {active.length}</p>
        <div className="stock-dialog__scroll">
          <table className="stock-dialog__table">
            <thead>
              <tr>
                <th>{t.tank}</th>
                <th>{t.commodity}</th>
                <th className="num">{t.quantity} ({mass.symbol})</th>
                <th className="num">{t.tankLevelPct}</th>
              </tr>
            </thead>
            <tbody>
              {active.map((tank) => (
                <tr key={tank.tankId}>
                  <td>{tankLabel(tank.tankId)}</td>
                  <td>{tank.productName || t.unavailable}</td>
                  <td className="num">{tank.quantityKg == null ? t.unavailable : mass.amount(tank.quantityKg)}</td>
                  <td className="num"><LevelCue ratio={tank.fillRatio} blank={t.unavailable} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <p className="stock-dialog__kicker">{t.emptyTanks} · {empty.length}</p>
        {empty.length === 0
          ? <p className="empty">{t.noRows}</p>
          : (
            <div className="stock-dialog__scroll">
              <table className="stock-dialog__table">
                <thead>
                  <tr>
                    <th>{t.tank}</th>
                    <th className="num">{t.capacity} ({mass.symbol})</th>
                    <th>{t.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {empty.map((tank) => (
                    <tr key={tank.tankId}>
                      <td>{tankLabel(tank.tankId)}</td>
                      <td className="num">{mass.whole(tank.capacityKg)}</td>
                      <td><span className="badge badge--muted">{tank.operationalStatus || t.unavailable}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
    </div>
  )
}

function AlertDetail({ tanks, averageTemperature }: { tanks: TankLive[]; averageTemperature: number | null }) {
  const { t } = useLocale()
  const avg = averageTemperature == null ? t.unavailable : `${formatMeasure(averageTemperature, 1)} °C`
  const rows = tanks.flatMap((tank) => {
    const overfilled = isOverfilled(tank.fillRatio)
    const hot = isTempAnomaly(tank.temperatureC, averageTemperature)
    return overfilled || hot ? [{ tank, overfilled, hot }] : []
  })

  return (
    <>
      <p className="kpi-detail__rule">{t.alertRule.replace('{avg}', avg)}</p>
      {rows.length === 0
        ? <p className="empty">{t.noCriticalAlerts}</p>
        : (
          <div className="stock-dialog__scroll">
            <table className="stock-dialog__table">
              <thead>
                <tr>
                  <th>{t.tank}</th>
                  <th>{t.commodity}</th>
                  <th className="num">{t.tankLevelPct}</th>
                  <th className="num">{t.tempAxis}</th>
                  <th>{t.status}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ tank, overfilled, hot }) => (
                  <tr key={tank.tankId}>
                    <td>{tankLabel(tank.tankId)}</td>
                    <td>{tank.productName || t.unavailable}</td>
                    <td className={overfilled ? 'num stock-dialog__alert' : 'num'}><LevelCue ratio={tank.fillRatio} blank={t.unavailable} /></td>
                    <td className={hot ? 'num stock-dialog__alert' : 'num'}>
                      {tank.temperatureC == null ? t.unavailable : `${formatMeasure(tank.temperatureC, 1)} °C`}
                    </td>
                    <td>
                      <span className="kpi-detail__reasons">
                        {overfilled && tank.fillRatio != null && (
                          <span className="badge badge--danger">{t.reasonOverfill.replace('{value}', `${(tank.fillRatio * 100).toFixed(1)}%`)}</span>
                        )}
                        {hot && tank.temperatureC != null && (
                          <span className="badge badge--danger">
                            {t.reasonHotTemp.replace('{value}', `${formatMeasure(tank.temperatureC, 1)} °C`).replace('{avg}', avg)}
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </>
  )
}

function ApprovalDetail({ judged }: { judged: LogisticsVehicle[] }) {
  const { t, locale } = useLocale()
  const rows = [...judged].sort((left, right) => (right.sampledOn ?? '').localeCompare(left.sampledOn ?? ''))
  const passed = rows.filter((item) => item.verdict === 'pass').length

  return (
    <>
      <dl className="qty-stats">
        <Stat label={t.pass} value={String(passed)} />
        <Stat label={t.rejected} value={String(rows.length - passed)} />
        <Stat label={t.approvalRate} value={rows.length === 0 ? t.unavailable : `${((passed / rows.length) * 100).toFixed(1)}%`} />
      </dl>
      {rows.length === 0
        ? <p className="empty">{t.noRows}</p>
        : (
          <div className="stock-dialog__scroll">
            <table className="stock-dialog__table">
              <thead>
                <tr>
                  <th>{t.sampleDay}</th>
                  <th>{t.vehicle}</th>
                  <th>{t.commodity}</th>
                  <th className="num">FFA</th>
                  <th className="num">M&I</th>
                  <th>{t.status}</th>
                  <th>{t.remark}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id} className={item.verdict === 'rejected' ? 'stock-dialog__row--alert' : undefined}>
                    <td>{formatDay(item.sampledOn, locale)}</td>
                    <td>
                      {item.name}
                      <span className="kpi-detail__mode">{item.mode === 'vessel' ? t.modeVessel : t.modeTruck}</span>
                    </td>
                    <td>{item.commodity || t.unavailable}</td>
                    <td className="num">{item.ffa == null ? t.unavailable : formatMeasure(item.ffa, 2)}</td>
                    <td className="num">{item.moisture == null ? t.unavailable : formatMeasure(item.moisture, 2)}</td>
                    <td>
                      <span className={item.verdict === 'pass' ? 'badge badge--pass' : 'badge badge--danger'}>
                        {item.verdict === 'pass' ? t.pass : t.rejected}
                      </span>
                    </td>
                    <td className="kpi-detail__remark">{item.remark || t.unavailable}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
