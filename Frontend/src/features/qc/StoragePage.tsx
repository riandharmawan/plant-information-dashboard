import { useEffect, useMemo, useRef, useState } from 'react'
import { tankLabel } from '../../domain/format.ts'
import {
  STORAGE_TANK_IDS,
  ageAtSnapshot,
  historyForTank,
  latestByTank,
  retestDue,
  storageInRange,
  type StorageRow,
} from '../../domain/qc.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { Kpi, Num, QcChrome } from './qcChrome.tsx'
import { SortHeader, sortRows, useColumnSort, useQcRange } from './qcNav.tsx'

type Slot = { tankId: string; row: StorageRow | null }

export function StoragePage() {
  const { t } = useLocale()
  const { start, end, setRange } = useQcRange()
  const sort = useColumnSort()
  const [openTank, setOpenTank] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inSpan = useMemo(() => storageInRange(start, end), [start, end])
  const latest = useMemo(() => latestByTank(inSpan), [inSpan])
  const roster = useMemo(
    () => STORAGE_TANK_IDS.map((tankId) => ({ tankId, row: latest.get(tankId) ?? null })),
    [latest],
  )
  const withResult = roster.filter((slot) => slot.row)
  const retests = withResult.filter((slot) => slot.row && retestDue(slot.row)).length
  const families = new Set(withResult.map((slot) => slot.row?.oil).filter(Boolean)).size
  const rows = sortRows(roster, sort.key, sort.dir, slotValue)
  const history = openTank ? historyForTank(inSpan, openTank) : []
  const openLatest = openTank ? latest.get(openTank) ?? null : null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (openTank && !dialog.open) dialog.showModal()
    if (!openTank && dialog.open) dialog.close()
  }, [openTank])

  return (
    <QcChrome title={t.qcStorage} start={start} end={end} setRange={setRange} note={t.storageSpecNote}>
      <section className="prod-kpis" aria-label={t.qcStorage}>
        <Kpi label={t.tanksLogged} value={String(withResult.length)} />
        <Kpi label={t.retestDue} value={String(retests)} tone={retests > 0 ? 'alert' : undefined} />
        <Kpi label={t.oilTypes} value={String(families)} />
      </section>
      <section className="prod-panel">
        <h2 className="card__title">{t.qcStorage}</h2>
        <div className="prod-scroll">
          <table className="prod-table">
            <thead>
              <tr>
                <SortHeader label={t.tank} column="tank" sort={sort} />
                <SortHeader label={t.oilTypes} column="oil" sort={sort} />
                <SortHeader label={t.analysisDate} column="analysis" sort={sort} />
                <SortHeader label={t.ageDays} column="age" sort={sort} align="right" />
                <LabHeaders sort={sort} />
              </tr>
            </thead>
            <tbody>
              {rows.map((slot) => (
                <tr key={slot.tankId} className="qc-pick" onClick={() => setOpenTank(slot.tankId)}>
                  <td>
                    <button
                      type="button"
                      className="prod-plant-link"
                      onClick={() => setOpenTank(slot.tankId)}
                    >
                      {tankLabel(slot.tankId)}
                    </button>
                  </td>
                  <ResultCells row={slot.row} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                <table className="prod-table">
                  <thead>
                    <tr>
                      <th className="num">{t.revisionShort}</th>
                      <th>{t.oilTypes}</th>
                      <th>{t.analysisDate}</th>
                      <th className="num">{t.ageDays}</th>
                      <LabHeaders />
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={`${row.snapshotOn}-${row.revision}`}>
                        <td className="num">{row.revision}</td>
                        <ResultCells row={row} />
                      </tr>
                    ))}
                  </tbody>
                </table>
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

function LabHeaders({ sort }: { sort?: ReturnType<typeof useColumnSort> }) {
  const { t } = useLocale()
  const columns: Array<{ label: string; column: string }> = [
    { label: t.tempAxis, column: 'temp' },
    { label: 'FFA', column: 'ffa' },
    { label: 'M&I', column: 'moisture' },
    { label: t.colourR, column: 'colorR' },
    { label: t.colourY, column: 'colorY' },
    { label: 'IV', column: 'iv' },
    { label: 'PV', column: 'pv' },
    { label: t.slipPoint, column: 'smp' },
    { label: t.cloudPoint, column: 'cloud' },
    { label: 'AnV', column: 'anv' },
    { label: t.carotene, column: 'carotene' },
    { label: t.phosphorus, column: 'phosphorus' },
    { label: 'DOBI', column: 'dobi' },
    { label: t.totox, column: 'totox' },
    { label: t.odor, column: 'odor' },
    { label: t.remark, column: 'remark' },
  ]
  return columns.map((column) => (
    sort
      ? <SortHeader key={column.column} label={column.label} column={column.column} sort={sort} align={column.column === 'odor' || column.column === 'remark' ? 'left' : 'right'} />
      : <th key={column.column} className={column.column === 'odor' || column.column === 'remark' ? undefined : 'num'}>{column.label}</th>
  ))
}

function ResultCells({ row }: { row: StorageRow | null }) {
  const { t } = useLocale()
  const age = row ? ageAtSnapshot(row.analysisDate, row.snapshotOn) : null
  return (
    <>
      <td>{row?.oil || '-'}</td>
      <td>{row?.analysisDate ?? '-'}</td>
      <td className={age == null ? 'num num--empty' : 'num'}>
        {age == null ? '-' : age}
        {row && retestDue(row) ? <span className="badge badge--warning qc-badge">{t.retest}</span> : null}
      </td>
      <Num value={row?.temperatureC ?? null} digits={1} />
      <Num value={row?.ffa ?? null} />
      <Num value={row?.moisture ?? null} />
      <Num value={row?.colorR ?? null} />
      <Num value={row?.colorY ?? null} />
      <Num value={row?.iv ?? null} />
      <Num value={row?.pv ?? null} />
      <Num value={row?.smp ?? null} />
      <Num value={row?.cloudPoint ?? null} />
      <Num value={row?.anv ?? null} />
      <Num value={row?.carotene ?? null} />
      <Num value={row?.phosphorus ?? null} />
      <Num value={row?.dobi ?? null} />
      <Num value={row?.totox ?? null} />
      <td>{row?.odor ?? '-'}</td>
      <td className="qc-wrap">{row?.remark ?? '-'}</td>
    </>
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
