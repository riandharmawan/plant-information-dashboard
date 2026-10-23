import { Link } from 'react-router-dom'
import { useAuth } from '../../data/AuthContext.tsx'
import { useLocale } from '../../i18n/LocaleContext.tsx'

export function AdminMenuPage() {
  const { t } = useLocale()
  const { can } = useAuth()

  return (
    <div className="page">
      <header className="page-title-row">
        <h1 className="page-title">{t.adminMenuTitle}</h1>
      </header>
      <p className="page-note">{t.adminIntro}</p>
      <div className="master-card-grid">
        {can('admin-users', 'view') ? (
          <Link className="master-link-card" to="/admin/users">
            <h3>{t.userManagement}</h3>
            <p>{t.userManagementBlurb}</p>
            <span className="master-open">{t.openPage}</span>
          </Link>
        ) : null}
        {can('admin-roles', 'view') ? (
          <Link className="master-link-card" to="/admin/roles">
            <h3>{t.roleManagement}</h3>
            <p>{t.roleManagementBlurb}</p>
            <span className="master-open">{t.openPage}</span>
          </Link>
        ) : null}
      </div>
    </div>
  )
}
