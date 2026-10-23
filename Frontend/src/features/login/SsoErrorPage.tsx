import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { SSO_ERROR_TEXT, type Locale } from '../../i18n/messages.ts'
import '../../styles/guest-branded.css'

const HERO_PHOTO = '/pid-login-bg.jpg'

export function SsoErrorPage() {
  const { t, locale, setLocale } = useLocale()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [code] = useState(() => (searchParams.get('code') || '').trim())
  const year = new Date().getFullYear()
  const message = SSO_ERROR_TEXT[locale][code] || t.ssoErrorFallback

  return (
    <div className="guest-branded">
      <img className="guest-branded__photo" src={HERO_PHOTO} alt="" fetchPriority="high" />
      <div className="guest-branded__scrim" aria-hidden="true" />

      <header className="guest-branded__top">
        <div className="guest-branded__corp">
          <div className="guest-branded__mark" aria-hidden="true">{t.brandMark}</div>
          <span className="guest-branded__corp-name">{t.corpName}</span>
        </div>
      </header>

      <div className="guest-branded__stage">
        <div className="guest-branded__panel">
          <div>
            <h1 className="guest-branded__hero-title">{t.appTitle}</h1>
            <span className="guest-branded__hero-accent" aria-hidden="true" />
            <p className="guest-branded__hero-pitch">{t.loginPitch}</p>
          </div>

          <div className="guest-branded__card">
            <div className="guest-branded__card-top">
              <div className="guest-branded__card-heading">
                <h2 className="guest-branded__card-title">{t.ssoErrorTitle}</h2>
              </div>
              <div className="guest-lang" role="group" aria-label="Language">
                <LocaleButton locale="en" current={locale} onSelect={setLocale} label="EN" />
                <LocaleButton locale="id" current={locale} onSelect={setLocale} label="ID" />
              </div>
            </div>
            <p className="guest-branded__error" role="alert">{message}</p>
            <button
              type="button"
              className="guest-branded__submit"
              onClick={() => navigate('/login', { replace: true })}
            >
              {t.backToSignIn}
            </button>
          </div>
        </div>
      </div>

      <footer className="guest-branded__footer">
        {t.copyright.replace('{{year}}', String(year))}
      </footer>
    </div>
  )
}

function LocaleButton({
  locale,
  current,
  onSelect,
  label,
}: {
  locale: Locale
  current: Locale
  onSelect: (locale: Locale) => void
  label: string
}) {
  const active = current === locale
  return (
    <button
      type="button"
      className={active ? 'guest-lang__btn guest-lang__btn--active' : 'guest-lang__btn'}
      aria-pressed={active}
      onClick={() => onSelect(locale)}
    >
      {label}
    </button>
  )
}
