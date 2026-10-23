import { Navigate, Outlet, useLocation } from 'react-router-dom'
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

export function PageGate({ page }: { page: string }) {
  const { can } = useAuth()
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
  return <Outlet />
}
