import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useActiveSite } from '../../data/ActiveSiteContext.tsx'
import { useAuth } from '../../data/AuthContext.tsx'
import { useLocale } from '../../i18n/LocaleContext.tsx'

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const { t } = useLocale()

  if (loading) {
    return <p className="page-note">{t.loading}</p>
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

export function SiteRequired() {
  const { user } = useAuth()
  const { t } = useLocale()
  if (!user?.sites.length) {
    return (
      <div className="page">
        <section className="master-panel access-card">
          <h1 className="page-title">{t.accessNotConfigured}</h1>
          <p className="page-note">{t.noSiteBody}</p>
        </section>
      </div>
    )
  }
  return <Outlet />
}

/** Where each site module starts. The first module a site has is where its landing page goes. */
const MODULE_HOME: Array<[string, string]> = [
  ['live-ops', '/'],
  ['qc', '/qc'],
  ['utility', '/utility'],
  ['daily-production', '/daily-production'],
]

/**
 * A page needs the user's right on it and, when it belongs to a site module, that module switched on
 * for the active site. The landing page passes landing, so a site without that module is sent to the
 * first module it has instead of an error.
 */
export function PageGate({ page, module, landing }: { page: string; module?: string; landing?: boolean }) {
  const { can } = useAuth()
  const { hasModule } = useActiveSite()
  const { t } = useLocale()
  if (!can(page, 'view')) {
    return (
      <div className="page">
        <section className="master-panel access-card">
          <h1 className="page-title">{t.accessDenied}</h1>
          <p className="page-note">{t.accessDeniedBody}</p>
        </section>
      </div>
    )
  }
  if (module && !hasModule(module)) {
    const next = landing ? MODULE_HOME.find(([key]) => key !== module && hasModule(key) && can(key, 'view')) : undefined
    if (next) return <Navigate to={next[1]} replace />
    return (
      <div className="page">
        <section className="master-panel access-card">
          <h1 className="page-title">{t.moduleNotEnabled}</h1>
          <p className="page-note">{t.moduleNotEnabledBody}</p>
        </section>
      </div>
    )
  }
  return <Outlet />
}
