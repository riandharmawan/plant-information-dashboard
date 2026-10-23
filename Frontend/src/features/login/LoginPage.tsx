import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, User } from 'lucide-react'
import { ApiError } from '../../data/api.ts'
import { useAuth } from '../../data/AuthContext.tsx'
import { errorText } from '../admin/errors.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import type { Locale } from '../../i18n/messages.ts'
import '../../styles/guest-branded.css'

const HERO_PHOTO = '/pid-login-bg.jpg'

export function LoginPage() {
  const { t, locale, setLocale } = useLocale()
  const { user, loading, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [missing, setMissing] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const year = new Date().getFullYear()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!username.trim() || !password) {
      setMissing(true)
      setFormError(null)
      return
    }
    setMissing(false)
    setBusy(true)
    setFormError(null)
    try {
      await login(username.trim(), password)
    } catch (error) {
      setFormError(errorText(t, error instanceof ApiError ? error.code : ''))
    } finally {
      setBusy(false)
    }
  }

  if (!loading && user) return <Navigate to="/" replace />

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
                <h2 className="guest-branded__card-title">{t.welcomeBack}</h2>
                <p className="guest-branded__card-desc">{t.signInContinue}</p>
              </div>
              <div className="guest-lang" role="group" aria-label="Language">
                <LocaleButton locale="en" current={locale} onSelect={setLocale} label="EN" />
                <LocaleButton locale="id" current={locale} onSelect={setLocale} label="ID" />
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {missing ? <p className="guest-branded__error">{t.loginRequired}</p> : null}
              {formError ? <p className="guest-branded__error">{formError}</p> : null}
              <div className="guest-branded__field-group">
                <label className="guest-branded__label" htmlFor="login-username">
                  {t.loginUsername}
                </label>
                <div className="guest-branded__field">
                  <span className="guest-branded__field-icon" aria-hidden="true">
                    <User size={16} strokeWidth={1.8} />
                  </span>
                  <input
                    id="login-username"
                    className="guest-branded__input guest-branded__input--with-icon"
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value)
                      if (missing) setMissing(false)
                    }}
                    maxLength={254}
                    autoComplete="username"
                    placeholder={t.loginUsernamePlaceholder}
                    spellCheck={false}
                  />
                </div>
              </div>
              <div className="guest-branded__field-group">
                <label className="guest-branded__label" htmlFor="login-password">
                  {t.loginPassword}
                </label>
                <div className="guest-branded__field">
                  <span className="guest-branded__field-icon" aria-hidden="true">
                    <Lock size={16} strokeWidth={1.8} />
                  </span>
                  <input
                    id="login-password"
                    className="guest-branded__input guest-branded__input--with-icon guest-branded__input--with-toggle"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value)
                      if (missing) setMissing(false)
                    }}
                    maxLength={128}
                    autoComplete="current-password"
                    placeholder={t.loginPasswordPlaceholder}
                  />
                  <button
                    type="button"
                    className="guest-branded__field-toggle"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? t.hidePassword : t.showPassword}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
                  </button>
                </div>
              </div>
              <button type="submit" className="guest-branded__submit" disabled={busy}>
                {busy ? t.signingIn : t.signIn}
              </button>
            </form>
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
