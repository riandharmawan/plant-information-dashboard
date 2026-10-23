import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

const GROUPS: Array<{ title: keyof Messages; keys: string[] }> = [
  { title: 'operationsGroup', keys: ['live-ops', 'ops-analytics', 'qc', 'daily-production', 'refinery-fractionation', 'utility', 'coverage'] },
  { title: 'masterGroup', keys: ['master-companies', 'master-sites', 'master-plants', 'master-commodities', 'master-calibration', 'master-tanks', 'master-logsheets', 'master-quality-rules'] },
  { title: 'administration', keys: ['admin-users', 'admin-roles'] },
]

const LABELS: Record<string, keyof Messages> = {
  'live-ops': 'liveOps',
  'ops-analytics': 'opsAnalytics',
  qc: 'qualityControl',
  'daily-production': 'dailyProduction',
  'refinery-fractionation': 'refineryFractionation',
  utility: 'utility',
  coverage: 'coverage',
  'master-companies': 'company',
  'master-sites': 'site',
  'master-plants': 'plants',
  'master-commodities': 'commodities',
  'master-calibration': 'commoditiesCalibration',
  'master-tanks': 'tankFarm',
  'master-logsheets': 'logsheetCatalog',
  'master-quality-rules': 'qualityRules',
  'admin-users': 'userManagement',
  'admin-roles': 'roleManagement',
}

function blankRights(keys: string[]): Right[] {
  return keys.map((resourceKey) => ({ resourceKey, view: false, edit: false, delete: false }))
}

export function RolesPage() {
  const { t } = useLocale()
  const { can } = useAuth()
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [catalog, setCatalog] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState<RoleDetail | null | undefined>(undefined)
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

  const openNew = () => {
    setEditing({
      id: 0,
      name: '',
      description: '',
      isSystemRole: false,
      permissions: blankRights(catalog),
    })
  }

  const openEdit = async (role: RoleRow) => {
    setPageError(null)
    try {
      setEditing(await api<RoleDetail>(`/api/v1/admin/roles/${role.id}`))
    } catch (error) {
      setPageError(errorText(t, error instanceof ApiError ? error.code : ''))
    }
  }

  const remove = async (role: RoleRow) => {
    if (!window.confirm(t.deleteRoleConfirm)) return
    setNotice(null)
    try {
      await api(`/api/v1/admin/roles/${role.id}`, { method: 'DELETE' })
      setNotice(t.roleDeleted)
      await load()
    } catch (error) {
      setPageError(errorText(t, error instanceof ApiError ? error.code : ''))
    }
  }

  return (
    <div className="page">
      <Link className="master-back" to="/admin">{t.backToAdmin}</Link>
      <header className="page-title-row">
        <h1 className="page-title">{t.roleManagement}</h1>
      </header>
      {notice ? <p className="admin-notice" role="status">{notice}</p> : null}
      {pageError ? <p className="master-error" role="alert">{pageError}</p> : null}
      <section className="master-panel">
        <div className="admin-toolbar">
          <h2>{t.roles}</h2>
          {can('admin-roles', 'edit') ? (
            <button type="button" className="btn btn--primary" onClick={openNew}>{t.addRole}</button>
          ) : null}
        </div>
        {loading ? <p className="page-note">{t.loading}</p> : roles.length === 0 ? <p className="page-note">{t.noRolesYet}</p> : (
          <div className="master-table-wrap">
            <table className="master-table">
              <thead>
                <tr>
                  <th>{t.roleName}</th>
                  <th>{t.description}</th>
                  <th>{t.usersCount}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td>
                      <strong>{role.name}</strong>
                      {role.isSystemRole ? <span className="admin-sub">{t.systemSuffix}</span> : null}
                    </td>
                    <td>{role.description || '—'}</td>
                    <td>{role.userCount}</td>
                    <td className="master-row-actions">
                      {can('admin-roles', 'edit') ? (
                        <button type="button" className="btn btn--secondary" onClick={() => void openEdit(role)}>{t.edit}</button>
                      ) : null}
                      {can('admin-roles', 'delete') && !role.isSystemRole ? (
                        <button type="button" className="btn btn--secondary" onClick={() => void remove(role)}>{t.remove}</button>
                      ) : null}
                    </td>
                  </tr>
                ))}
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
    </div>
  )
}

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
  const [name, setName] = useState(role.name)
  const [description, setDescription] = useState(role.description ?? '')
  const [permissions, setPermissions] = useState<Right[]>(role.permissions)
  const [formError, setFormError] = useState<string | null>(null)

  const update = (key: string, field: 'view' | 'edit' | 'delete', checked: boolean) => {
    setPermissions((current) => current.map((right) => {
      if (right.resourceKey !== key) return right
      const next = { ...right, [field]: checked }
      if ((field === 'edit' || field === 'delete') && checked) next.view = true
      if (field === 'view' && !checked) {
        next.edit = false
        next.delete = false
      }
      return next
    }))
  }

  const submit = async () => {
    setFormError(null)
    try {
      await onSave({ name, description, permissions })
    } catch (error) {
      setFormError(errorText(t, error instanceof ApiError ? error.code : ''))
    }
  }

  return (
    <div className="admin-overlay" onClick={onClose} role="presentation">
      <div className="admin-dialog admin-dialog--wide" role="dialog" aria-modal="true" aria-labelledby="role-dialog-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="role-dialog-title">{role.id ? t.editRole : t.addRole}</h2>
        {formError ? <p className="master-error" role="alert">{formError}</p> : null}
        <label>{t.roleName}
          <input className="admin-input" value={name} disabled={role.isSystemRole} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>{t.description}
          <input className="admin-input" value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        {GROUPS.map((group) => (
          <fieldset key={group.title} className="admin-set">
            <legend>{t[group.title]}</legend>
            <table className="master-table admin-rights">
              <thead>
                <tr>
                  <th>{t.pages}</th>
                  <th>{t.permissionView}</th>
                  <th>{t.permissionEdit}</th>
                  <th>{t.permissionDelete}</th>
                </tr>
              </thead>
              <tbody>
                {group.keys.map((key) => {
                  const right = permissions.find((item) => item.resourceKey === key)
                  if (!right) return null
                  const label = t[LABELS[key]]
                  return (
                    <tr key={key}>
                      <td>{label}</td>
                      <td><input type="checkbox" checked={right.view} aria-label={`${t.permissionView} ${label}`} onChange={(event) => update(key, 'view', event.target.checked)} /></td>
                      <td><input type="checkbox" checked={right.edit} aria-label={`${t.permissionEdit} ${label}`} onChange={(event) => update(key, 'edit', event.target.checked)} /></td>
                      <td><input type="checkbox" checked={right.delete} aria-label={`${t.permissionDelete} ${label}`} onChange={(event) => update(key, 'delete', event.target.checked)} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </fieldset>
        ))}
        <div className="admin-dialog__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>{t.cancel}</button>
          <button type="button" className="btn btn--primary" onClick={() => void submit()} disabled={saving}>{saving ? t.saving : t.save}</button>
        </div>
      </div>
    </div>
  )
}
