import { useEffect, useState } from 'react'
import { Bell, Menu } from 'lucide-react'
import { useRepository } from '../data/OperationsContext.tsx'
import { useLocale } from '../i18n/LocaleContext.tsx'
import type { SiteContext } from '../domain/types.ts'

export function Topbar({ onToggleMenu }: { onToggleMenu: () => void }) {
  const { t, locale, setLocale } = useLocale()
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
        <div className="user-chip">
          <span className="user-chip__name">Rian Dharmawan</span>
          <span className="user-chip__avatar" aria-hidden="true">RD</span>
        </div>
      </div>
    </header>
  )
}
