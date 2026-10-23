import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useCalibration } from '../../data/CalibrationContext.tsx'
import { useRepository } from '../../data/OperationsContext.tsx'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import type { LogisticsVehicle, SiteContext, SnapshotMeta, TankLive } from '../../domain/types.ts'
import { formatDay, inDateRange, tankLabel } from '../../domain/format.ts'
import { DateRangeFilter } from '../daily-production/DateRangeFilter.tsx'
import { addDays, usePeriodRange } from '../usePeriodRange.ts'
import { CommodityFilter } from './CommodityFilter.tsx'
import { CommodityStock } from './CommodityStock.tsx'
import { TankCard } from './TankCard.tsx'
import { TankTable } from './TankTable.tsx'
import { QuantityHistoryDialog } from './QuantityHistoryDialog.tsx'
import type { HistoryMetric } from './quantitySeries.ts'
import { isCritical, isEmptyTank } from './tankAlerts.ts'
import { MassUnitContext, useMassUnitState } from './massUnit.ts'
import { KpiDetailDialog, type KpiKind } from './KpiDetailDialog.tsx'

type TankView = 'table' | 'grid'

/** Lab results and gate samples look back this many days from the selected day. */
const LOOKBACK_DAYS = 30

export function LiveOpsPage() {
  const { t, locale } = useLocale()
  const repository = useRepository()
  const { revision } = useCalibration()
  const [site, setSite] = useState<SiteContext | null>(null)
  const [meta, setMeta] = useState<SnapshotMeta | null>(null)
  const [tanks, setTanks] = useState<TankLive[]>([])
  const [logistics, setLogistics] = useState<LogisticsVehicle[]>([])
  const [commodity, setCommodity] = useState<string[] | null>(null)
  const [tankView, setTankView] = useState<TankView>('table')
  const [history, setHistory] = useState<{ tankId: string; metric: HistoryMetric; commodity: string } | null>(null)
  const [massUnit, setMassUnit] = useMassUnitState()
  const [kpiDetail, setKpiDetail] = useState<KpiKind | null>(null)
  const range = usePeriodRange(meta?.periodLabel ?? null, 1)
  const day = range.ready ? range.end : ''
  const lookbackStart = day ? addDays(day, -(LOOKBACK_DAYS - 1)) : ''

  useEffect(() => {
    let active = true
    Promise.all([
      repository.getSite(),
      repository.getSnapshotMeta(),
      repository.getLiveLogistics(),
    ]).then(([nextSite, nextMeta, nextLogistics]) => {
      if (!active) return
      setSite(nextSite)
      setMeta(nextMeta)
      setLogistics(nextLogistics)
    })
    return () => {
      active = false
    }
  }, [repository])

  const farmDay = day ? latestSoundingDay(meta?.soundingDates ?? [], day) : null

  useEffect(() => {
    if (!day) return
    let active = true
    repository.getLiveTanks(farmDay, { start: lookbackStart, end: day }).then((nextTanks) => {
      if (active) setTanks(nextTanks)
    })
    return () => {
      active = false
    }
  }, [repository, revision, day, lookbackStart, farmDay])

  const openHistory = (tankId: string, metric: HistoryMetric) => {
    const product = tanks.find((tank) => tank.tankId === tankId)?.productName ?? ''
    setHistory({ tankId, metric, commodity: product })
  }
  const families = [...new Set(tanks.map((tank) => tank.oilFamily))].sort()
  const visible = commodity == null ? tanks : tanks.filter((tank) => commodity.includes(tank.oilFamily))
  const gateVehicles = logistics.filter((item) => !day || inDateRange(item.sampledOn, lookbackStart, day))
  const judged = gateVehicles.filter((item) => item.oilFamily === 'CPO' && item.verdict !== 'spec-pending')
  const tempValue = mean(visible.filter((tank) => tank.soundingLevelM != null).map((tank) => tank.temperatureC))
  const approval = judged.length === 0 ? t.unavailable : `${((judged.filter((item) => item.verdict === 'pass').length / judged.length) * 100).toFixed(1)}%`

  const stored = visible.filter((tank) => tank.capacityKg != null && tank.capacityKg > 0)
  const capacityTotal = stored.reduce((sum, tank) => sum + (tank.capacityKg ?? 0), 0)
  const quantityTotal = stored.reduce((sum, tank) => sum + (tank.quantityKg ?? 0), 0)
  const utilization = capacityTotal > 0 && stored.some((tank) => tank.quantityKg != null) ? quantityTotal / capacityTotal : null
  const emptyCount = visible.filter(isEmptyTank).length
  const activeCount = visible.length - emptyCount
  const critical = visible.filter((tank) => isCritical(tank, tempValue))
  const kpiTitles: Record<KpiKind, string> = {
    utilization: t.storageUtilization,
    activeEmpty: t.activeVsEmpty,
    alerts: t.criticalAlerts,
    approval: judged.length > 0 ? `${t.approvalRate} · ${t.incomingCpo}` : t.approvalRate,
  }

  return (
    <MassUnitContext value={massUnit}>
      <div className="page page--prod page--ops">
        <header className="page-title-row">
          <h1 className="page-title">{t.liveOps}</h1>
          <span className="site-pill">
            <span className="site-pill__dot" aria-hidden="true" />
            {t.siteLabel} {site?.siteName ?? 'Priscolin Bekasi'}
          </span>
          <span className="page-meta">
            {farmDay ? formatDay(farmDay, locale) : t.noSounding}
          </span>
          <div className="view-toggle" role="group" aria-label={t.massUnit}>
            <button type="button" aria-pressed={massUnit === 'ton'} onClick={() => setMassUnit('ton')}>{t.unitTon}</button>
            <button type="button" aria-pressed={massUnit === 'kg'} onClick={() => setMassUnit('kg')}>{t.unitKg}</button>
          </div>
          {range.ready && (
            <DateRangeFilter
              single
              start={day}
              end={day}
              dataDates={meta?.soundingDates ?? []}
              onChange={range.onChange}
            />
          )}
        </header>

        <div className="live-ops">
          <div className="live-ops__primary">
            <section className="prod-kpis" aria-label="Summary">
              <Kpi
                label={kpiTitles.utilization}
                value={utilization == null ? t.unavailable : `${(utilization * 100).toFixed(1)}%`}
                track={utilization}
                onOpen={() => setKpiDetail('utilization')}
              />
              <Kpi
                label={kpiTitles.activeEmpty}
                value={visible.length === 0 ? t.unavailable : `${activeCount} / ${emptyCount}`}
                sub={t.activeEmptySub}
                onOpen={() => setKpiDetail('activeEmpty')}
              />
              <Kpi
                label={kpiTitles.alerts}
                value={visible.length === 0 ? t.unavailable : String(critical.length)}
                sub={critical.length > 0 ? critical.map((tank) => tankLabel(tank.tankId)).join(', ') : t.criticalAlertsSub}
                tone={critical.length > 0 ? 'alert' : undefined}
                onOpen={() => setKpiDetail('alerts')}
              />
              <Kpi
                label={kpiTitles.approval}
                value={approval}
                tone={judged.length > 0 ? 'yield' : undefined}
                onOpen={() => setKpiDetail('approval')}
              />
            </section>
            <CommodityStock tanks={tanks} day={day} averageTemperature={tempValue} />
            <section className="prod-panel">
              <div className="section-head">
                <h2 className="card__title">{t.tanks}</h2>
                <div className="section-head__tools">
                  <div className="view-toggle" role="group" aria-label={t.tanks}>
                    <button type="button" aria-pressed={tankView === 'table'} onClick={() => setTankView('table')}>{t.tableView}</button>
                    <button type="button" aria-pressed={tankView === 'grid'} onClick={() => setTankView('grid')}>{t.gridView}</button>
                  </div>
                  <CommodityFilter families={families} selected={commodity} onChange={setCommodity} />
                </div>
              </div>
              {tankView === 'table'
                ? <TankTable tanks={visible} averageTemperature={tempValue} onHistory={openHistory} />
                : (
                  <div className="tank-grid tank-grid--vessels">
                    {visible.map((tank) => (
                      <TankCard key={tank.tankId} tank={tank} averageTemperature={tempValue} onHistory={openHistory} />
                    ))}
                  </div>
                )}
            </section>
          </div>
        </div>
        {day && (
          <QuantityHistoryDialog
            tankId={history?.tankId ?? null}
            commodity={history?.commodity ?? ''}
            metric={history?.metric ?? 'quantity'}
            start={lookbackStart}
            end={day}
            onClose={() => setHistory(null)}
          />
        )}
        <KpiDetailDialog
          kind={kpiDetail}
          title={kpiDetail ? kpiTitles[kpiDetail] : ''}
          tanks={visible}
          averageTemperature={tempValue}
          judged={judged}
          day={day}
          windowStart={lookbackStart}
          onClose={() => setKpiDetail(null)}
        />
      </div>
    </MassUnitContext>
  )
}

function latestSoundingDay(dates: string[], day: string): string | null {
  let latest: string | null = null
  for (const date of dates) {
    if (date <= day && (latest == null || date > latest)) latest = date
  }
  return latest
}

function mean(values: Array<number | null>): number | null {
  const nums = values.filter((value): value is number => value != null)
  if (nums.length === 0) return null
  return nums.reduce((sum, value) => sum + value, 0) / nums.length
}

function Kpi({
  label,
  value,
  tone,
  sub,
  track,
  onOpen,
}: {
  label: string
  value: string
  tone?: 'yield' | 'alert'
  sub?: string
  track?: number | null
  onOpen: () => void
}) {
  const { t } = useLocale()
  const className = ['prod-kpi', 'prod-kpi--button', tone ? `prod-kpi--${tone}` : ''].filter(Boolean).join(' ')
  const percent = track == null ? null : Math.min(100, Math.max(0, track * 100))
  return (
    <button type="button" className={className} title={t.kpiDetailHint} onClick={onOpen}>
      <ChevronRight className="prod-kpi__go" size={16} aria-hidden="true" />
      <strong>{value}</strong>
      <span>{label}</span>
      {sub && <small className="prod-kpi__sub">{sub}</small>}
      {percent != null && (
        <span className="prod-kpi__track" aria-hidden="true">
          <span className="prod-kpi__fill" style={{ width: `${percent}%` }} />
        </span>
      )}
    </button>
  )
}
