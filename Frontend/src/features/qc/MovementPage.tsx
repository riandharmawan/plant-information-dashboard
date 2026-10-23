import { useMemo, useState } from 'react'
import { useQcFile } from '../../data/QcContext.tsx'
import { formatDay } from '../../domain/format.ts'
import { commodityFamily, inRange, movementDirection, type MovementRow } from '../../domain/qc.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { QcChrome } from './qcChrome.tsx'
import { MovementDetail, QcDetailDialog, QcPanelOpen } from './qcDialogs.tsx'
import { QcKpi } from './qcKpi.tsx'
import { DirectionTrack, ProductPill } from './qcVisual.tsx'
import { SortHeader, sortRows, useColumnSort, useQcRange } from './qcNav.tsx'

type MovementDialog = null | 'count' | 'outbound' | 'inbound' | 'unknown' | 'commodity' | 'detail'

export function MovementPage() {
  const { t, locale } = useLocale()
  const qc = useQcFile()
  const { start, end, setRange } = useQcRange()
  const familySort = useColumnSort()
  const detailSort = useColumnSort()
  const [dialog, setDialog] = useState<MovementDialog>(null)
  const rows = useMemo(
    () => qc.movements.rows.filter((row) => row.movementDate == null || inRange(row.movementDate, start, end)),
    [end, qc.movements.rows, start],
  )
  const counted = useMemo(() => rows.map((row) => ({ ...row, direction: movementDirection(row.sealIn, row.sealOut), family: commodityFamily(row.commodity) })), [rows])
  const inbound = counted.filter((row) => row.direction === 'inbound').length
  const outbound = counted.filter((row) => row.direction === 'outbound').length
  const unknown = counted.filter((row) => row.direction === 'unknown').length
  const period = qc.movements.periodStart && qc.movements.periodEnd
    ? `${formatDay(qc.movements.periodStart, locale)} – ${formatDay(qc.movements.periodEnd, locale)}`
    : ''

  const families = new Map<string, { family: string; count: number; inbound: number; outbound: number; unknown: number }>()
  for (const row of counted) {
    const bucket = families.get(row.family) ?? { family: row.family, count: 0, inbound: 0, outbound: 0, unknown: 0 }
    bucket.count += 1
    bucket[row.direction] += 1
    families.set(row.family, bucket)
  }
  const familyRows = sortRows([...families.values()], familySort.key, familySort.dir, (row, column) => {
    if (column === 'family') return row.family
    return row[column as 'count' | 'inbound' | 'outbound' | 'unknown']
  })
  const detail = sortRows(counted, detailSort.key, detailSort.dir, (row, column) => movementValue(row, column))
  const directionLabel = {
    inbound: t.inbound,
    outbound: t.outbound,
    unknown: t.notClassified,
  }

  return (
    <QcChrome
      title={t.qcMovements}
      start={start}
      end={end}
      setRange={setRange}
      note={t.gatePeriodNote.replace('{period}', period)}
    >
      <section className="prod-kpis" aria-label={t.qcMovements}>
        <QcKpi label={t.movementCount} value={String(rows.length)} onOpen={() => setDialog('count')} />
        <QcKpi label={t.outbound} value={String(outbound)} onOpen={() => setDialog('outbound')} />
        <QcKpi label={t.inbound} value={String(inbound)} onOpen={() => setDialog('inbound')} />
        <QcKpi label={t.notClassified} value={String(unknown)} onOpen={() => setDialog('unknown')} />
      </section>
      <QcPanelOpen title={t.commodity} onOpen={() => setDialog('commodity')}>
        <div className="prod-scroll">
          <table className="prod-table prod-table--fit">
            <thead>
              <tr>
                <SortHeader label={t.commodity} column="family" sort={familySort} />
                <SortHeader label={t.movementCount} column="count" sort={familySort} align="right" />
                <SortHeader label={t.direction} column="inbound" sort={familySort} />
              </tr>
            </thead>
            <tbody>
              {familyRows.map((row) => (
                <tr key={row.family}>
                  <td><ProductPill name={row.family} /></td>
                  <td className="num">{row.count}</td>
                  <td><DirectionTrack inbound={row.inbound} outbound={row.outbound} unknown={row.unknown} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QcPanelOpen>
      <QcPanelOpen title={t.writtenAs} onOpen={() => setDialog('detail')}>
        <div className="prod-scroll">
          <table className="prod-table">
            <thead>
              <tr>
                <SortHeader label={t.policeNo} column="vehicle" sort={detailSort} />
                <SortHeader label={t.writtenAs} column="commodity" sort={detailSort} />
                <SortHeader label={t.timeIn} column="timeIn" sort={detailSort} />
                <SortHeader label={t.timeOut} column="timeOut" sort={detailSort} />
                <SortHeader label={t.customerShip} column="customer" sort={detailSort} />
                <SortHeader label={t.sealIn} column="sealIn" sort={detailSort} />
                <SortHeader label={t.sealOut} column="sealOut" sort={detailSort} />
                <SortHeader label={t.direction} column="direction" sort={detailSort} />
                <SortHeader label={t.operator} column="operator" sort={detailSort} />
                <SortHeader label={t.remark} column="remark" sort={detailSort} />
              </tr>
            </thead>
            <tbody>
              {detail.map((row, index) => (
                <tr key={`${row.vehicle}-${row.timeIn}-${row.timeOut}-${row.sealOut}-${index}`}>
                  <td>{row.vehicle}</td>
                  <td>{row.commodity}</td>
                  <td>{row.timeIn ?? '-'}</td>
                  <td>{row.timeOut ?? '-'}</td>
                  <td>{row.customer ?? '-'}</td>
                  <td>{row.sealIn ?? '-'}</td>
                  <td>{row.sealOut ?? '-'}</td>
                  <td><span className={`badge qc-direction qc-direction--${row.direction}`}>{directionLabel[row.direction]}</span></td>
                  <td>{row.operator ?? '-'}</td>
                  <td>{row.remark ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QcPanelOpen>
      <QcDetailDialog
        open={dialog != null}
        title={dialog === 'commodity' ? t.commodity : dialog === 'detail' ? t.writtenAs : t.qcMovements}
        start={start}
        end={end}
        onClose={() => setDialog(null)}
      >
        {dialog != null ? (
          <MovementDetail rows={counted
            .filter((row) => (
              dialog === 'outbound' ? row.direction === 'outbound'
                : dialog === 'inbound' ? row.direction === 'inbound'
                  : dialog === 'unknown' ? row.direction === 'unknown'
                    : true
            ))
            .map((row) => ({
              vehicle: row.vehicle,
              commodity: row.commodity,
              timeIn: row.timeIn,
              timeOut: row.timeOut,
              direction: directionLabel[row.direction],
            }))} />
        ) : null}
      </QcDetailDialog>
    </QcChrome>
  )
}

function movementValue(row: MovementRow & { direction: string }, column: string) {
  if (column === 'vehicle') return row.vehicle
  if (column === 'commodity') return row.commodity
  if (column === 'timeIn') return row.timeIn
  if (column === 'timeOut') return row.timeOut
  if (column === 'customer') return row.customer
  if (column === 'sealIn') return row.sealIn
  if (column === 'sealOut') return row.sealOut
  if (column === 'direction') return row.direction
  if (column === 'operator') return row.operator
  return row.remark
}
