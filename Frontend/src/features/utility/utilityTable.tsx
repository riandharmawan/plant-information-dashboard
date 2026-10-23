import { outsidePrinted, readingKey, type UtilityReading } from '../../domain/utility.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { SortHeader, sortRows, useColumnSort } from '../qc/qcNav.tsx'
import { tagLabel } from './utilityCharts.tsx'
import { useNumber } from './utilityShell.tsx'

export type GridColumn = { key: string; group: string | null; info: UtilityReading }
type GridRow = { at: string; cells: Map<string, UtilityReading>; remark: string | null }

/** Pivots one sheet day into one row per clock time or shift and one column per printed tag, in sheet order. */
export function pivot(readings: UtilityReading[], by: 'time' | 'shift'): { columns: GridColumn[]; rows: GridRow[] } {
  const columns = new Map<string, GridColumn>()
  const rows = new Map<string, GridRow>()
  for (const reading of readings) {
    if (!reading.tag) continue
    const key = readingKey(reading)
    if (!columns.has(key) && (reading.value != null || reading.text)) columns.set(key, { key, group: reading.group, info: reading })
    const at = (by === 'time' ? reading.time : reading.shift) ?? '-'
    const row = rows.get(at) ?? { at, cells: new Map(), remark: null }
    if (!row.cells.has(key)) row.cells.set(key, reading)
    if (reading.remark && !row.remark) row.remark = reading.remark
    rows.set(at, row)
  }
  const order = [...new Set(readings.map((reading) => reading.group))]
  return {
    columns: [...columns.values()].sort((left, right) => order.indexOf(left.group) - order.indexOf(right.group)),
    rows: [...rows.values()],
  }
}

function edge(columns: GridColumn[], index: number): boolean {
  return index === 0 || columns[index - 1].group !== columns[index].group
}

function GroupRow({ columns, remark }: { columns: GridColumn[]; remark: boolean }) {
  const spans: Array<{ group: string | null; span: number }> = []
  for (const column of columns) {
    const last = spans.at(-1)
    if (last && last.group === column.group) last.span += 1
    else spans.push({ group: column.group, span: 1 })
  }
  if (spans.every((item) => !item.group)) return null
  return (
    <tr className="qc-groups">
      <th className="qc-sticky" aria-hidden="true" />
      {spans.map((item, index) => (
        <th key={`${item.group}-${index}`} colSpan={item.span} scope="colgroup" className="qc-group--edge">{item.group ?? '-'}</th>
      ))}
      {remark ? <th aria-hidden="true" /> : null}
    </tr>
  )
}

/** A sortable sheet roster. Columns empty for the whole day are left out, and text cells stay as written. */
export function ReadingGrid({
  readings,
  by,
  firstLabel,
  label,
  onOpen,
}: {
  readings: UtilityReading[]
  by: 'time' | 'shift'
  firstLabel: string
  label?: (column: GridColumn) => string
  onOpen?: (column: GridColumn) => void
}) {
  const { t } = useLocale()
  const number = useNumber()
  const sort = useColumnSort()
  const { columns, rows } = pivot(readings, by)
  const remark = rows.some((row) => row.remark)
  const sorted = sortRows(rows, sort.key, sort.dir, (row, key) => {
    if (key === 'at') return row.at
    if (key === 'remark') return row.remark
    const cell = row.cells.get(key)
    return cell?.value ?? cell?.text ?? null
  })
  if (rows.length === 0) return <p className="empty">{t.noDataDay}</p>
  return (
    <div className="prod-scroll">
      <table className="prod-table">
        <thead>
          <GroupRow columns={columns} remark={remark} />
          <tr>
            <SortHeader label={firstLabel} column="at" sort={sort} className="qc-sticky" />
            {columns.map((column, index) => (
              <SortHeader
                key={column.key}
                label={label ? label(column) : tagLabel(column.info)}
                column={column.key}
                sort={sort}
                align={column.info.value != null ? 'right' : 'left'}
                className={edge(columns, index) ? 'qc-group--edge' : undefined}
              />
            ))}
            {remark ? <SortHeader label={t.remark} column="remark" sort={sort} /> : null}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.at}>
              <td className="qc-sticky">{row.at}</td>
              {columns.map((column, index) => {
                const cell = row.cells.get(column.key)
                const names = [cell?.value != null || column.info.value != null ? 'num' : '']
                if (edge(columns, index)) names.push('qc-group--edge')
                if (!cell || (cell.value == null && !cell.text)) names.push('num--empty')
                else if (outsidePrinted(cell)) names.push('num--watch')
                const value = cell?.value != null ? number(cell.value) : (cell?.text ?? '-')
                return (
                  <td
                    key={column.key}
                    className={names.filter(Boolean).join(' ') || undefined}
                    title={cell && outsidePrinted(cell) ? `${t.outsidePrinted} · ${cell.spec}` : undefined}
                  >
                    {onOpen && cell?.value != null ? (
                      <button type="button" className="qty-link" onClick={() => onOpen(column)}>{value}</button>
                    ) : value}
                  </td>
                )
              })}
              {remark ? <td className="qc-wrap">{row.remark ?? '-'}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
