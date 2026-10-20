import { useMemo, useState } from 'react'
import {
  PRODUCTION_DAYS,
  coproductYield,
  lossOf,
  lossYield,
  productYield,
  productionForRange,
  ratio,
  type PlantDay,
  type PlantKey,
  type Qty,
} from '../../domain/dailyProduction.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { DateRangeFilter } from './DateRangeFilter.tsx'
import { PlantTabs, useProductionRange } from './productionNav.tsx'

type SortDir = 'asc' | 'desc'
type SortValue = string | number | null

type Col = {
  key: string
  label: string
  pct?: boolean
  get: (plant: PlantDay) => Qty
}

type KpiSpec = {
  label: string
  get: (plant: PlantDay) => Qty
  tone?: 'yield'
  pct?: boolean
  digits?: number
}

type TableSpec = {
  title: string
  columns: Col[]
}

const none = (): Qty => null

function qtyCol(key: string, label: string, get: (plant: PlantDay) => Qty): Col {
  return { key, label, get }
}

function pctCol(key: string, label: string, get: (plant: PlantDay) => Qty): Col {
  return { key, label, get, pct: true }
}

function blankPlant(yieldApplicable: boolean): PlantDay {
  return {
    feed: null,
    product: null,
    coproduct: null,
    beBags: null,
    pa: null,
    powerKwh: null,
    gasMmBtu: null,
    steam: null,
    water: null,
    compressor: null,
    yieldApplicable,
  }
}

function yieldOn(key: PlantKey): boolean {
  return key === 'refinery500' || key === 'refinery150' || key === 'separator'
}

function plantOn(id: string, key: PlantKey): PlantDay {
  const hit = PRODUCTION_DAYS.find((day) => day.id === id)?.[key]
  const applicable = yieldOn(key)
  if (!hit) return blankPlant(applicable)
  return { ...hit, yieldApplicable: applicable }
}

function datesBetween(start: string, end: string): string[] {
  const from = start <= end ? start : end
  const to = start <= end ? end : start
  const dates: string[] = []
  let cursor = from
  while (cursor <= to && dates.length < 400) {
    dates.push(cursor)
    const next = new Date(`${cursor}T00:00:00`)
    next.setDate(next.getDate() + 1)
    const month = String(next.getMonth() + 1).padStart(2, '0')
    const day = String(next.getDate()).padStart(2, '0')
    cursor = `${next.getFullYear()}-${month}-${day}`
  }
  return dates
}

function numClass(value: Qty, kind?: 'yield'): string {
  const names = ['num']
  if (value == null) names.push('num--empty')
  else if (value < 0) names.push('num--neg')
  else if (kind) names.push(`num--${kind}`)
  return names.join(' ')
}

function useColumnSort() {
  const [key, setKey] = useState<string | null>(null)
  const [dir, setDir] = useState<SortDir>('asc')
  const toggle = (next: string) => {
    if (key !== next) {
      setKey(next)
      setDir('asc')
      return
    }
    setDir((current) => (current === 'asc' ? 'desc' : 'asc'))
  }
  return { key, dir, toggle }
}

function sortRows<T>(rows: T[], key: string | null, dir: SortDir, valueOf: (row: T, key: string) => SortValue): T[] {
  if (!key) return rows
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((left, right) => {
    const a = valueOf(left, key)
    const b = valueOf(right, key)
    if (a == null && b == null) return 0
    if (a == null) return 1
    if (b == null) return -1
    if (typeof a === 'number' && typeof b === 'number') return (a - b) * sign
    return String(a).localeCompare(String(b), undefined, { numeric: true }) * sign
  })
}

function refineryChemicals(t: ReturnType<typeof useLocale>['t']): Col[] {
  return [
    qtyCol('ssa', 'SSA', none),
    qtyCol('ssb', 'SSB', none),
    qtyCol('ssm', 'SSM', none),
    qtyCol('clariant', 'Clariant 331S', none),
    qtyCol('m331', '331M', none),
    qtyCol('be', t.beBags, (plant) => plant.beBags),
    qtyCol('pa', t.paLogged, (plant) => plant.pa),
    qtyCol('power', t.powerKwh, (plant) => plant.powerKwh),
    qtyCol('powerRatio', t.powerRatio, (plant) => ratio(plant.powerKwh, plant.feed)),
    qtyCol('steam', t.steamLogged, (plant) => plant.steam),
    qtyCol('gas', t.gasMmBtu, (plant) => plant.gasMmBtu),
    qtyCol('gasRatio', t.gasRatio, (plant) => ratio(plant.gasMmBtu, plant.feed)),
    qtyCol('water', t.water, (plant) => plant.water),
    qtyCol('compressor', t.compressor, (plant) => plant.compressor),
    qtyCol('solar', t.solar, none),
    qtyCol('fame', t.fame, none),
  ]
}

function fractUtilities(t: ReturnType<typeof useLocale>['t']): Col[] {
  return [
    qtyCol('power', t.powerKwh, (plant) => plant.powerKwh),
    qtyCol('steam', t.steamLogged, (plant) => plant.steam),
    qtyCol('compressor', t.compressor, (plant) => plant.compressor),
    qtyCol('water', t.water, (plant) => plant.water),
  ]
}

function refineryBalance(t: ReturnType<typeof useLocale>['t'], feeds: Col[]): Col[] {
  return [
    ...feeds,
    qtyCol('total', t.totalFeed, (plant) => plant.feed),
    qtyCol('product', `${t.rbdpo} (t)`, (plant) => plant.product),
    pctCol('productYield', t.yieldPct, productYield),
    qtyCol('pfad', `${t.pfad} (t)`, (plant) => plant.coproduct),
    pctCol('pfadYield', t.yieldPct, coproductYield),
    qtyCol('loss', t.loss, lossOf),
    pctCol('lossYield', t.yieldPct, lossYield),
  ]
}

export function Refinery500Page() {
  const { t } = useLocale()
  return (
    <PlantSection
      title={t.refinery500}
      plantKey="refinery500"
      kpis={[
        { label: t.feed, get: (plant) => plant.feed },
        { label: `${t.rbdpo} ${t.yieldPct}`, get: productYield, tone: 'yield', pct: true },
        { label: `${t.pfad} ${t.yieldPct}`, get: coproductYield, tone: 'yield', pct: true },
        { label: t.loss, get: lossOf },
      ]}
      tables={[
        {
          title: t.refinery500,
          columns: refineryBalance(t, [
            qtyCol('cpo', `${t.cpo} (t)`, (plant) => plant.feed),
            qtyCol('rbdpoIn', t.rbdpoIn, none),
            qtyCol('rbdpsIn', 'RBDPS (t)', none),
          ]),
        },
        { title: t.chemicalsUtilities, columns: refineryChemicals(t) },
      ]}
    />
  )
}

export function Refinery150Page() {
  const { t } = useLocale()
  return (
    <PlantSection
      title={t.refinery150}
      plantKey="refinery150"
      kpis={[
        { label: t.feed, get: (plant) => plant.feed },
        { label: `${t.rbdpo} ${t.yieldPct}`, get: productYield, tone: 'yield', pct: true },
        { label: `${t.pfad} ${t.yieldPct}`, get: coproductYield, tone: 'yield', pct: true },
        { label: t.loss, get: lossOf },
      ]}
      tables={[
        {
          title: t.refinery150,
          columns: [
            qtyCol('cpo', `${t.cpo} (t)`, (plant) => plant.feed),
            qtyCol('washed', `${t.washedCpo} (t)`, none),
            qtyCol('iv64In', t.oleinIv64, none),
            qtyCol('rbdpsIn', 'RBDPS (t)', none),
            qtyCol('rbdpoIn', t.rbdpoIn, none),
            qtyCol('lowGeIn', 'RBDPO low GE (t)', none),
            qtyCol('total', t.totalFeed, (plant) => plant.feed),
            qtyCol('product', `${t.rbdpo} (t)`, (plant) => plant.product),
            pctCol('productYield', t.yieldPct, productYield),
            qtyCol('lowGe', 'RBDPO low GE (t)', none),
            qtyCol('iv64', t.oleinIv64, none),
            qtyCol('drbdps', 'DRBDPS (t)', none),
            qtyCol('drbdpo', 'DRBDPO (t)', none),
            qtyCol('drbdpoLow', 'DRBDPO low GE (t)', none),
            qtyCol('pfad', `${t.pfad} (t)`, (plant) => plant.coproduct),
            pctCol('pfadYield', t.yieldPct, coproductYield),
            qtyCol('loss', t.loss, lossOf),
            pctCol('lossYield', t.yieldPct, lossYield),
          ],
        },
        { title: t.chemicalsUtilities, columns: refineryChemicals(t) },
      ]}
    />
  )
}

export function Fractionation400Page() {
  const { t } = useLocale()
  return <FractionationSection title={t.fract400} plantKey="fract400" />
}

export function Fractionation500Page() {
  const { t } = useLocale()
  return <FractionationSection title={t.fract500} plantKey="fract500" />
}

function FractionationSection({ title, plantKey }: { title: string; plantKey: 'fract400' | 'fract500' }) {
  const { t } = useLocale()
  return (
    <PlantSection
      title={title}
      plantKey={plantKey}
      kpis={[
        { label: t.feed, get: (plant) => plant.feed },
        { label: t.oleinCp09, get: (plant) => plant.product },
        { label: `${t.stearin} (t)`, get: (plant) => plant.coproduct },
        { label: t.yieldPct, get: productYield, tone: 'yield', pct: true },
      ]}
      tables={[
        {
          title,
          columns: [
            qtyCol('rbdpoIn', `${t.rbdpo} (t)`, (plant) => plant.feed),
            qtyCol('cp10', 'Olein CP 10 (t)', none),
            qtyCol('total', t.totalFeed, (plant) => plant.feed),
            qtyCol('olein', t.oleinCp09, (plant) => plant.product),
            pctCol('oleinYield', t.yieldPct, productYield),
            qtyCol('iv64', t.oleinIv64, none),
            pctCol('iv64Yield', t.yieldPct, none),
            qtyCol('stearin', `${t.stearin} (t)`, (plant) => plant.coproduct),
            pctCol('stearinYield', t.yieldPct, none),
            qtyCol('pmf', t.pmf, none),
            pctCol('pmfYield', t.yieldPct, none),
            qtyCol('loss', t.loss, lossOf),
            pctCol('lossYield', t.yieldPct, lossYield),
          ],
        },
        { title: t.chemicalsUtilities, columns: fractUtilities(t) },
      ]}
    />
  )
}

export function SeparatorPage() {
  const { t } = useLocale()
  return (
    <PlantSection
      title={t.separator}
      plantKey="separator"
      kpis={[
        { label: t.feed, get: (plant) => plant.feed },
        { label: `${t.washedCpo} (t)`, get: (plant) => plant.product },
        { label: t.loss, get: lossOf },
        { label: t.yieldPct, get: productYield, tone: 'yield', pct: true },
      ]}
      tables={[
        {
          title: t.separator,
          columns: [
            qtyCol('cpo', `${t.cpo} (t)`, (plant) => plant.feed),
            qtyCol('washed', `${t.washedCpo} (t)`, (plant) => plant.product),
            qtyCol('loss', t.loss, lossOf),
            pctCol('yield', t.yieldPct, productYield),
          ],
        },
        {
          title: t.chemicalsUtilities,
          columns: [
            qtyCol('citric', t.citricAcid, none),
            ...fractUtilities(t),
          ],
        },
        {
          title: t.downtime,
          columns: [
            qtyCol('sdt', t.schedulingDt, none),
            qtyCol('cdt', t.commercialDt, none),
            qtyCol('tdt', t.technicalDt, none),
            qtyCol('udt', t.utilityDt, none),
          ],
        },
        {
          title: t.quality,
          columns: [
            qtyCol('ffa', t.ffa, none),
            qtyCol('moisture', t.moisture, none),
            qtyCol('dobi', t.dobi, none),
          ],
        },
      ]}
    />
  )
}

const SUPPORTING = [
  'BE SSA · 912.001.004',
  'BE SSB · 912.001.Z05',
  'BE SSM · 912.001.006',
  'Clariant 331S',
  'Tonsil 331M',
  'Phosphoric acid min. 85%',
  'Vitamin A palmitate · 926.601',
  'Citric acid anhydrate · 912.005.002',
]

export function SupportingMaterialsPage() {
  const { t } = useLocale()
  const { start, end, setRange } = useProductionRange()
  const sort = useColumnSort()
  const rows = sortRows(
    SUPPORTING.map((name) => ({ name })),
    sort.key,
    sort.dir,
    (row, column) => (column === 'name' ? row.name : null),
  )

  return (
    <div className="page page--prod">
      <header className="page-title-row">
        <h1 className="page-title">{t.supportingMaterials}</h1>
        <DateRangeFilter start={start} end={end} onChange={setRange} />
      </header>
      <PlantTabs start={start} end={end} />
      <section className="prod-panel">
        <h2 className="card__title">{t.stockLadder}</h2>
        <div className="prod-scroll">
          <table className="prod-table">
            <thead>
              <tr>
                <SortHeader label={t.material} column="name" sort={sort} />
                <SortHeader label={t.opening} column="opening" sort={sort} align="right" />
                <SortHeader label={t.used} column="used" sort={sort} align="right" />
                <SortHeader label={t.received} column="received" sort={sort} align="right" />
                <SortHeader label={`${t.closing} (kg)`} column="closing" sort={sort} align="right" />
                <SortHeader label={t.closingBag} column="bag" sort={sort} align="right" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td className="num num--empty">-</td>
                  <td className="num num--empty">-</td>
                  <td className="num num--empty">-</td>
                  <td className="num num--empty">-</td>
                  <td className="num num--empty">-</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function PlantSection({
  title,
  plantKey,
  kpis,
  tables,
}: {
  title: string
  plantKey: PlantKey
  kpis: KpiSpec[]
  tables: TableSpec[]
}) {
  const { t, locale } = useLocale()
  const { start, end, setRange } = useProductionRange()
  const numberLocale = locale === 'id' ? 'id-ID' : 'en-US'
  const total = useMemo(() => plantOnRange(start, end, plantKey), [start, end, plantKey])

  const qty = (value: Qty, digits = 3) => {
    if (value == null) return '-'
    return value.toLocaleString(numberLocale, { maximumFractionDigits: digits })
  }
  const pct = (value: Qty) => {
    if (value == null) return '-'
    return `${(value * 100).toLocaleString(numberLocale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
  }
  const formatDay = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number)
    return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString(numberLocale === 'id-ID' ? 'id-ID' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="page page--prod">
      <header className="page-title-row">
        <h1 className="page-title">{title}</h1>
        <DateRangeFilter start={start} end={end} onChange={setRange} />
      </header>
      <PlantTabs start={start} end={end} />
      <section className="prod-kpis" aria-label={title}>
        {kpis.map((kpi) => {
          const value = kpi.get(total)
          return (
            <Kpi
              key={kpi.label}
              label={kpi.label}
              tone={kpi.tone}
              negative={value != null && value < 0}
              value={kpi.pct ? pct(value) : qty(value, kpi.digits)}
            />
          )
        })}
      </section>
      {tables.map((table) => (
        <DayTable
          key={table.title}
          title={table.title}
          plantKey={plantKey}
          columns={table.columns}
          start={start}
          end={end}
          dateLabel={t.colDate}
          totalLabel={t.totalRow}
          formatDay={formatDay}
          qty={qty}
          pct={pct}
        />
      ))}
    </div>
  )
}

function plantOnRange(start: string, end: string, key: PlantKey): PlantDay {
  const summed = productionForRange(start, end)[key]
  return { ...summed, yieldApplicable: yieldOn(key) }
}

function DayTable({
  title,
  plantKey,
  columns,
  start,
  end,
  dateLabel,
  totalLabel,
  formatDay,
  qty,
  pct,
}: {
  title: string
  plantKey: PlantKey
  columns: Col[]
  start: string
  end: string
  dateLabel: string
  totalLabel: string
  formatDay: (iso: string) => string
  qty: (value: Qty, digits?: number) => string
  pct: (value: Qty) => string
}) {
  const sort = useColumnSort()
  const dates = datesBetween(start, end)
  const rows = sortRows(
    dates.map((id) => ({ id, plant: plantOn(id, plantKey) })),
    sort.key,
    sort.dir,
    (row, column) => {
      if (column === 'date') return row.id
      return columns.find((col) => col.key === column)?.get(row.plant) ?? null
    },
  )
  const total = dates.length > 1 ? plantOnRange(start, end, plantKey) : null

  return (
    <section className="prod-panel">
      <h2 className="card__title">{title}</h2>
      <div className="prod-scroll">
        <table className="prod-table">
          <thead>
            <tr>
              <SortHeader label={dateLabel} column="date" sort={sort} />
              {columns.map((col) => (
                <SortHeader key={col.key} label={col.label} column={col.key} sort={sort} align="right" />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{formatDay(row.id)}</td>
                {columns.map((col) => (
                  <Cell key={col.key} col={col} plant={row.plant} qty={qty} pct={pct} />
                ))}
              </tr>
            ))}
            {total && (
              <tr className="prod-total">
                <td>{totalLabel}</td>
                {columns.map((col) => (
                  <Cell key={col.key} col={col} plant={total} qty={qty} pct={pct} />
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Cell({
  col,
  plant,
  qty,
  pct,
}: {
  col: Col
  plant: PlantDay
  qty: (value: Qty, digits?: number) => string
  pct: (value: Qty) => string
}) {
  const value = col.get(plant)
  const text = col.pct ? pct(value) : qty(value)
  if (col.pct && value != null && value >= 0) {
    return (
      <td className="num">
        <span className={`${numClass(value, 'yield')} prod-chip`}>{text}</span>
      </td>
    )
  }
  return <td className={numClass(value, col.pct ? 'yield' : undefined)}>{text}</td>
}

function SortHeader({
  label,
  column,
  sort,
  align = 'left',
}: {
  label: string
  column: string
  sort: { key: string | null; dir: SortDir; toggle: (column: string) => void }
  align?: 'left' | 'right'
}) {
  const active = sort.key === column
  const mark = active ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'
  return (
    <th className={align === 'right' ? 'num' : undefined} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="prod-sort" onClick={() => sort.toggle(column)}>
        {label}
        <span className={active ? 'prod-sort__mark prod-sort__mark--on' : 'prod-sort__mark'}>{mark}</span>
      </button>
    </th>
  )
}

function Kpi({ label, value, tone, negative }: { label: string; value: string; tone?: 'yield'; negative?: boolean }) {
  return (
    <article className={tone === 'yield' ? 'prod-kpi prod-kpi--yield' : 'prod-kpi'}>
      <strong className={negative ? 'num--neg' : undefined}>{value}</strong>
      <span>{label}</span>
    </article>
  )
}
