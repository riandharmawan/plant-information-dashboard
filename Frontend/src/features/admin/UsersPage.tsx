import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../../data/api.ts'
import { useAuth } from '../../data/AuthContext.tsx'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { errorText } from './errors.ts'

interface RoleOption {
  id: number
  name: string
  isSystemRole: boolean
}

interface SiteOption {
  id: string
  name: string
}

interface UserRow {
  id: number
  username: string
  displayName: string | null
  email: string | null
  isActive: boolean
  roles: RoleOption[]
  sites: SiteOption[]
}

type StatusFilter = 'all' | 'active' | 'inactive'

export function UsersPage() {
  const { t } = useLocale()
  const { can } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [sites, setSites] = useState<SiteOption[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<'user' | 'email' | 'roles' | 'sites' | 'status'>('user')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [editing, setEditing] = useState<UserRow | null | undefined>(undefined)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setPageError(null)
    setLoading(true)
    try {
      const [nextUsers, nextRoles, nextSites] = await Promise.all([
        api<UserRow[]>('/api/v1/admin/users'),
        api<RoleOption[]>('/api/v1/admin/roles'),
        api<SiteOption[]>('/api/v1/admin/sites'),
      ])
      setUsers(nextUsers)
      setRoles(nextRoles)
      setSites(nextSites)
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
    const filtered = users.filter((user) => {
      if (status === 'active' && !user.isActive) return false
      if (status === 'inactive' && user.isActive) return false
      if (!needle) return true
      const haystack = [
        user.displayName,
        user.username,
        user.email,
        user.roles.map((role) => role.name).join(' '),
        user.sites.map((site) => site.name).join(' '),
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(needle)
    })
    const valueOf = (user: UserRow) => {
      if (sortKey === 'email') return user.email ?? ''
      if (sortKey === 'roles') return user.roles.map((role) => role.name).join(', ')
      if (sortKey === 'sites') return user.sites.map((site) => site.name).join(', ')
      if (sortKey === 'status') return user.isActive ? '1' : '0'
      return user.displayName || user.username
    }
    const sign = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((left, right) => valueOf(left).localeCompare(valueOf(right), undefined, { numeric: true }) * sign)
  }, [users, query, status, sortKey, sortDir])

  const sortBy = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const remove = async (user: UserRow) => {
    if (!window.confirm(t.deleteUserConfirm)) return
    setNotice(null)
    try {
      await api(`/api/v1/admin/users/${user.id}`, { method: 'DELETE' })
      setNotice(t.userDeleted)
      await load()
    } catch (error) {
      setPageError(errorText(t, error instanceof ApiError ? error.code : ''))
    }
  }

  return (
    <div className="page">
      <Link className="master-back" to="/admin">{t.backToAdmin}</Link>
      <header className="page-title-row">
        <h1 className="page-title">{t.userManagement}</h1>
      </header>
      {notice ? <p className="admin-notice" role="status">{notice}</p> : null}
      {pageError ? <p className="master-error" role="alert">{pageError}</p> : null}
      <section className="master-panel">
        <div className="admin-toolbar">
          <h2>{t.users}</h2>
          <div className="admin-toolbar__tools">
            <input
              className="admin-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.search}
              aria-label={t.search}
            />
            <select className="admin-input" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} aria-label={t.status}>
              <option value="all">{t.allStatuses}</option>
              <option value="active">{t.activeStatus}</option>
              <option value="inactive">{t.inactiveStatus}</option>
            </select>
            {can('admin-users', 'edit') ? (
              <button type="button" className="btn btn--primary" onClick={() => setEditing(null)}>{t.addUser}</button>
            ) : null}
          </div>
        </div>
        {loading ? <p className="page-note">{t.loading}</p> : users.length === 0 ? <p className="page-note">{t.noUsers}</p> : (
          <div className="master-table-wrap">
            <table className="master-table">
              <thead>
                <tr>
                  <Sort label={t.user} active={sortKey === 'user'} dir={sortDir} onClick={() => sortBy('user')} />
                  <Sort label={t.email} active={sortKey === 'email'} dir={sortDir} onClick={() => sortBy('email')} />
                  <Sort label={t.roles} active={sortKey === 'roles'} dir={sortDir} onClick={() => sortBy('roles')} />
                  <Sort label={t.sites} active={sortKey === 'sites'} dir={sortDir} onClick={() => sortBy('sites')} />
                  <Sort label={t.status} active={sortKey === 'status'} dir={sortDir} onClick={() => sortBy('status')} />
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => (
                  <tr key={user.id} className={user.isActive ? undefined : 'admin-row--inactive'}>
                    <td>
                      <strong>{user.displayName || user.username}</strong>
                      {user.displayName ? <span className="admin-sub">{user.username}</span> : null}
                    </td>
                    <td>{user.email || '—'}</td>
                    <td>{user.roles.map((role) => role.name).join(', ') || '—'}</td>
                    <td>{user.sites.map((site) => site.name).join(', ') || '—'}</td>
                    <td>
                      <span className={user.isActive ? 'admin-badge admin-badge--on' : 'admin-badge'}>
                        {user.isActive ? t.activeStatus : t.inactiveStatus}
                      </span>
                    </td>
                    <td className="master-row-actions">
                      {can('admin-users', 'edit') ? (
                        <button type="button" className="btn btn--secondary" onClick={() => setEditing(user)}>{t.edit}</button>
                      ) : null}
                      {can('admin-users', 'delete') ? (
                        <button type="button" className="btn btn--secondary" onClick={() => void remove(user)}>{t.remove}</button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 ? <p className="page-note">{t.noMatch}</p> : null}
          </div>
        )}
      </section>
      {editing !== undefined ? (
        <UserDialog
          user={editing}
          roles={roles}
          sites={sites}
          saving={saving}
          onClose={() => setEditing(undefined)}
          onSave={async (body) => {
            setSaving(true)
            setPageError(null)
            try {
              const path = editing ? `/api/v1/admin/users/${editing.id}` : '/api/v1/admin/users'
              const saved = await api<{ siteCount: number }>(path, {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify(body),
              })
              setNotice(t.userSaved.replace('{n}', String(saved.siteCount)))
              setEditing(undefined)
              await load()
            } catch (error) {
              throw error
            } finally {
              setSaving(false)
            }
          }}
        />
      ) : null}
    </div>
  )
}

function Sort({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
}) {
  return (
    <th>
      <button type="button" className="master-sort" onClick={onClick}>
        {label}{active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  )
}

function UserDialog({
  user,
  roles,
  sites,
  saving,
  onClose,
  onSave,
}: {
  user: UserRow | null
  roles: RoleOption[]
  sites: SiteOption[]
  saving: boolean
  onClose: () => void
  onSave: (body: Record<string, unknown>) => Promise<void>
}) {
  const { t } = useLocale()
  const [username, setUsername] = useState(user?.username ?? '')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [isActive, setIsActive] = useState(user?.isActive ?? true)
  const [roleIds, setRoleIds] = useState<number[]>(user?.roles.map((role) => role.id) ?? [])
  const [siteIds, setSiteIds] = useState<string[]>(user?.sites.map((site) => site.id) ?? [])
  const [siteQuery, setSiteQuery] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const visibleSites = sites.filter((site) => site.name.toLowerCase().includes(siteQuery.trim().toLowerCase()))

  const toggle = <T,>(list: T[], value: T, on: boolean) => (
    on ? [...new Set([...list, value])] : list.filter((item) => item !== value)
  )

  const submit = async () => {
    setFormError(null)
    try {
      await onSave({
        username,
        password,
        displayName,
        email,
        isActive,
        roleIds,
        siteIds,
      })
    } catch (error) {
      setFormError(errorText(t, error instanceof ApiError ? error.code : ''))
    }
  }

  return (
    <div className="admin-overlay" onClick={onClose} role="presentation">
      <div className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="user-dialog-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="user-dialog-title">{user ? t.editUser : t.addUser}</h2>
        {formError ? <p className="master-error" role="alert">{formError}</p> : null}
        <label>{t.username}
          <input className="admin-input" value={username} disabled={Boolean(user)} onChange={(event) => setUsername(event.target.value)} autoComplete="off" />
        </label>
        <label>{user ? t.newPasswordOptional : t.password}
          <input className="admin-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
        </label>
        <label>{t.displayName}
          <input className="admin-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <label>{t.email}
          <input className="admin-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="admin-check">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          {t.active}
        </label>
        <fieldset className="admin-set">
          <legend>{t.roles}</legend>
          {roles.length === 0 ? <p className="page-note">{t.noRoles}</p> : (
            <div className="admin-checks">
              {roles.map((role) => (
                <label key={role.id} className="admin-check">
                  <input
                    type="checkbox"
                    checked={roleIds.includes(role.id)}
                    onChange={(event) => setRoleIds(toggle(roleIds, role.id, event.target.checked))}
                  />
                  {role.name}{role.isSystemRole ? <span className="admin-sub admin-sub--inline">{t.systemSuffix}</span> : null}
                </label>
              ))}
            </div>
          )}
          <p className="page-note">{t.rolesHelp}</p>
        </fieldset>
        <fieldset className="admin-set">
          <legend>{t.siteAccess}</legend>
          <div className="admin-site-tools">
            <input className="admin-input" value={siteQuery} onChange={(event) => setSiteQuery(event.target.value)} placeholder={t.searchSite} />
            <button type="button" className="btn btn--secondary" onClick={() => setSiteIds([...new Set([...siteIds, ...visibleSites.map((site) => site.id)])])}>{t.selectVisible}</button>
            <button type="button" className="btn btn--secondary" onClick={() => setSiteIds(siteIds.filter((id) => !visibleSites.some((site) => site.id === id)))}>{t.clearVisible}</button>
          </div>
          {sites.length === 0 ? <p className="page-note">{t.noSites}</p> : (
            <div className="admin-checks admin-checks--scroll">
              {visibleSites.map((site) => (
                <label key={site.id} className="admin-check">
                  <input
                    type="checkbox"
                    checked={siteIds.includes(site.id)}
                    onChange={(event) => setSiteIds(toggle(siteIds, site.id, event.target.checked))}
                  />
                  {site.name}
                </label>
              ))}
            </div>
          )}
          <p className="page-note">{t.sitesHelp}</p>
        </fieldset>
        <div className="admin-dialog__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>{t.cancel}</button>
          <button type="button" className="btn btn--primary" onClick={() => void submit()} disabled={saving}>{saving ? t.saving : user ? t.save : t.add}</button>
        </div>
      </div>
    </div>
  )
}
