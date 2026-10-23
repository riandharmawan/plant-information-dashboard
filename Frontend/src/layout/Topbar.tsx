import { useEffect, useState } from 'react'
import { Bell, Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../data/api.ts'
import { useAuth } from '../data/AuthContext.tsx'
import { useRepository } from '../data/OperationsContext.tsx'
import { errorText } from '../features/admin/errors.ts'
import { useLocale } from '../i18n/LocaleContext.tsx'
import type { SiteContext } from '../domain/types.ts'

export function Topbar({ onToggleMenu }: { onToggleMenu: () => void }) {
  const { t, locale, setLocale } = useLocale()
  const { user, logout, changePassword } = useAuth()
  const navigate = useNavigate()
  const repository = useRepository()
  const [site, setSite] = useState<SiteContext | null>(null)
  const [noticesOpen, setNoticesOpen] = useState(false)

  useEffect(() => {
    let active = true
    repository.getSite().then((next) => {
      if (active) setSite(next)
    })
    return () => {
      active = false
    }
  }, [repository])

  return (
    <header className="topbar">
      <button type="button" className="topbar__nav-toggle" aria-label={t.openMenu} onClick={onToggleMenu}>
        <Menu size={18} />
      </button>
      <div className="topbar__brand">
        <div className="topbar__brand-mark" aria-hidden="true">{t.brandMark}</div>
        <div className="topbar__brand-text">
          <span className="topbar__brand-title">{t.appTitle}</span>
          <span className="topbar__brand-tagline">{t.tagline}</span>
        </div>
      </div>
      <div className="topbar__actions">
        <div className="port-switcher">
          <span className="port-switcher__name">{site?.siteName ?? 'Priscolin Bekasi'}</span>
          <span className="port-switcher__tz">{site?.timezone ?? 'Asia/Jakarta'}</span>
        </div>
        <div className="notif">
          <button
            type="button"
            className="icon-btn"
            aria-label={t.notifications}
            aria-expanded={noticesOpen}
            onClick={() => setNoticesOpen((open) => !open)}
          >
            <Bell size={16} />
          </button>
          {noticesOpen && <div className="notif__panel">{t.noNotifications}</div>}
        </div>
        <div className="language-switch" role="group" aria-label="Language">
          <button
            type="button"
            className={locale === 'en' ? 'language-switch__btn language-switch__btn--active' : 'language-switch__btn'}
            aria-pressed={locale === 'en'}
            onClick={() => setLocale('en')}
          >
            EN
          </button>
          <button
            type="button"
            className={locale === 'id' ? 'language-switch__btn language-switch__btn--active' : 'language-switch__btn'}
            aria-pressed={locale === 'id'}
            onClick={() => setLocale('id')}
          >
            ID
          </button>
        </div>
        <AccountMenu
          name={user?.displayName || user?.username || ''}
          username={user?.username || ''}
          onSignOut={async () => {
            await logout()
            navigate('/login')
          }}
          onChangePassword={changePassword}
          t={t}
        />
      </div>
    </header>
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function AccountMenu({
  name,
  username,
  onSignOut,
  onChangePassword,
  t,
}: {
  name: string
  username: string
  onSignOut: () => Promise<void>
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>
  t: ReturnType<typeof useLocale>['t']
}) {
  const [open, setOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

  return (
    <div className="account-menu">
      <button type="button" className="user-chip" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="user-chip__name">{name}</span>
        <span className="user-chip__avatar" aria-hidden="true">{initials(name)}</span>
      </button>
      {open ? (
        <div className="account-menu__panel">
          <p className="account-menu__name">{name}</p>
          <p className="account-menu__user">{username}</p>
          <button type="button" className="btn btn--secondary" onClick={() => { setOpen(false); setPasswordOpen(true) }}>{t.changePassword}</button>
          <button type="button" className="btn btn--secondary" onClick={() => void onSignOut()}>{t.signOut}</button>
        </div>
      ) : null}
      {passwordOpen ? (
        <PasswordDialog
          t={t}
          onClose={() => setPasswordOpen(false)}
          onSubmit={onChangePassword}
        />
      ) : null}
    </div>
  )
}

function PasswordDialog({
  t,
  onClose,
  onSubmit,
}: {
  t: ReturnType<typeof useLocale>['t']
  onClose: () => void
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!currentPassword) return setError(t.currentPasswordRequired)
    if (!newPassword) return setError(t.newPasswordRequired)
    if (newPassword.length < 6) return setError(t.passwordShort)
    if (newPassword !== confirmPassword) return setError(t.confirmMismatch)
    if (newPassword === currentPassword) return setError(t.samePassword)
    setSaving(true)
    setError(null)
    try {
      await onSubmit(currentPassword, newPassword)
      onClose()
    } catch (caught) {
      setError(errorText(t, caught instanceof ApiError ? caught.code : ''))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-overlay" onClick={onClose} role="presentation">
      <div className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="password-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="password-title">{t.changePassword}</h2>
        {error ? <p className="master-error" role="alert">{error}</p> : null}
        <label>{t.currentPassword}
          <input className="admin-input" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
        </label>
        <label>{t.newPassword}
          <input className="admin-input" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
        </label>
        <label>{t.confirmPassword}
          <input className="admin-input" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
        </label>
        <div className="admin-dialog__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>{t.cancel}</button>
          <button type="button" className="btn btn--primary" onClick={() => void submit()} disabled={saving}>{saving ? t.saving : t.save}</button>
        </div>
      </div>
    </div>
  )
}
