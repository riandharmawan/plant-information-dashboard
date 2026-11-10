import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Pencil, Search, ShieldPlus, Trash2, X } from 'lucide-react'
import { api, ApiError } from '../../data/api.ts'
import { useAuth } from '../../data/AuthContext.tsx'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import type { Messages } from '../../i18n/messages.ts'
import { errorText } from './errors.ts'

interface RoleRow {
  id: number
  name: string
  description: string | null
  isSystemRole: boolean
  userCount: number
  viewCount?: number
  editCount?: number
  deleteCount?: number
}

interface Right {
  resourceKey: string
  view: boolean
  edit: boolean
  delete: boolean
}

interface RoleDetail {
  id: number
  name: string
  description: string | null
  isSystemRole: boolean
  permissions: Right[]
}

type Field = 'view' | 'edit' | 'delete'

/** Pages that only show data. Edit and Delete mean nothing on them, so they stay off. */
const VIEW_ONLY = new Set(['management-stock'])

const GROUPS: Array<{ title: keyof Messages; keys: string[] }> = [
  { title: 'managementGroup', keys: ['management-stock'] },
  { title: 'operationsGroup', keys: ['live-ops', 'ops-analytics', 'qc', 'daily-production', 'refinery-fractionation', 'utility', 'coverage'] },
  { title: 'masterGroup', keys: ['master-companies', 'master-sites', 'master-commodities', 'master-calibration', 'master-tanks', 'master-logsheets', 'master-quality-rules'] },
  { title: 'administration', keys: ['admin-users', 'admin-roles', 'admin-datahub'] },
]

const LABELS: Record<string, keyof Messages> = {
  'management-stock': 'stockOverview',
  'live-ops': 'liveOps',
  'ops-analytics': 'opsAnalytics',
  qc: 'qualityControl',
  'daily-production': 'dailyProduction',
  'refinery-fractionation': 'refineryFractionation',
  utility: 'utility',
  coverage: 'coverage',
  'master-companies': 'company',
  'master-sites': 'site',
  'master-commodities': 'commodities',
  'master-calibration': 'commoditiesCalibration',
  'master-tanks': 'tankFarm',
  'master-logsheets': 'logsheetCatalog',
  'master-quality-rules': 'qualityRules',
  'admin-users': 'userManagement',
  'admin-roles': 'roleManagement',
  'admin-datahub': 'dataHub',
}

function blankRights(keys: string[]): Right[] {
  return keys.map((resourceKey) => ({ resourceKey, view: false, edit: false, delete: false }))
}

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template)
}

/** Apply one change and keep the rights consistent: edit and delete need view, and no view clears both. */
function withChange(right: Right, field: Field, checked: boolean): Right {
  if (VIEW_ONLY.has(right.resourceKey) && field !== 'view') return right
  const next = { ...right, [field]: checked }
  if ((field === 'edit' || field === 'delete') && checked) next.view = true
  if (field === 'view' && !checked) {
    next.edit = false
    next.delete = false
  }
  return next
}

export function RolesPage() {
  const { t } = useLocale()
  const { can } = useAuth()
  const canEdit = can('admin-roles', 'edit')
  const canDelete = can('admin-roles', 'delete')
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [catalog, setCatalog] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<RoleDetail | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<RoleRow | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setPageError(null)
    try {
      const [nextRoles, nextKeys] = await Promise.all([
        api<RoleRow[]>('/api/v1/admin/roles'),
        api<string[]>('/api/v1/admin/permissions'),
      ])
      setRoles(nextRoles)
      setCatalog(nextKeys)
    } catch (error) {
      setPageError(errorText(t, error instanceof ApiError ? error.code : ''))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return roles
    return roles.filter((role) => [role.name, role.description].filter(Boolean).join(' ').toLowerCase().includes(needle))
  }, [roles, query])

  const openNew = () => {
    setEditing({ id: 0, name: '', description: '', isSystemRole: false, permissions: blankRights(catalog) })
  }

  const openEdit = async (role: RoleRow) => {
    setPageError(null)
    try {
      setEditing(await api<RoleDetail>(`/api/v1/admin/roles/${role.id}`))
    } catch (error) {
      setPageError(errorText(t, error instanceof ApiError ? error.code : ''))
    }
  }

  const confirmRemove = async () => {
    if (!deleting) return
    setNotice(null)
    setPageError(null)
    try {
      await api(`/api/v1/admin/roles/${deleting.id}`, { method: 'DELETE' })
      setNotice(t.roleDeleted)
      setDeleting(null)
      await load()
    } catch (error) {
      setDeleting(null)
      setPageError(errorText(t, error instanceof ApiError ? error.code : ''))
    }
  }

  return (
    <div className="page um">
      <Link className="master-back" to="/admin">{t.backToAdmin}</Link>
      <header className="um-header">
        <div>
          <h1 className="page-title">{t.roleManagement}</h1>
          <p className="um-subtitle">{t.roleManagementBlurb}</p>
        </div>
        {canEdit ? (
          <button type="button" className="btn btn--primary um-add" onClick={openNew}>
            <ShieldPlus size={16} aria-hidden="true" />
            {t.addRole}
          </button>
        ) : null}
      </header>

      {notice ? (
        <div className="um-banner um-banner--ok" role="status">
          <span>{notice}</span>
          <button type="button" className="um-icon-btn" aria-label={t.close} onClick={() => setNotice(null)}><X size={14} /></button>
        </div>
      ) : null}
      {pageError ? (
        <div className="um-banner um-banner--error" role="alert">
          <span>{pageError}</span>
          <button type="button" className="um-icon-btn" aria-label={t.close} onClick={() => setPageError(null)}><X size={14} /></button>
        </div>
      ) : null}

      <section className="um-card">
        <div className="um-toolbar">
          <label className="um-search">
            <Search size={16} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchRoles} aria-label={t.searchRoles} />
            {query ? (
              <button type="button" className="um-icon-btn" aria-label={t.clearFilters} onClick={() => setQuery('')}><X size={14} /></button>
            ) : null}
          </label>
          <span className="um-count" aria-live="polite">{fill(t.rolesShown, { n: rows.length, total: roles.length })}</span>
        </div>

        {loading ? (
          <div className="um-skeleton" aria-busy="true" aria-label={t.loading}>
            {[0, 1, 2].map((n) => <div key={n} className="um-skeleton__row" />)}
          </div>
        ) : roles.length === 0 ? (
          <div className="um-empty">
            <p>{t.noRolesYet}</p>
            {canEdit ? <button type="button" className="btn btn--primary" onClick={openNew}>{t.addRole}</button> : null}
          </div>
        ) : rows.length === 0 ? (
          <div className="um-empty">
            <p>{t.noMatch}</p>
            <button type="button" className="btn btn--secondary" onClick={() => setQuery('')}>{t.clearFilters}</button>
          </div>
        ) : (
          <div className="um-table-wrap">
            <table className="um-table">
              <thead>
                <tr>
                  <th>{t.roleName}</th>
                  <th>{t.usersCount}</th>
                  <th>{t.roleAccess}</th>
                  <th className="um-th-actions"><span className="visually-hidden">{t.actions}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((role) => {
                  const inUse = role.userCount > 0
                  const lockReason = role.isSystemRole ? t.systemRoleLocked : inUse ? fill(t.roleInUseHint, { n: role.userCount }) : null
                  return (
                    <tr key={role.id} className={canEdit ? 'um-row--click' : undefined} onClick={canEdit ? () => void openEdit(role) : undefined}>
                      <td>
                        <div className="um-user">
                          <span className="um-avatar um-avatar--role" aria-hidden="true">{role.isSystemRole ? <Lock size={16} /> : role.name.slice(0, 2).toUpperCase()}</span>
                          <span className="um-user__text">
                            <span className="um-user__name">
                              <strong>{role.name}</strong>
                              {role.isSystemRole ? <span className="um-chip um-chip--role">{t.systemSuffix.replace(/[()]/g, '').trim()}</span> : null}
                            </span>
                            <span className="um-muted">{role.description || '—'}</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={inUse ? 'um-chip' : 'um-chip um-chip--more'}>{role.userCount}</span>
                      </td>
                      <td>
                        <div className="um-rights" title={fill(t.rolesSummary, { v: role.viewCount ?? 0, e: role.editCount ?? 0, d: role.deleteCount ?? 0 })}>
                          <span className="um-right um-right--view"><b>{role.viewCount ?? 0}</b> {t.permissionView}</span>
                          <span className="um-right um-right--edit"><b>{role.editCount ?? 0}</b> {t.permissionEdit}</span>
                          <span className="um-right um-right--delete"><b>{role.deleteCount ?? 0}</b> {t.permissionDelete}</span>
                        </div>
                      </td>
                      <td className="um-actions" onClick={(event) => event.stopPropagation()}>
                        {canEdit ? (
                          <button type="button" className="um-icon-btn" title={t.edit} aria-label={`${t.edit} ${role.name}`} onClick={() => void openEdit(role)}>
                            <Pencil size={16} />
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            className="um-icon-btn um-icon-btn--danger"
                            title={lockReason ?? t.remove}
                            aria-label={`${t.remove} ${role.name}`}
                            disabled={lockReason !== null}
                            onClick={() => setDeleting(role)}
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing ? (
        <RoleDialog
          role={editing}
          saving={saving}
          onClose={() => setEditing(undefined)}
          onSave={async (body) => {
            setSaving(true)
            try {
              const path = editing.id ? `/api/v1/admin/roles/${editing.id}` : '/api/v1/admin/roles'
              await api(path, { method: editing.id ? 'PUT' : 'POST', body: JSON.stringify(body) })
              setNotice(t.roleSaved)
              setEditing(undefined)
              await load()
            } finally {
              setSaving(false)
            }
          }}
        />
      ) : null}

      {deleting ? (
        <div className="admin-overlay" onClick={() => setDeleting(null)} role="presentation">
          <div className="um-confirm" role="alertdialog" aria-modal="true" aria-labelledby="role-confirm-title" onClick={(event) => event.stopPropagation()}>
            <span className="um-confirm__icon" aria-hidden="true"><Trash2 size={20} /></span>
            <h2 id="role-confirm-title">{t.deleteRoleTitle}</h2>
            <p>{fill(t.deleteRoleBody, { name: deleting.name })}</p>
            <div className="um-confirm__actions">
              <button type="button" className="btn btn--secondary" onClick={() => setDeleting(null)}>{t.cancel}</button>
              <button type="button" className="btn um-btn-danger" onClick={() => void confirmRemove()}>{t.remove}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

type Tab = 'details' | 'permissions'

function RoleDialog({
  role,
  saving,
  onClose,
  onSave,
}: {
  role: RoleDetail
  saving: boolean
  onClose: () => void
  onSave: (body: { name: string; description: string; permissions: Right[] }) => Promise<void>
}) {
  const { t } = useLocale()
  const [tab, setTab] = useState<Tab>('details')
  const [name, setName] = useState(role.name)
  const [description, setDescription] = useState(role.description ?? '')
  const [permissions, setPermissions] = useState<Right[]>(role.permissions)
  const [formError, setFormError] = useState<string | null>(null)

  const counts = {
    view: permissions.filter((right) => right.view).length,
    edit: permissions.filter((right) => right.edit).length,
    delete: permissions.filter((right) => right.delete).length,
  }

  const update = (keys: string[], field: Field, checked: boolean) => {
    setPermissions((current) => current.map((right) => (keys.includes(right.resourceKey) ? withChange(right, field, checked) : right)))
  }

  const preset = (kind: 'read' | 'full' | 'none') => {
    setPermissions((current) => current.map((right) => ({
      ...right,
      view: kind !== 'none',
      edit: kind === 'full' && !VIEW_ONLY.has(right.resourceKey),
      delete: kind === 'full' && !VIEW_ONLY.has(right.resourceKey),
    })))
  }

  const submit = async () => {
    setFormError(null)
    try {
      await onSave({ name, description, permissions })
    } catch (error) {
      const code = error instanceof ApiError ? error.code : ''
      setFormError(errorText(t, code))
      if (code === 'role_name_required' || code === 'role_name_taken') setTab('details')
    }
  }

  const fields: Array<{ key: Field; label: string }> = [
    { key: 'view', label: t.permissionView },
    { key: 'edit', label: t.permissionEdit },
    { key: 'delete', label: t.permissionDelete },
  ]

  return (
    <div className="admin-overlay" onClick={onClose} role="presentation">
      <div className="um-dialog" role="dialog" aria-modal="true" aria-labelledby="role-dialog-title" onClick={(event) => event.stopPropagation()}>
        <header className="um-dialog__head">
          <span className="um-avatar um-avatar--lg um-avatar--role" aria-hidden="true">
            {role.isSystemRole ? <Lock size={20} /> : role.id ? (role.name.slice(0, 2).toUpperCase() || '?') : <ShieldPlus size={20} />}
          </span>
          <div className="um-dialog__title">
            <h2 id="role-dialog-title">{role.id ? t.editRole : t.addRole}</h2>
            <span className="um-muted">{role.id ? role.name : t.newRoleHint}</span>
          </div>
          <button type="button" className="um-icon-btn" aria-label={t.close} onClick={onClose}><X size={18} /></button>
        </header>

        <div className="um-tabs" role="tablist" aria-label={t.roleManagement}>
          <button type="button" role="tab" id="rm-tab-details" aria-selected={tab === 'details'} aria-controls="rm-panel-details"
            className={tab === 'details' ? 'um-tab um-tab--on' : 'um-tab'} onClick={() => setTab('details')}>
            {t.detailsTab}
          </button>
          <button type="button" role="tab" id="rm-tab-permissions" aria-selected={tab === 'permissions'} aria-controls="rm-panel-permissions"
            className={tab === 'permissions' ? 'um-tab um-tab--on' : 'um-tab'} onClick={() => setTab('permissions')}>
            {t.permissionsTab}
            <span className="um-tab__count">{counts.view}</span>
          </button>
        </div>

        <div className="um-dialog__body">
          {formError ? <p className="um-banner um-banner--error" role="alert">{formError}</p> : null}

          {tab === 'details' ? (
            <div role="tabpanel" id="rm-panel-details" aria-labelledby="rm-tab-details" className="um-form">
              <label className="um-field um-field--wide">
                <span>{t.roleName}</span>
                <input value={name} disabled={role.isSystemRole} onChange={(event) => setName(event.target.value)} />
                {role.isSystemRole ? <span className="um-muted">{t.systemRoleNote}</span> : null}
              </label>
              <label className="um-field um-field--wide">
                <span>{t.description}</span>
                <input value={description} onChange={(event) => setDescription(event.target.value)} />
              </label>
              <div className="um-field um-field--wide">
                <span>{t.roleAccess}</span>
                <div className="um-rights um-rights--lg">
                  <span className="um-right um-right--view"><b>{counts.view}</b> {t.permissionView}</span>
                  <span className="um-right um-right--edit"><b>{counts.edit}</b> {t.permissionEdit}</span>
                  <span className="um-right um-right--delete"><b>{counts.delete}</b> {t.permissionDelete}</span>
                </div>
                <button type="button" className="btn-text um-link" onClick={() => setTab('permissions')}>{t.permissionsTab} →</button>
              </div>
            </div>
          ) : (
            <div role="tabpanel" id="rm-panel-permissions" aria-labelledby="rm-tab-permissions">
              <div className="um-site-tools">
                <span className="um-muted um-presets-label">{t.presets}</span>
                <button type="button" className="btn btn--secondary" onClick={() => preset('read')}>{t.presetReadOnly}</button>
                <button type="button" className="btn btn--secondary" onClick={() => preset('full')}>{t.presetFull}</button>
                <button type="button" className="btn btn--secondary" onClick={() => preset('none')}>{t.presetClear}</button>
              </div>
              <div className="um-groups um-groups--spaced">
                {GROUPS.map((group) => {
                  const rights = group.keys
                    .map((key) => permissions.find((item) => item.resourceKey === key))
                    .filter((right): right is Right => Boolean(right))
                  if (rights.length === 0) return null
                  const keys = rights.map((right) => right.resourceKey)
                  return (
                    <fieldset key={group.title} className="um-group">
                      <legend className="visually-hidden">{t[group.title]}</legend>
                      <table className="um-matrix">
                        <thead>
                          <tr>
                            <th>{t[group.title]}</th>
                            {fields.map((field) => {
                              const on = rights.filter((right) => right[field.key]).length
                              return (
                                <th key={field.key} className="um-matrix__col">
                                  <label className="um-matrix__all">
                                    <input
                                      type="checkbox"
                                      checked={on === rights.length}
                                      disabled={field.key !== 'view' && rights.every((right) => VIEW_ONLY.has(right.resourceKey))}
                                      ref={(element) => {
                                        if (element) element.indeterminate = on > 0 && on < rights.length
                                      }}
                                      aria-label={fill(t.selectAllFor, { what: `${field.label} · ${t[group.title]}` })}
                                      onChange={(event) => update(keys, field.key, event.target.checked)}
                                    />
                                    <span>{field.label}</span>
                                  </label>
                                </th>
                              )
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {rights.map((right) => {
                            const label = t[LABELS[right.resourceKey]]
                            return (
                              <tr key={right.resourceKey}>
                                <td>{label}</td>
                                {fields.map((field) => (
                                  <td key={field.key} className="um-matrix__col">
                                    <input
                                      type="checkbox"
                                      checked={right[field.key]}
                                      disabled={field.key !== 'view' && VIEW_ONLY.has(right.resourceKey)}
                                      aria-label={`${field.label} ${label}`}
                                      onChange={(event) => update([right.resourceKey], field.key, event.target.checked)}
                                    />
                                  </td>
                                ))}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </fieldset>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <footer className="um-dialog__foot">
          <span className="um-muted">{fill(t.rolesSummary, { v: counts.view, e: counts.edit, d: counts.delete })}</span>
          <div className="um-dialog__buttons">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>{t.cancel}</button>
            <button type="button" className="btn btn--primary" onClick={() => void submit()} disabled={saving}>{saving ? t.saving : t.save}</button>
          </div>
        </footer>
      </div>
    </div>
  )
}
