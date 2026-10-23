import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDay, tankLabel } from '../../domain/format.ts'
import {
  STORAGE_TANK_IDS,
  ageAtSnapshot,
  historyForTank,
  latestByTank,
  productRange,
  retestDue,
  storageInRange,
  tankFill,
  type NumericStorageField,
  type StorageRow,
} from '../../domain/qc.ts'
import { useQcFile } from '../../data/QcContext.tsx'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { Kpi, Num, QcChrome, useParam, type ParamCode } from './qcChrome.tsx'
import { SortHeader, sortRows, useColumnSort, useQcRange, type SortDir } from './qcNav.tsx'
import { AgeDot, Bullet, Identity, Legend, ProductBoard, fill, type LegendItem } from './qcVisual.tsx'

type Slot = { tankId: string; row: StorageRow | null }
type View = 'table' | 'cards'
type Group = 'sample' | 'core' | 'oxidation' | 'composition' | 'notes'

type Column = {
  column: string
  group: Group
  label: string
  code?: ParamCode
  field?: NumericStorageField
  text?: (row: StorageRow) => string | null
}

export function StoragePage() {
  const { t, locale } = useLocale()
  const qc = useQcFile()
  const { start, end, setRange } = useQcRange()
  const [params, setParams] = useSearchParams()
  const sort = useColumnSort()
  const [view, setView] = useState<View>('table')
  const openTank = params.get('tank')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inSpan = useMemo(() => storageInRange(start, end, qc), [qc, start, end])
  const latest = useMemo(() => latestByTank(inSpan), [inSpan])
  const roster = useMemo(
    () => STORAGE_TANK_IDS.map((tankId) => ({ tankId, row: latest.get(tankId) ?? null })),
    [latest],
  )
  const withResult = roster.filter((slot): slot is { tankId: string; row: StorageRow } => slot.row != null)
  const retests = withResult.filter((slot) => retestDue(slot.row)).length
  const families = new Set(withResult.map((slot) => slot.row.oil).filter(Boolean)).size
  const columns = useStorageColumns().filter((column) => withResult.some((slot) => {
    const value = column.field ? slot.row[column.field] : column.text?.(slot.row)
    return value != null && value !== ''
  }))
  const rows = sortRows(roster, sort.key, sort.dir, slotValue)
  const history = openTank ? historyForTank(inSpan, openTank) : []
  const openLatest = openTank ? latest.get(openTank) ?? null : null
  const rangeCaption = (product: string, count: number) => fill(t.rangeFor, {
    product,
    from: formatDay(start <= end ? start : end, locale),
    to: formatDay(start <= end ? end : start, locale),
    count,
  })

  const setOpenTank = (tankId: string | null) => {
    const next = new URLSearchParams(params)
    if (tankId) next.set('tank', tankId)
    else next.delete('tank')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (openTank && !dialog.open) dialog.showModal()
    if (!openTank && dialog.open) dialog.close()
  }, [openTank])

  const legend: LegendItem[] = ['nospec', 'missing']
  if (retests > 0) legend.unshift('retest')

  return (
    <QcChrome
      title={t.qcStorage}
      start={start}
      end={end}
      setRange={setRange}
      note={t.storageSpecNote}
      legend={<Legend items={legend} />}
    >
      <section className="prod-kpis" aria-label={t.qcStorage}>
        <Kpi label={t.tanksLogged} value={String(withResult.length)} />
        <Kpi label={t.retestDue} value={String(retests)} tone={retests > 0 ? 'alert' : undefined} />
        <Kpi label={t.oilTypes} value={String(families)} />
      </section>
      <ProductBoard rows={withResult.map((slot) => slot.row)} slots={STORAGE_TANK_IDS.length} onOpen={setOpenTank} />
      <section className="prod-panel">
        <div className="section-head">
          <h2 className="card__title">{t.qcStorage}</h2>
          <div className="section-head__tools">
            <div className="view-toggle" role="group" aria-label={t.qcStorage}>
              <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>{t.tableView}</button>
              <button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')}>{t.gridView}</button>
            </div>
          </div>
        </div>
        {view === 'table' ? (
          <div className="prod-scroll">
            <table className="prod-table">
              <thead>
                <GroupRow columns={columns} />
                <tr>
                  <IdentityHeader sort={sort} />
                  {columns.map((column, index) => (
                    <SortHeader
                      key={column.column}
                      label={column.label}
                      column={column.column}
                      sort={sort}
                      align={column.text ? 'left' : 'right'}
                      className={edge(columns, index) ? 'qc-group--edge' : undefined}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((slot) => {
                  const names = ['qc-pick']
                  if (!slot.row) names.push('prod-row--empty')
                  else if (retestDue(slot.row)) names.push('qc-retest')
                  return (
                    <tr key={slot.tankId} className={names.join(' ')} onClick={() => setOpenTank(slot.tankId)}>
                      <td className="qc-sticky">
                        <Identity
                          place={(
                            <button type="button" className="prod-plant-link" onClick={(event) => { event.stopPropagation(); setOpenTank(slot.tankId) }}>
                              {tankLabel(slot.tankId)}
                            </button>
                          )}
                          product={slot.row?.oil ?? null}
                        />
                      </td>
                      <ResultCells row={slot.row} columns={columns} />
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="tank-grid">
            {withResult.length === 0 && <p className="empty">{t.noQcRows}</p>}
            {sortRows(withResult, sort.key, sort.dir, slotValue).map((slot) => (
              <StorageCard
                key={slot.tankId}
                row={slot.row}
                range={productRange(inSpan, slot.row.oil, 'ffa')}
                rangeCaption={rangeCaption}
                onOpen={() => setOpenTank(slot.tankId)}
              />
            ))}
          </div>
        )}
      </section>
      <dialog
        ref={dialogRef}
        className="qc-dialog"
        onClose={() => setOpenTank(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpenTank(null)
        }}
      >
        {openTank && (
          <>
            <h2>{tankLabel(openTank)}{openLatest?.oil ? ` · ${openLatest.oil}` : ''}</h2>
            <p className="stock-dialog__kicker">{t.qcStorage}</p>
            <div className="qc-dialog__scroll">
              {history.length === 0 ? (
                <p className="empty">{t.noQcRows}</p>
              ) : (
                <>
                  <FfaHistory
                    history={history}
                    oil={openLatest?.oil ?? history[0].oil}
                    range={productRange(inSpan, openLatest?.oil ?? history[0].oil, 'ffa')}
                  />
                  <table className="prod-table">
                    <thead>
                      <tr>
                        <th className="num">{t.revisionShort}</th>
                        <th>{t.oilTypes}</th>
                        {columns.map((column) => (
                          <th key={column.column} className={column.text ? undefined : 'num'}>{column.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((row) => (
                        <tr key={`${row.snapshotOn}-${row.revision}`}>
                          <td className="num">{row.revision}</td>
                          <td>{row.oil || '-'}</td>
                          <ResultCells row={row} columns={columns} />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
            <div className="stock-dialog__actions">
              <button type="button" className="btn btn--secondary" onClick={() => setOpenTank(null)}>{t.close}</button>
            </div>
          </>
        )}
      </dialog>
    </QcChrome>
  )
}

function useStorageColumns(): Column[] {
  const { t, locale } = useLocale()
  return [
    { column: 'analysis', group: 'sample', label: t.analysisDate, text: (row) => (row.analysisDate ? formatDay(row.analysisDate, locale) : null) },
    { column: 'age', group: 'sample', label: t.ageDays, text: (row) => row.analysisDate },
    { column: 'temp', group: 'sample', label: t.tempC, code: 'temp', field: 'temperatureC' },
    { column: 'ffa', group: 'core', label: t.ffaPct, code: 'ffa', field: 'ffa' },
    { column: 'moisture', group: 'core', label: t.moisturePct, code: 'moisture', field: 'moisture' },
    { column: 'colorR', group: 'core', label: t.colourRLov, code: 'colorR', field: 'colorR' },
    { column: 'colorY', group: 'core', label: t.colourYLov, code: 'colorY', field: 'colorY' },
    { column: 'pv', group: 'oxidation', label: 'PV', code: 'pv', field: 'pv' },
    { column: 'anv', group: 'oxidation', label: 'AnV', code: 'anv', field: 'anv' },
    { column: 'totox', group: 'oxidation', label: t.totox, code: 'totox', field: 'totox' },
    { column: 'iv', group: 'composition', label: 'IV', code: 'iv', field: 'iv' },
    { column: 'smp', group: 'composition', label: t.slipPoint, code: 'smp', field: 'smp' },
    { column: 'cloud', group: 'composition', label: t.cloudPoint, code: 'cloud', field: 'cloudPoint' },
    { column: 'carotene', group: 'composition', label: t.carotene, code: 'carotene', field: 'carotene' },
    { column: 'phosphorus', group: 'composition', label: t.phosphorus, code: 'phosphorus', field: 'phosphorus' },
    { column: 'dobi', group: 'composition', label: 'DOBI', code: 'dobi', field: 'dobi' },
    { column: 'odor', group: 'notes', label: t.odor, text: (row) => row.odor },
    { column: 'remark', group: 'notes', label: t.remark, text: (row) => row.remark },
  ]
}

function edge(columns: Column[], index: number): boolean {
  return index === 0 || columns[index - 1].group !== columns[index].group
}

function GroupRow({ columns }: { columns: Column[] }) {
  const { t } = useLocale()
  const names: Record<Group, string> = {
    sample: t.groupSample,
    core: t.groupCore,
    oxidation: t.groupOxidation,
    composition: t.groupComposition,
    notes: t.groupNotes,
  }
  const spans: Array<{ group: Group; span: number }> = []
  for (const column of columns) {
    const last = spans.at(-1)
    if (last && last.group === column.group) last.span += 1
    else spans.push({ group: column.group, span: 1 })
  }
  return (
    <tr className="qc-groups">
      <th className="qc-sticky" aria-hidden="true" />
      {spans.map((item) => (
        <th key={item.group} colSpan={item.span} scope="colgroup" className="qc-group--edge">{names[item.group]}</th>
      ))}
    </tr>
  )
}

function IdentityHeader({ sort }: { sort: { key: string | null; dir: SortDir; toggle: (column: string) => void } }) {
  const { t } = useLocale()
  const mark = (column: string) => (sort.key === column ? (sort.dir === 'asc' ? '↑' : '↓') : '↕')
  const active = sort.key === 'tank' || sort.key === 'oil'
  return (
    <th className="qc-sticky" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <span className="qc-identity-head">
        <button type="button" className="prod-sort" onClick={() => sort.toggle('tank')}>
          {t.tank}
          <span className={sort.key === 'tank' ? 'prod-sort__mark prod-sort__mark--on' : 'prod-sort__mark'}>{mark('tank')}</span>
        </button>
        <button type="button" className="prod-sort" onClick={() => sort.toggle('oil')}>
          {t.oilTypes}
          <span className={sort.key === 'oil' ? 'prod-sort__mark prod-sort__mark--on' : 'prod-sort__mark'}>{mark('oil')}</span>
        </button>
      </span>
    </th>
  )
}

function ResultCells({ row, columns }: { row: StorageRow | null; columns: Column[] }) {
  const { t } = useLocale()
  return (
    <>
      {columns.map((column, index) => {
        const className = edge(columns, index) ? 'qc-group--edge' : ''
        if (column.column === 'age') {
          const age = row ? ageAtSnapshot(row.analysisDate, row.snapshotOn) : null
          return (
            <td key={column.column} className={className}>
              <AgeDot age={age} />
              {row && retestDue(row) ? <span className="badge badge--warning qc-badge">{t.retest}</span> : null}
            </td>
          )
        }
        if (column.text) {
          const value = row ? column.text(row) : null
          const wrap = column.column === 'remark' ? 'qc-wrap' : ''
          return <td key={column.column} className={[className, wrap].filter(Boolean).join(' ') || undefined}>{value || '-'}</td>
        }
        return (
          <Num
            key={column.column}
            className={className || undefined}
            value={row && column.field ? row[column.field] : null}
            code={column.code ?? 'ffa'}
          />
        )
      })}
    </>
  )
}

function StorageCard({
  row,
  range,
  rangeCaption,
  onOpen,
}: {
  row: StorageRow
  range: ReturnType<typeof productRange>
  rangeCaption: (product: string, count: number) => string
  onOpen: () => void
}) {
  const { t } = useLocale()
  const param = useParam()
  const ratio = tankFill(row)
  const retest = retestDue(row)
  const percent = ratio == null ? null : Math.round(ratio * 100)
  return (
    <article className={retest ? 'tank-card qc-card--retest' : 'tank-card'}>
      <header className="tank-card__head">
        <Identity
          place={<button type="button" className="prod-plant-link" onClick={onOpen}>{tankLabel(row.tankId)}</button>}
          product={row.oil}
        />
        <span>
          <AgeDot age={ageAtSnapshot(row.analysisDate, row.snapshotOn)} />
          {retest ? <span className="badge badge--warning qc-badge">{t.retest}</span> : null}
        </span>
      </header>
      <div className="qc-card__fill">
        {t.tankFill}
        <span className="qc-board__track" aria-hidden="true"><span style={{ width: `${percent ?? 0}%` }} /></span>
        {percent == null ? t.unavailable : `${percent}%`}
      </div>
      <Bullet
        code="ffa"
        label={t.ffaPct}
        value={row.ffa}
        context={{ kind: 'range', range, caption: rangeCaption(row.oil || '-', range?.count ?? 0) }}
      />
      <dl className="tank-card__metrics">
        <div><dt>{t.moisturePct}</dt><dd>{param('moisture', row.moisture)}</dd></div>
        <div><dt>{t.colourRLov}</dt><dd>{param('colorR', row.colorR)}</dd></div>
        <div><dt>{t.colourYLov}</dt><dd>{param('colorY', row.colorY)}</dd></div>
        <div><dt>{t.tempC}</dt><dd>{param('temp', row.temperatureC)}</dd></div>
      </dl>
    </article>
  )
}

function FfaHistory({
  history,
  oil,
  range,
}: {
  history: StorageRow[]
  oil: string
  range: ReturnType<typeof productRange>
}) {
  const { t, locale } = useLocale()
  const param = useParam()
  const revisions = new Set(history.map((row) => row.snapshotOn)).size !== history.length
  const data = [...history].reverse().map((row) => ({
    label: `${row.snapshotOn ? formatDay(row.snapshotOn, locale) : '-'}${revisions ? ` r${row.revision}` : ''}`,
    ffa: row.ffa,
  }))
  const values = data.map((point) => point.ffa).filter((value): value is number => value != null)
  if (values.length === 0) return null
  const low = Math.min(...values, range?.low ?? Infinity)
  const high = Math.max(...values, range?.high ?? -Infinity)
  const pad = Math.max((high - low) * 0.2, Math.abs(high) * 0.02, 0.002)
  return (
    <figure className="qc-figure chart-frame qty-chart">
      <h3 className="qc-dialog__chart-title">{oil} · {t.ffaPct}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#E0E0E0" vertical={false} />
          {range && range.count >= 3 ? (
            <ReferenceArea y1={range.low} y2={range.high} fill="#C4C4C4" fillOpacity={0.35} stroke="none" ifOverflow="extendDomain" />
          ) : null}
          <XAxis dataKey="label" tick={{ fontSize: 11 }} height={32} />
          <YAxis
            tick={{ fontSize: 11 }}
            width={56}
            domain={[low - pad, high + pad]}
            tickFormatter={(value: number) => param('ffa', value)}
          />
          <Tooltip formatter={(value) => [`${param('ffa', value == null ? null : Number(value))} %`, t.ffaPct]} />
          <Line
            type="monotone"
            dataKey="ffa"
            name={t.ffaPct}
            stroke="#114C5A"
            strokeWidth={2}
            connectNulls={false}
            isAnimationActive={false}
            dot
          />
        </LineChart>
      </ResponsiveContainer>
      <figcaption>{t.ffaBySnapshot}</figcaption>
    </figure>
  )
}

function slotValue(slot: Slot, column: string) {
  if (column === 'tank') return slot.tankId
  if (!slot.row) return null
  return storageValue(slot.row, column)
}

function storageValue(row: StorageRow, column: string) {
  if (column === 'oil') return row.oil
  if (column === 'analysis') return row.analysisDate
  if (column === 'age') return ageAtSnapshot(row.analysisDate, row.snapshotOn)
  if (column === 'temp') return row.temperatureC
  if (column === 'ffa') return row.ffa
  if (column === 'moisture') return row.moisture
  if (column === 'colorR') return row.colorR
  if (column === 'colorY') return row.colorY
  if (column === 'iv') return row.iv
  if (column === 'pv') return row.pv
  if (column === 'smp') return row.smp
  if (column === 'cloud') return row.cloudPoint
  if (column === 'anv') return row.anv
  if (column === 'carotene') return row.carotene
  if (column === 'phosphorus') return row.phosphorus
  if (column === 'dobi') return row.dobi
  if (column === 'totox') return row.totox
  if (column === 'odor') return row.odor
  return row.remark
}
