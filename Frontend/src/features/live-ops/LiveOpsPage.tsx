import { useEffect, useState } from 'react'
import { useCalibration } from '../../data/CalibrationContext.tsx'
import { useRepository } from '../../data/OperationsContext.tsx'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import type { LogisticsVehicle, SiteContext, SnapshotMeta, TankLive } from '../../domain/types.ts'
import { formatDay, formatKg, formatMeasure, inDateRange } from '../../domain/format.ts'
import { DateRangeFilter } from '../daily-production/DateRangeFilter.tsx'
import { usePeriodRange } from '../usePeriodRange.ts'
import { CommodityFilter } from './CommodityFilter.tsx'
import { CommodityStock } from './CommodityStock.tsx'
import { TankCard } from './TankCard.tsx'
import { TankTable } from './TankTable.tsx'
import { QuantityHistoryDialog } from './QuantityHistoryDialog.tsx'
import type { HistoryMetric } from './quantitySeries.ts'

type TankView = 'table' | 'grid'

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
  const range = usePeriodRange(meta?.periodLabel ?? null, 30)

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

  const farmDay = range.ready ? latestSoundingDay(meta?.soundingDates ?? [], range.start, range.end) : null

  useEffect(() => {
    if (!range.ready) return
    let active = true
    repository.getLiveTanks(farmDay, { start: range.start, end: range.end }).then((nextTanks) => {
      if (active) setTanks(nextTanks)
    })
    return () => {
      active = false
    }
  }, [repository, revision, range.ready, range.start, range.end, farmDay])

  const openHistory = (tankId: string, metric: HistoryMetric) => {
    const product = tanks.find((tank) => tank.tankId === tankId)?.productName ?? ''
    setHistory({ tankId, metric, commodity: product })
  }
  const families = [...new Set(tanks.map((tank) => tank.oilFamily))].sort()
  const visible = commodity == null ? tanks : tanks.filter((tank) => commodity.includes(tank.oilFamily))
  const gateVehicles = logistics.filter((item) => !range.ready || inDateRange(item.sampledOn, range.start, range.end))
  const judged = gateVehicles.filter((item) => item.oilFamily === 'CPO' && item.verdict !== 'spec-pending')
  const levelValue = mean(visible.map((tank) => tank.soundingLevelM))
  const tempValue = mean(visible.filter((tank) => tank.soundingLevelM != null).map((tank) => tank.temperatureC))
  const level = levelValue == null ? t.unavailable : `${formatMeasure(levelValue, 2)} m`
  const temp = tempValue == null ? t.unavailable : `${formatMeasure(tempValue, 1)} °C`
  const approval = judged.length === 0 ? t.unavailable : `${((judged.filter((item) => item.verdict === 'pass').length / judged.length) * 100).toFixed(1)}%`
  const quantityValues = visible.map((tank) => tank.quantityKg).filter((value): value is number => value != null)
  const totalQuantity = quantityValues.length === 0
    ? t.unavailable
    : `${formatKg(quantityValues.reduce((sum, value) => sum + value, 0))} kg`

  return (
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
        {range.ready && (
          <DateRangeFilter
            start={range.start}
            end={range.end}
            dataDates={meta?.dataDates ?? []}
            onChange={range.onChange}
          />
        )}
      </header>

      <div className="live-ops">
        <div className="live-ops__primary">
          <section className="prod-kpis" aria-label="Summary">
            <Kpi label={t.avgLevel} value={level} />
            <Kpi label={t.avgTemp} value={temp} />
            <Kpi label={t.totalQuantity} value={totalQuantity} />
            <Kpi label={judged.length > 0 ? `${t.approvalRate} · ${t.incomingCpo}` : t.approvalRate} value={approval} tone={judged.length > 0 ? 'yield' : undefined} />
          </section>
          <CommodityStock tanks={tanks} start={range.ready ? range.start : ''} end={range.ready ? range.end : ''} />
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
                <div className="tank-grid">
                  {visible.map((tank) => (
                    <TankCard key={tank.tankId} tank={tank} averageTemperature={tempValue} onHistory={openHistory} />
                  ))}
                </div>
              )}
          </section>
        </div>
      </div>
      {range.ready && (
        <QuantityHistoryDialog
          tankId={history?.tankId ?? null}
          commodity={history?.commodity ?? ''}
          metric={history?.metric ?? 'quantity'}
          start={range.start}
          end={range.end}
          onClose={() => setHistory(null)}
        />
      )}
    </div>
  )
}

function latestSoundingDay(dates: string[], start: string, end: string): string | null {
  let latest: string | null = null
  for (const date of dates) {
    if (date >= start && date <= end && (latest == null || date > latest)) latest = date
  }
  return latest
}

function mean(values: Array<number | null>): number | null {
  const nums = values.filter((value): value is number => value != null)
  if (nums.length === 0) return null
  return nums.reduce((sum, value) => sum + value, 0) / nums.length
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'yield' }) {
  return (
    <article className={tone === 'yield' ? 'prod-kpi prod-kpi--yield' : 'prod-kpi'}>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  )
}
