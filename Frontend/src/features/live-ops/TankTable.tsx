import { useState } from 'react'
import { Info } from 'lucide-react'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import type { TankLive } from '../../domain/types.ts'
import { formatDay, formatMeasure, parameter, tankLabel } from '../../domain/format.ts'
import { useMass } from './massUnit.ts'
import type { HistoryMetric } from './quantitySeries.ts'
import { isEmptyTank, isTempAnomaly } from './tankAlerts.ts'

type SortDir = 'asc' | 'desc'
type SortValue = string | number | null

export function TankTable({ tanks, averageTemperature, onHistory }: { tanks: TankLive[]; averageTemperature: number | null; onHistory: (tankId: string, metric: HistoryMetric) => void }) {
  const { t, locale } = useLocale()
  const mass = useMass()
  const [key, setKey] = useState<string | null>(null)
  const [dir, setDir] = useState<SortDir>('asc')
  const sort = {
    key,
    dir,
    toggle: (next: string) => {
      if (key !== next) {
        setKey(next)
        setDir('asc')
        return
      }
      setDir((current) => (current === 'asc' ? 'desc' : 'asc'))
    },
  }
  const rows = sortTanks(tanks, key, dir)

  return (
    <div className="prod-scroll prod-scroll--tanks">
      <table className="prod-table prod-table--tanks">
        <colgroup>
          <col className="tank-col tank-col--id" />
          <col className="tank-col tank-col--name" />
          <col className="tank-col tank-col--kg" />
          <col className="tank-col tank-col--level" />
          <col className="tank-col tank-col--kg" />
          <col className="tank-col tank-col--kg" />
          <col className="tank-col tank-col--kg" />
          <col className="tank-col tank-col--fill" />
          <col className="tank-col tank-col--temp" />
          <col className="tank-col tank-col--lab" />
          <col className="tank-col tank-col--lab" />
        </colgroup>
        <thead>
          <tr>
            <SortHeader label={t.tank} column="tank" sort={sort} />
            <SortHeader label={t.commodity} column="commodity" sort={sort} />
            <SortHeader label={`${t.capacity} (${mass.symbol})`} column="capacity" sort={sort} align="right" />
            <SortHeader label={t.levelAxis} column="level" sort={sort} align="right" />
            <SortHeader label={`${t.quantity} (${mass.symbol})`} column="quantity" sort={sort} align="right" />
            <SortHeader label={`${t.emptySpace} (${mass.symbol})`} column="empty" sort={sort} align="right" />
            <SortHeader label={`${t.loadable} (${mass.symbol})`} column="loadable" sort={sort} align="right" />
            <SortHeader label={t.tankLevelPct} column="levelPct" sort={sort} align="right" hint={t.levelFillHint} />
            <SortHeader label={t.tempAxis} column="temp" sort={sort} align="right" hint={t.tempSpikeHint} />
            <SortHeader label="FFA" column="ffa" sort={sort} align="right" hint={t.ffaAgeHint} />
            <SortHeader label="M&I" column="moisture" sort={sort} align="right" hint={t.ffaAgeHint} />
          </tr>
        </thead>
        <tbody>
          {rows.map((tank) => {
            const empty = isEmptyTank(tank)
            const quarantined = tank.quality?.storageVerdict === 'quarantine'
            const ffa = parameter(tank.quality?.parameters, 'FFA')
            const moisture = parameter(tank.quality?.parameters, 'MI')
            const stale = qualityStale(tank)
            const ageTitle = stale ? qualityAgeTitle(tank, t.qualityAge, locale) : undefined
            const rowClass = [
              empty ? 'prod-row--empty' : '',
              quarantined ? 'prod-row--quarantine' : '',
            ].filter(Boolean).join(' ')
            return (
              <tr key={tank.tankId} className={rowClass || undefined}>
                <td className="prod-plant">{tankLabel(tank.tankId)}</td>
                <td>{tank.productName || t.unavailable}</td>
                <td className="num">{tank.capacityKg == null ? t.unavailable : mass.whole(tank.capacityKg)}</td>
                <HistoryCell value={tank.soundingLevelM == null ? t.unavailable : formatMeasure(tank.soundingLevelM, 3)} missing={tank.soundingLevelM == null} onClick={() => onHistory(tank.tankId, 'level')} />
                <HistoryCell value={tank.quantityKg == null ? t.unavailable : mass.amount(tank.quantityKg)} missing={tank.quantityKg == null} onClick={() => onHistory(tank.tankId, 'quantity')} />
                <HistoryCell value={tank.emptySpaceKg == null ? t.unavailable : mass.amount(tank.emptySpaceKg)} missing={tank.emptySpaceKg == null} onClick={() => onHistory(tank.tankId, 'emptySpace')} />
                <HistoryCell value={tank.loadableKg == null ? t.unavailable : mass.amount(tank.loadableKg)} missing={tank.loadableKg == null} alert={tank.loadableKg != null && tank.loadableKg < 0} onClick={() => onHistory(tank.tankId, 'loadable')} />
                <td className="num">
                  <button type="button" className={levelClass(tank.fillRatio)} onClick={() => onHistory(tank.tankId, 'levelTank')}>
                    <LevelCue ratio={tank.fillRatio} blank={t.unavailable} />
                  </button>
                </td>
                <HistoryCell value={tank.temperatureC == null ? t.unavailable : formatMeasure(tank.temperatureC, 1)} missing={tank.temperatureC == null} alert={isTempAnomaly(tank.temperatureC, averageTemperature)} onClick={() => onHistory(tank.tankId, 'temperature')} />
                <HistoryCell value={ffa == null ? t.unavailable : formatMeasure(ffa)} missing={ffa == null} alert={ffa != null && stale} title={ffa != null ? ageTitle : undefined} onClick={() => onHistory(tank.tankId, 'ffa')} />
                <HistoryCell value={moisture == null ? t.unavailable : formatMeasure(moisture)} missing={moisture == null} alert={moisture != null && stale} title={moisture != null ? ageTitle : undefined} onClick={() => onHistory(tank.tankId, 'moisture')} />
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function sortTanks(tanks: TankLive[], key: string | null, dir: SortDir): TankLive[] {
  if (!key) return tanks
  const sign = dir === 'asc' ? 1 : -1
  return [...tanks].sort((left, right) => {
    const a = sortValue(left, key)
    const b = sortValue(right, key)
    if (a == null && b == null) return 0
    if (a == null) return 1
    if (b == null) return -1
    if (typeof a === 'number' && typeof b === 'number') return (a - b) * sign
    return String(a).localeCompare(String(b), undefined, { numeric: true }) * sign
  })
}

function sortValue(tank: TankLive, key: string): SortValue {
  if (key === 'tank') return tankLabel(tank.tankId)
  if (key === 'commodity') return tank.productName || null
  if (key === 'capacity') return tank.capacityKg
  if (key === 'level') return tank.soundingLevelM
  if (key === 'quantity') return tank.quantityKg
  if (key === 'empty') return tank.emptySpaceKg
  if (key === 'loadable') return tank.loadableKg
  if (key === 'levelPct') return tank.fillRatio
  if (key === 'temp') return tank.temperatureC
  if (key === 'ffa') return parameter(tank.quality?.parameters, 'FFA')
  if (key === 'moisture') return parameter(tank.quality?.parameters, 'MI')
  return null
}

function SortHeader({
  label,
  column,
  sort,
  align = 'left',
  hint,
}: {
  label: string
  column: string
  sort: { key: string | null; dir: SortDir; toggle: (column: string) => void }
  align?: 'left' | 'right'
  hint?: string
}) {
  const active = sort.key === column
  const mark = active ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'
  return (
    <th className={align === 'right' ? 'num' : undefined} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <span className="th-label">
        <button type="button" className="prod-sort" onClick={() => sort.toggle(column)}>
          {label}
          <span className={active ? 'prod-sort__mark prod-sort__mark--on' : 'prod-sort__mark'}>{mark}</span>
        </button>
        {hint && <HeaderHint text={hint} />}
      </span>
    </th>
  )
}

function HeaderHint({ text }: { text: string }) {
  return (
    <button type="button" className="col-hint" aria-label={text}>
      <Info size={12} strokeWidth={2.25} aria-hidden="true" />
      <span className="col-hint__tip" role="tooltip">{text}</span>
    </button>
  )
}

function levelClass(ratio: number | null): string {
  if (ratio == null) return 'qty-link qty-link--missing'
  if (ratio > 0.8) return 'qty-link qty-link--alert'
  return 'qty-link'
}

function HistoryCell({ value, onClick, stale = false, alert = false, missing = false, title }: { value: string; onClick: () => void; stale?: boolean; alert?: boolean; missing?: boolean; title?: string }) {
  const className = [
    'qty-link',
    missing ? 'qty-link--missing' : '',
    stale ? 'qty-link--stale' : '',
    alert ? 'qty-link--alert' : '',
  ].filter(Boolean).join(' ')
  return (
    <td className="num">
      <button type="button" className={className} title={title} onClick={onClick}>{value}</button>
    </td>
  )
}

function qualityStale(tank: TankLive): boolean {
  const age = tank.quality?.ageDays
  return age != null && age > 7
}

function qualityAgeTitle(tank: TankLive, template: string, locale: 'en' | 'id'): string | undefined {
  const age = tank.quality?.ageDays
  const day = tank.quality?.analysisDate
  if (age == null || !day) return undefined
  return template.replace('{age}', String(age)).replace('{day}', formatDay(day, locale))
}

function LevelCue({ ratio, blank }: { ratio: number | null; blank: string }) {
  if (ratio == null) return blank
  const percent = Math.min(100, Math.max(0, ratio * 100))
  const tone = percent >= 85 ? 'high' : percent >= 50 ? 'mid' : 'low'
  return (
    <span className={`level-cue level-cue--${tone}`}>
      <span className="level-cue__track" aria-hidden="true">
        <span className="level-cue__fill" style={{ width: `${percent}%` }} />
      </span>
      <span className="level-cue__value">{percent.toFixed(1)}%</span>
    </span>
  )
}
