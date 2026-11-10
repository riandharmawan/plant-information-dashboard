import { useEffect, useRef, useState } from 'react'
import { Bell, Check, ChevronDown, Menu } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../data/api.ts'
import { useActiveSite } from '../data/ActiveSiteContext.tsx'
import { useAuth } from '../data/AuthContext.tsx'
import { useRepository } from '../data/OperationsContext.tsx'
import { errorText } from '../features/admin/errors.ts'
import { useLocale } from '../i18n/LocaleContext.tsx'
import type { SiteContext } from '../domain/types.ts'

export function Topbar({ onToggleMenu }: { onToggleMenu: () => void }) {
  const { t, locale, setLocale } = useLocale()
  const { user, logout, changePassword } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const repository = useRepository()
  const { siteId, site: active } = useActiveSite()
  const [loaded, setLoaded] = useState<{ id: string; context: SiteContext } | null>(null)
  const [noticesOpen, setNoticesOpen] = useState(false)

  useEffect(() => {
    let current = true
    repository.getSite().then((next) => {
      if (current) setLoaded({ id: siteId, context: next })
    })
    return () => {
      current = false
    }
  }, [repository, siteId])

  // Until the site's details arrive, show what the session already knows, so a switch never shows the old site.
  const site: SiteContext | null =
    loaded?.id === siteId
      ? loaded.context
      : active
        ? {
            companyName: active.companyName ?? '',
            companyCode: active.companyCode,
            siteName: active.name,
            siteCode: active.siteCode,
            timezone: active.timezone,
          }
        : null

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
        {pathname.startsWith('/management') ? (
          // The Stock Overview spans every site, so there is no single active site to switch.
          <div className="port-switcher">
            <span className="port-switcher__name">{t.mgAllSites}</span>
          </div>
        ) : (
          <SiteSwitcher site={site} />
        )}
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

/** Company and site identity: names on top, DataHub codes below. The timezone is in the tooltip. */
function scopeText(site: SiteContext | null) {
  const names = [site?.companyName, site?.siteName].filter(Boolean)
  const codes = [site?.companyCode, site?.siteCode].filter(Boolean)
  return {
    title: [...names, ...codes, site?.timezone].filter(Boolean).join(' · '),
    name: names.length ? names.join(' › ') : 'Priscolin Bekasi',
    codes: codes.length ? codes.join(' · ') : site?.timezone ?? 'Asia/Jakarta',
  }
}

function ScopeChip({ site }: { site: SiteContext | null }) {
  const text = scopeText(site)
  return (
    <div className="port-switcher" title={text.title}>
      <span className="port-switcher__name">{text.name}</span>
      <span className="port-switcher__tz">{text.codes}</span>
    </div>
  )
}

/** The chip, as a menu of the user's sites when there is more than one to choose from. */
function SiteSwitcher({ site }: { site: SiteContext | null }) {
  const { t } = useLocale()
  const { siteId, sites, setSiteId } = useActiveSite()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (sites.length < 2) return <ScopeChip site={site} />

  const text = scopeText(site)
  const groups = new Map<string, typeof sites>()
  for (const entry of sites) {
    const key = entry.companyName ?? ''
    groups.set(key, [...(groups.get(key) ?? []), entry])
  }

  return (
    <div className="site-switch" ref={box}>
      <button
        type="button"
        className="port-switcher site-switch__button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${t.switchSite}: ${text.title}`}
        onClick={() => setOpen((on) => !on)}
      >
        <span className="site-switch__lines">
          <span className="port-switcher__name">{text.name}</span>
          <span className="port-switcher__tz">{text.codes}</span>
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div className="site-switch__menu" role="menu" aria-label={t.switchSite}>
          {[...groups.entries()].map(([company, list]) => (
            <div key={company} className="site-switch__group" role="group" aria-label={company}>
              <p className="site-switch__company">
                {company}
                {list[0].companyCode ? <span>{list[0].companyCode}</span> : null}
              </p>
              {list.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={entry.id === siteId}
                  className={entry.id === siteId ? 'site-switch__item site-switch__item--on' : 'site-switch__item'}
                  onClick={() => {
                    setSiteId(entry.id)
                    setOpen(false)
                  }}
                >
                  <span>
                    {entry.name}
                    {entry.siteCode ? <small>{entry.siteCode}</small> : null}
                  </span>
                  {entry.id === siteId ? <Check size={16} aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
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
