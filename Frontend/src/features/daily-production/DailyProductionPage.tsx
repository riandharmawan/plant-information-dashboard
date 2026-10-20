import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  closingStockKg,
  coproductYield,
  lossOf,
  lossYield,
  productYield,
  productionForRange,
  type PlantDay,
  type PlantKey,
  type ProductionDay,
  type Qty,
  type StockCode,
} from '../../domain/dailyProduction.ts'
import { useCalibration } from '../../data/CalibrationContext.tsx'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { DateRangeFilter } from './DateRangeFilter.tsx'
import { PLANT_PATH, PlantTabs, productionSearch, useProductionRange } from './productionNav.tsx'

const PLANTS: PlantKey[] = ['refinery500', 'refinery150', 'fract400', 'fract500', 'separator']

function numClass(value: Qty, kind?: 'yield' | 'closing'): string {
  const names = ['num']
  if (value == null) names.push('num--empty')
  else if (value < 0) names.push('num--neg')
  else if (kind) names.push(`num--${kind}`)
  return names.join(' ')
}

type SortDir = 'asc' | 'desc'
type SortValue = string | number | null

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

export function DailyProductionPage() {
  const { t, locale } = useLocale()
  const { revision } = useCalibration()
  const { start, end, setRange } = useProductionRange()
  const numberLocale = locale === 'id' ? 'id-ID' : 'en-US'

  const day: ProductionDay = useMemo(() => productionForRange(start, end), [start, end])
  const closing = useMemo(() => closingStockKg(), [revision])
  const productionSort = useColumnSort()
  const stockSort = useColumnSort()
  const chemicalSort = useColumnSort()
  const movementSort = useColumnSort()

  const plantLabel: Record<PlantKey, string> = {
    refinery500: t.refinery500,
    refinery150: t.refinery150,
    fract400: t.fract400,
    fract500: t.fract500,
    separator: t.separator,
  }
  const routeLabel: Record<PlantKey, string> = {
    refinery500: t.rbdpoPfad,
    refinery150: t.rbdpoPfad,
    fract400: t.oleinStearin,
    fract500: t.oleinStearin,
    separator: t.washedCpo,
  }

  const qty = (value: Qty, digits = 3) => {
    if (value == null) return '-'
    return value.toLocaleString(numberLocale, { maximumFractionDigits: digits })
  }
  const pct = (value: Qty) => {
    if (value == null) return '-'
    return `${(value * 100).toLocaleString(numberLocale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
  }
  const movementRows = [t.incoming, t.localSales, t.shipment, t.blendIn, t.blendOut, t.transferIn, t.transferOut, t.gainLoss]
  const stockRows: Array<{ label: string; code: StockCode }> = [
    { label: t.cpo, code: 'CPO' },
    { label: t.rbdpo, code: 'RBDPO' },
    { label: t.pfad, code: 'PFAD' },
    { label: t.olein, code: 'OLEIN' },
    { label: t.stearin, code: 'RBDPS' },
  ]

  const oils = [t.cpo, t.rbdpo, t.pfad, t.olein, t.stearin]

  const productionRows = sortRows(
    PLANTS.map((key) => ({ key, plant: day[key] })),
    productionSort.key,
    productionSort.dir,
    (row, column) => {
      if (column === 'plant') return plantLabel[row.key]
      if (column === 'feed') return row.plant.feed
      if (column === 'product') return row.plant.product
      if (column === 'productYield') return productYield(row.plant)
      if (column === 'coproduct') return row.plant.coproduct
      if (column === 'coproductYield') return coproductYield(row.plant)
      if (column === 'loss') return lossOf(row.plant)
      return lossYield(row.plant)
    },
  )
  const stockOrdered = sortRows(
    stockRows,
    stockSort.key,
    stockSort.dir,
    (row, column) => (column === 'name' ? row.label : column === 'closing' ? closing[row.code] : null),
  )
  const chemicalRows = sortRows(
    PLANTS.map((key) => ({ key, plant: day[key] })),
    chemicalSort.key,
    chemicalSort.dir,
    (row, column) => {
      if (column === 'plant') return plantLabel[row.key]
      const field = column as 'beBags' | 'pa' | 'powerKwh' | 'gasMmBtu' | 'steam' | 'water' | 'compressor'
      return row.plant[field]
    },
  )
  const movementOrdered = sortRows(
    oils.map((label) => ({ label })),
    movementSort.key,
    movementSort.dir,
    (row, column) => (column === 'name' ? row.label : null),
  )

  return (
    <div className="page page--prod">
      <header className="page-title-row">
        <h1 className="page-title">{t.dailyProductionTitle}</h1>
        <DateRangeFilter start={start} end={end} onChange={setRange} />
      </header>
      <PlantTabs start={start} end={end} />

      <section className="prod-kpis" aria-label={t.dailyProductionTitle}>
        <Kpi label={`${t.refinery500} ${t.feed}`} value={qty(day.refinery500.feed)} />
        <Kpi label={`${t.refinery500} ${t.yieldPct}`} value={pct(productYield(day.refinery500))} tone="yield" />
        <Kpi label={`${t.refinery150} ${t.feed}`} value={qty(day.refinery150.feed)} />
        <Kpi label={`${t.refinery150} ${t.yieldPct}`} value={pct(productYield(day.refinery150))} tone="yield" />
      </section>

      <div className="prod-layout">
      <section className="prod-panel">
        <h2 className="card__title">{t.dailyProductionTitle}</h2>
        <div className="prod-scroll">
          <table className="prod-table">
            <thead>
              <tr>
                <SortHeader label={t.plant} column="plant" sort={productionSort} />
                <SortHeader label={t.feed} column="feed" sort={productionSort} align="right" />
                <SortHeader label={t.product} column="product" sort={productionSort} align="right" />
                <SortHeader label={t.yieldPct} column="productYield" sort={productionSort} align="right" />
                <SortHeader label={t.coproduct} column="coproduct" sort={productionSort} align="right" />
                <SortHeader label={t.yieldPct} column="coproductYield" sort={productionSort} align="right" />
                <SortHeader label={t.loss} column="loss" sort={productionSort} align="right" />
                <SortHeader label={t.yieldPct} column="lossYield" sort={productionSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {productionRows.map((row) => (
                <ProductionRow
                  key={row.key}
                  name={plantLabel[row.key]}
                  route={routeLabel[row.key]}
                  plant={row.plant}
                  to={`${PLANT_PATH[row.key]}${productionSearch(start, end)}`}
                  qty={qty}
                  pct={pct}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="prod-panel">
        <h2 className="card__title">{t.stockLadder}</h2>
        <div className="prod-scroll">
          <table className="prod-table prod-table--fit">
            <thead>
              <tr>
                <SortHeader label={t.stockLadder} column="name" sort={stockSort} />
                <SortHeader label={t.opening} column="opening" sort={stockSort} align="right" />
                <SortHeader label={t.productionKg} column="production" sort={stockSort} align="right" />
                <SortHeader label={t.used} column="used" sort={stockSort} align="right" />
                <SortHeader label={`${t.closing} (kg)`} column="closing" sort={stockSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {stockOrdered.map((row) => (
                <tr key={row.code}>
                  <td>{row.label}</td>
                  <td className="num num--empty">-</td>
                  <td className="num num--empty">-</td>
                  <td className="num num--empty">-</td>
                  <Figure value={closing[row.code]} text={qty(closing[row.code], 0)} kind="closing" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </div>

      <section className="prod-panel">
        <h2 className="card__title">{t.chemicalsUtilities}</h2>
        <div className="prod-scroll">
          <table className="prod-table">
            <thead>
              <tr>
                <SortHeader label={t.plant} column="plant" sort={chemicalSort} />
                <SortHeader label={t.beBags} column="beBags" sort={chemicalSort} align="right" />
                <SortHeader label={t.paLogged} column="pa" sort={chemicalSort} align="right" />
                <SortHeader label={t.powerKwh} column="powerKwh" sort={chemicalSort} align="right" />
                <SortHeader label={t.gasMmBtu} column="gasMmBtu" sort={chemicalSort} align="right" />
                <SortHeader label={t.steamLogged} column="steam" sort={chemicalSort} align="right" />
                <SortHeader label={t.water} column="water" sort={chemicalSort} align="right" />
                <SortHeader label={t.compressor} column="compressor" sort={chemicalSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {chemicalRows.map((row) => {
                const plant = row.plant
                return (
                  <tr key={row.key}>
                    <td>{plantLabel[row.key]}</td>
                    <td className={numClass(plant.beBags)}>{qty(plant.beBags)}</td>
                    <td className={numClass(plant.pa)}>{qty(plant.pa)}</td>
                    <td className={numClass(plant.powerKwh)}>{qty(plant.powerKwh)}</td>
                    <td className={numClass(plant.gasMmBtu)}>{qty(plant.gasMmBtu)}</td>
                    <td className={numClass(plant.steam)}>{qty(plant.steam)}</td>
                    <td className={numClass(plant.water)}>{qty(plant.water)}</td>
                    <td className={numClass(plant.compressor)}>{qty(plant.compressor)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="prod-panel">
        <h2 className="card__title">{t.oilMovement}</h2>
        <div className="prod-scroll">
          <table className="prod-table">
            <thead>
              <tr>
                <SortHeader label={t.oilMovement} column="name" sort={movementSort} />
                {movementRows.map((label) => (
                  <SortHeader key={label} label={label} column={label} sort={movementSort} align="right" />
                ))}
              </tr>
            </thead>
            <tbody>
              {movementOrdered.map((oil) => (
                <tr key={oil.label}>
                  <td>{oil.label}</td>
                  {movementRows.map((label) => (
                    <td key={label} className="num num--empty">-</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
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

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'yield' }) {
  return (
    <article className={tone === 'yield' ? 'prod-kpi prod-kpi--yield' : 'prod-kpi'}>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  )
}

function Figure({ value, text, kind }: { value: Qty; text: string; kind?: 'yield' | 'closing' }) {
  const name = numClass(value, kind)
  if (value != null && value >= 0 && kind) {
    return <td className="num"><span className={`${name} prod-chip`}>{text}</span></td>
  }
  return <td className={name}>{text}</td>
}

function ProductionRow({
  name,
  route,
  plant,
  to,
  qty,
  pct,
}: {
  name: string
  route: string
  plant: PlantDay
  to: string
  qty: (value: Qty) => string
  pct: (value: Qty) => string
}) {
  const loss = lossOf(plant)
  return (
    <tr>
      <td className="prod-plant-cell">
        <Link className="prod-plant prod-plant-link" to={to}>{name}</Link>
        <span className="prod-route">{route}</span>
      </td>
      <td className={numClass(plant.feed)}>{qty(plant.feed)}</td>
      <td className={numClass(plant.product)}>{qty(plant.product)}</td>
      <Figure value={productYield(plant)} text={pct(productYield(plant))} kind="yield" />
      <td className={numClass(plant.coproduct)}>{qty(plant.coproduct)}</td>
      <Figure value={coproductYield(plant)} text={pct(coproductYield(plant))} kind="yield" />
      <td className={numClass(loss)}>{qty(loss)}</td>
      <Figure value={lossYield(plant)} text={pct(lossYield(plant))} kind="yield" />
    </tr>
  )
}
