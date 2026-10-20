import { useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n/LocaleContext.tsx'

const PAGE_SIZE = 80

function cellValue(value: number | null | undefined): string {
  return value == null ? '' : String(value)
}

export function PairTable({
  rows,
  headers,
  onChange,
  onImport,
  onExport,
  filterPlaceholder,
}: {
  rows: number[][]
  headers: [string, string]
  onChange: (rows: number[][]) => void
  onImport: (file: File) => void
  onExport: () => void
  filterPlaceholder: string
}) {
  const { t } = useLocale()
  const inputRef = useRef<HTMLInputElement>(null)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(0)

  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase()
    return rows
      .map((row, index) => ({ row, index }))
      .filter((item) => !query || String(item.row[0]).includes(query) || String(item.row[1]).includes(query))
  }, [rows, filter])

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const slice = visible.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  function update(index: number, column: 0 | 1, raw: string) {
    const next = rows.map((row) => [...row])
    const parsed = raw.trim() === '' ? 0 : Number(raw)
    next[index][column] = Number.isFinite(parsed) ? parsed : next[index][column]
    onChange(next)
  }

  return (
    <div className="calib-table-block">
      <div className="calib-toolbar">
        <input
          value={filter}
          placeholder={filterPlaceholder}
          aria-label={filterPlaceholder}
          onChange={(event) => {
            setFilter(event.target.value)
            setPage(0)
          }}
        />
        <button type="button" className="btn btn--secondary" onClick={() => onChange([...rows, [0, 0]])}>{t.addRow}</button>
        <button type="button" className="btn btn--secondary" onClick={() => inputRef.current?.click()}>{t.importCsv}</button>
        <button type="button" className="btn btn--secondary" onClick={onExport}>{t.exportCsv}</button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onImport(file)
            event.target.value = ''
          }}
        />
      </div>
      <div className="calib-table-wrap">
        <table className="master-table calib-table">
          <thead>
            <tr>
              <th scope="col">{headers[0]}</th>
              <th scope="col">{headers[1]}</th>
              <th scope="col"><span className="visually-hidden">{t.actions}</span></th>
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr><td className="master-empty" colSpan={3}>{t.noMasterRows}</td></tr>
            ) : slice.map(({ row, index }) => (
              <tr key={index}>
                <td><input value={cellValue(row[0])} onChange={(event) => update(index, 0, event.target.value)} /></td>
                <td><input value={cellValue(row[1])} onChange={(event) => update(index, 1, event.target.value)} /></td>
                <td>
                  <button type="button" className="btn-text" onClick={() => onChange(rows.filter((_, item) => item !== index))}>
                    {t.remove}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="calib-pager">
          <button type="button" className="btn btn--secondary" disabled={current === 0} onClick={() => setPage(current - 1)}>{t.previousPage}</button>
          <span>{current + 1} / {pageCount}</span>
          <button type="button" className="btn btn--secondary" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>{t.nextPage}</button>
        </div>
      )}
    </div>
  )
}

export function TripleTable({
  rows,
  headers,
  onChange,
  onImport,
  onExport,
}: {
  rows: number[][]
  headers: [string, string, string]
  onChange: (rows: number[][]) => void
  onImport: (file: File) => void
  onExport: () => void
}) {
  const { t } = useLocale()
  const inputRef = useRef<HTMLInputElement>(null)

  function update(index: number, column: 0 | 1 | 2, raw: string) {
    const next = rows.map((row) => [...row])
    const parsed = raw.trim() === '' ? 0 : Number(raw)
    next[index][column] = Number.isFinite(parsed) ? parsed : next[index][column]
    onChange(next)
  }

  return (
    <div className="calib-table-block">
      <div className="calib-toolbar">
        <button type="button" className="btn btn--secondary" onClick={() => onChange([...rows, [0, 0, 0]])}>{t.addRow}</button>
        <button type="button" className="btn btn--secondary" onClick={() => inputRef.current?.click()}>{t.importCsv}</button>
        <button type="button" className="btn btn--secondary" onClick={onExport}>{t.exportCsv}</button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onImport(file)
            event.target.value = ''
          }}
        />
      </div>
      <div className="calib-table-wrap">
        <table className="master-table calib-table">
          <thead>
            <tr>
              {headers.map((header) => <th key={header} scope="col">{header}</th>)}
              <th scope="col"><span className="visually-hidden">{t.actions}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="master-empty" colSpan={4}>{t.noMasterRows}</td></tr>
            ) : rows.map((row, index) => (
              <tr key={index}>
                <td><input value={cellValue(row[0])} onChange={(event) => update(index, 0, event.target.value)} /></td>
                <td><input value={cellValue(row[1])} onChange={(event) => update(index, 1, event.target.value)} /></td>
                <td><input value={cellValue(row[2])} onChange={(event) => update(index, 2, event.target.value)} /></td>
                <td>
                  <button type="button" className="btn-text" onClick={() => onChange(rows.filter((_, item) => item !== index))}>
                    {t.remove}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ValueTable({
  values,
  headers,
  onChange,
  onImport,
  onExport,
}: {
  values: Array<number | null>
  headers: [string, string]
  onChange: (values: Array<number | null>) => void
  onImport: (file: File) => void
  onExport: () => void
}) {
  const { t } = useLocale()
  const inputRef = useRef<HTMLInputElement>(null)

  function update(index: number, raw: string) {
    const next = [...values]
    const trimmed = raw.trim()
    if (trimmed === '') {
      next[index] = null
    } else {
      const parsed = Number(trimmed)
      next[index] = Number.isFinite(parsed) ? parsed : next[index]
    }
    onChange(next)
  }

  return (
    <div className="calib-table-block">
      <div className="calib-toolbar">
        <button type="button" className="btn btn--secondary" onClick={() => onChange([...values, 0])}>{t.addRow}</button>
        <button type="button" className="btn btn--secondary" onClick={() => inputRef.current?.click()}>{t.importCsv}</button>
        <button type="button" className="btn btn--secondary" onClick={onExport}>{t.exportCsv}</button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onImport(file)
            event.target.value = ''
          }}
        />
      </div>
      <div className="calib-table-wrap">
        <table className="master-table calib-table">
          <thead>
            <tr>
              <th scope="col">{headers[0]}</th>
              <th scope="col">{headers[1]}</th>
              <th scope="col"><span className="visually-hidden">{t.actions}</span></th>
            </tr>
          </thead>
          <tbody>
            {values.length === 0 ? (
              <tr><td className="master-empty" colSpan={3}>{t.noMasterRows}</td></tr>
            ) : values.map((value, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td><input value={cellValue(value)} onChange={(event) => update(index, event.target.value)} /></td>
                <td>
                  <button type="button" className="btn-text" onClick={() => onChange(values.filter((_, item) => item !== index))}>
                    {t.remove}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
