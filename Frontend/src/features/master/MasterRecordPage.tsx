import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { SaveResult } from '../../domain/master.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'

export interface MasterColumn<T> {
  key: string
  label: string
  value: (row: T) => string
}

export interface MasterField {
  key: string
  label: string
  required?: boolean
  options?: Array<{ value: string; label: string }>
}

interface MasterRecordPageProps<T extends { id: string }> {
  title: string
  description: string
  listTitle: string
  entityLabel: string
  columns: MasterColumn<T>[]
  rows: T[]
  fields: MasterField[]
  draftFrom: (row: T | null) => Record<string, string>
  onSave: (draft: Record<string, string>, id: string | null) => SaveResult
  onDelete: (id: string) => SaveResult
  onRefresh: () => void
  editHref?: (row: T) => string
  identityLabel?: string
}

export function MasterRecordPage<T extends { id: string }>({
  title,
  description,
  listTitle,
  entityLabel,
  columns,
  rows,
  fields,
  draftFrom,
  onSave,
  onDelete,
  onRefresh,
  editHref,
  identityLabel,
}: MasterRecordPageProps<T>) {
  const { t } = useLocale()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (dialogOpen && !dialog.open) dialog.showModal()
    if (!dialogOpen && dialog.open) dialog.close()
  }, [dialogOpen])

  const visible = useMemo(() => {
    const filtered = rows.filter((row) => columns.every((column) => {
      const query = (filters[column.key] ?? '').trim().toLowerCase()
      if (!query) return true
      return column.value(row).toLowerCase().includes(query)
    }))
    if (!sortKey) return filtered
    const column = columns.find((item) => item.key === sortKey)
    if (!column) return filtered
    const direction = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((left, right) => (
      column.value(left).localeCompare(column.value(right), undefined, { numeric: true }) * direction
    ))
  }, [rows, columns, filters, sortKey, sortDir])

  function openCreate() {
    setEditingId(null)
    setDraft(draftFrom(null))
    setFormError(null)
    setPageError(null)
    setDialogOpen(true)
  }

  function openEdit(row: T) {
    setEditingId(row.id)
    setDraft(draftFrom(row))
    setFormError(null)
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setFormError(null)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const missing = fields.some((field) => field.required && !(draft[field.key] ?? '').trim())
    if (missing) {
      setFormError(t.requiredFields)
      return
    }
    const result = onSave(draft, editingId)
    if (!result.ok) {
      setFormError(result.reason === 'duplicate' ? t.duplicateRecord : t.requiredFields)
      return
    }
    setPageError(null)
    closeDialog()
  }

  function remove(id: string) {
    const result = onDelete(id)
    setPageError(result.ok ? null : t.recordInUse)
  }

  function refresh() {
    setFilters({})
    setSortKey(null)
    setSortDir('asc')
    setPageError(null)
    onRefresh()
  }

  function toggleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir('asc')
      return
    }
    setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
  }

  return (
    <div className="page">
      <header className="page-title-row">
        <h1 className="page-title">{title}</h1>
      </header>
      <p className="page-note">{description}</p>
      <Link className="master-back" to="/master">{t.backToMaster}</Link>

      <section className="master-panel">
        <div className="master-panel__head">
          <h2>{listTitle}</h2>
          <div className="master-panel__actions">
            <button type="button" className="btn btn--secondary" onClick={refresh}>{t.refresh}</button>
            <button type="button" className="btn btn--primary" onClick={openCreate}>{t.add} {entityLabel}</button>
          </div>
        </div>
        {pageError && <p className="master-error">{pageError}</p>}
        <div className="master-table-wrap">
          <table className="master-table">
            <thead>
              <tr>
                {columns.map((column) => {
                  const mark = sortKey === column.key ? (sortDir === 'asc' ? '↑' : '↓') : '⇅'
                  return (
                    <th key={column.key} scope="col">
                      <button type="button" className="master-sort" onClick={() => toggleSort(column.key)}>
                        {column.label} {mark}
                      </button>
                    </th>
                  )
                })}
                <th scope="col"><span className="visually-hidden">{t.actions}</span></th>
              </tr>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} scope="col">
                    <input
                      value={filters[column.key] ?? ''}
                      placeholder={`${t.filterBy} ${column.label}`}
                      aria-label={`${t.filterBy} ${column.label}`}
                      onChange={(event) => setFilters((current) => ({ ...current, [column.key]: event.target.value }))}
                    />
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td className="master-empty" colSpan={columns.length + 1}>{t.noMasterRows}</td>
                </tr>
              ) : visible.map((row) => (
                <tr key={row.id}>
                  {columns.map((column) => <td key={column.key}>{column.value(row)}</td>)}
                  <td>
                    <div className="master-row-actions">
                      {editHref
                        ? <Link className="btn-text" to={editHref(row)}>{t.edit}</Link>
                        : <button type="button" className="btn-text" onClick={() => openEdit(row)}>{t.edit}</button>}
                      {identityLabel && (
                        <button type="button" className="btn-text" onClick={() => openEdit(row)}>{identityLabel}</button>
                      )}
                      <button type="button" className="btn-text" onClick={() => remove(row.id)}>{t.remove}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <dialog ref={dialogRef} className="master-dialog" onClose={closeDialog}>
        <form className="master-form" onSubmit={submit}>
          <h2>{editingId ? t.edit : t.add} {entityLabel}</h2>
          {fields.map((field) => (
            <label key={field.key}>
              {field.label}
              {field.options ? (
                <select
                  value={draft[field.key] ?? ''}
                  onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                >
                  <option value="">{t.unavailable}</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={draft[field.key] ?? ''}
                  onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                />
              )}
            </label>
          ))}
          {formError && <p className="master-error">{formError}</p>}
          <div className="master-form__actions">
            <button type="button" className="btn btn--secondary" onClick={closeDialog}>{t.cancel}</button>
            <button type="submit" className="btn btn--primary">{t.save}</button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
