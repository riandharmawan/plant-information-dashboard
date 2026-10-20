import { useMemo } from 'react'
import { formatDay } from '../../domain/format.ts'
import { QC, commodityFamily, movementDirection, type MovementRow } from '../../domain/qc.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { Kpi, QcChrome } from './qcChrome.tsx'
import { SortHeader, sortRows, useColumnSort, useQcRange } from './qcNav.tsx'

export function MovementPage() {
  const { t, locale } = useLocale()
  const { start, end, setRange } = useQcRange()
  const familySort = useColumnSort()
  const detailSort = useColumnSort()
  const rows = QC.movements.rows
  const counted = useMemo(() => rows.map((row) => ({ ...row, direction: movementDirection(row.sealIn, row.sealOut), family: commodityFamily(row.commodity) })), [rows])
  const inbound = counted.filter((row) => row.direction === 'inbound').length
  const outbound = counted.filter((row) => row.direction === 'outbound').length
  const unknown = counted.filter((row) => row.direction === 'unknown').length
  const period = QC.movements.periodStart && QC.movements.periodEnd
    ? `${formatDay(QC.movements.periodStart, locale)} – ${formatDay(QC.movements.periodEnd, locale)}`
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
        <Kpi label={t.movementCount} value={String(rows.length)} />
        <Kpi label={t.outbound} value={String(outbound)} />
        <Kpi label={t.inbound} value={String(inbound)} />
        <Kpi label={t.notClassified} value={String(unknown)} />
      </section>
      <section className="prod-panel">
        <h2 className="card__title">{t.commodity}</h2>
        <div className="prod-scroll">
          <table className="prod-table prod-table--fit">
            <thead>
              <tr>
                <SortHeader label={t.commodity} column="family" sort={familySort} />
                <SortHeader label={t.movementCount} column="count" sort={familySort} align="right" />
                <SortHeader label={t.inbound} column="inbound" sort={familySort} align="right" />
                <SortHeader label={t.outbound} column="outbound" sort={familySort} align="right" />
                <SortHeader label={t.notClassified} column="unknown" sort={familySort} align="right" />
              </tr>
            </thead>
            <tbody>
              {familyRows.map((row) => (
                <tr key={row.family}>
                  <td>{row.family}</td>
                  <td className="num">{row.count}</td>
                  <td className="num">{row.inbound}</td>
                  <td className="num">{row.outbound}</td>
                  <td className="num">{row.unknown}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="prod-panel">
        <h2 className="card__title">{t.writtenAs}</h2>
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
                  <td>{directionLabel[row.direction]}</td>
                  <td>{row.operator ?? '-'}</td>
                  <td>{row.remark ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
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
