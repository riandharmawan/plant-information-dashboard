import { useEffect, useState } from 'react'
import { useRepository } from '../../data/OperationsContext.tsx'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import type { LabHistoryPoint, MovementTotal, SnapshotMeta, SoundingPoint } from '../../domain/types.ts'
import { formatMeasure, inDateRange, tankLabel } from '../../domain/format.ts'
import { DateRangeFilter } from '../daily-production/DateRangeFilter.tsx'
import { usePeriodRange } from '../usePeriodRange.ts'
import { MovementChart } from './MovementChart.tsx'
import { QualityChart } from './QualityChart.tsx'
import { TrendChart } from './TrendChart.tsx'

export function OpsAnalyticsPage() {
  const { t } = useLocale()
  const repository = useRepository()
  const [tankId, setTankId] = useState('T01')
  const [options, setOptions] = useState<string[]>([])
  const [history, setHistory] = useState<SoundingPoint[]>([])
  const [labs, setLabs] = useState<LabHistoryPoint[]>([])
  const [movements, setMovements] = useState<MovementTotal[]>([])
  const [meta, setMeta] = useState<SnapshotMeta | null>(null)
  const range = usePeriodRange(meta?.periodLabel ?? null)

  useEffect(() => {
    let active = true
    Promise.all([
      repository.getLiveTanks(),
      repository.getSnapshotMeta(),
      repository.getMovementSummary(),
    ]).then(([tanks, nextMeta, nextMovements]) => {
      if (!active) return
      setOptions(tanks.map((tank) => tank.tankId))
      setMeta(nextMeta)
      setMovements(nextMovements)
    })
    return () => {
      active = false
    }
  }, [repository])

  useEffect(() => {
    let active = true
    Promise.all([
      repository.getSoundingHistory(tankId),
      repository.getLabHistory(tankId),
    ]).then(([nextHistory, nextLabs]) => {
      if (!active) return
      setHistory(nextHistory)
      setLabs(nextLabs)
    })
    return () => {
      active = false
    }
  }, [repository, tankId])

  const scopedHistory = history.filter((point) => !range.ready || inDateRange(point.recordedOn, range.start, range.end))
  const levelValue = mean(scopedHistory.map((point) => point.soundingLevelM))
  const tempValue = mean(scopedHistory.map((point) => point.temperatureC))
  const level = levelValue == null ? t.unavailable : `${formatMeasure(levelValue, 2)} m`
  const temp = tempValue == null ? t.unavailable : `${formatMeasure(tempValue, 1)} °C`
  const scopedLabs = labs.filter((point) => !range.ready || inDateRange(point.analysisDate ?? point.snapshotOn, range.start, range.end))

  return (
    <div className="page page--prod page--ops">
      <header className="page-title-row">
        <h1 className="page-title">{t.opsAnalytics}</h1>
        {range.ready && (
          <DateRangeFilter
            start={range.start}
            end={range.end}
            dataDates={meta?.dataDates ?? []}
            onChange={range.onChange}
          />
        )}
        <label className="filter-chip">
          {t.tank}
          <select value={tankId} aria-label={t.tank} onChange={(event) => setTankId(event.target.value)}>
            {options.map((id) => <option key={id} value={id}>{tankLabel(id)}</option>)}
          </select>
        </label>
      </header>

      <section className="prod-kpis" aria-label="Summary">
        <Kpi label={`${t.avgLevel} · ${tankLabel(tankId)}`} value={level} />
        <Kpi label={t.avgTemp} value={temp} />
        <Kpi label={t.throughput} value={t.unavailable} />
        <Kpi label={t.approvalRate} value={t.unavailable} />
      </section>

      <div className="prod-layout ops-charts">
        <section className="prod-panel">
          <h2 className="card__title">{t.levelTemp} · {tankLabel(tankId)}</h2>
          <TrendChart points={scopedHistory} height={168} />
        </section>
        <section className="prod-panel">
          <h2 className="card__title">{t.qualityLog} · {tankLabel(tankId)}</h2>
          <QualityChart points={scopedLabs} height={168} />
        </section>
      </div>

      <section className="prod-panel">
        <h2 className="card__title">{t.charging}</h2>
        <MovementChart rows={movements} height={150} />
      </section>
    </div>
  )
}

function mean(values: Array<number | null>): number | null {
  const nums = values.filter((value): value is number => value != null)
  if (nums.length === 0) return null
  return nums.reduce((sum, value) => sum + value, 0) / nums.length
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <article className="prod-kpi">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  )
}
