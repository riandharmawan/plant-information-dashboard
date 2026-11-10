import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../../data/api.ts'
import { useAuth } from '../../data/AuthContext.tsx'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import '../../styles/site-modules.css'

interface SiteRow {
  id: string
  name: string
  companyName: string
  siteCode: string | null
  modules: string[]
}

interface Matrix {
  modules: string[]
  sites: SiteRow[]
}

export function SiteModulesPage() {
  const { t } = useLocale()
  const { can, refresh } = useAuth()
  const canEdit = can('master-sites', 'edit')
  const [matrix, setMatrix] = useState<Matrix | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const load = useCallback(() => {
    api<Matrix>('/api/v1/admin/site-modules')
      .then(setMatrix)
      .catch((e) => setError(e instanceof ApiError ? e.code : 'request_failed'))
  }, [])
  useEffect(load, [load])

  const labels: Record<string, string> = {
    'live-ops': t.liveOps,
    qc: t.qualityControl,
    utility: t.utility,
    'daily-production': t.dailyProduction,
  }

  async function toggle(site: SiteRow, key: string) {
    const next = site.modules.includes(key) ? site.modules.filter((m) => m !== key) : [...site.modules, key]
    setBusy(site.id)
    setError(null)
    try {
      await api(`/api/v1/admin/site-modules/${encodeURIComponent(site.id)}`, { method: 'PUT', body: JSON.stringify({ modules: next }) })
      setMatrix((current) =>
        current ? { ...current, sites: current.sites.map((row) => (row.id === site.id ? { ...row, modules: next } : row)) } : current,
      )
      setSaved(site.id)
      window.setTimeout(() => setSaved((now) => (now === site.id ? null : now)), 2000)
      await refresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'request_failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="page">
      <header className="page-title-row">
        <h1 className="page-title">{t.siteModules}</h1>
      </header>
      <p className="page-note">{t.siteModulesIntro}</p>
      <p className="page-note">
        <Link to="/admin">← {t.adminMenuTitle}</Link>
      </p>
      {error ? <p className="sm-error" role="alert">{error}</p> : null}
      {!matrix ? (
        <p className="page-note">{t.loading}</p>
      ) : (
        <section className="master-panel sm-panel">
          <table className="sm-table">
            <thead>
              <tr>
                <th scope="col">{t.site}</th>
                {matrix.modules.map((key) => (
                  <th key={key} scope="col" className="sm-col">{labels[key] ?? key}</th>
                ))}
                <th scope="col" className="sm-status" />
              </tr>
            </thead>
            <tbody>
              {matrix.sites.map((site) => (
                <tr key={site.id}>
                  <th scope="row">
                    <span className="sm-site">{site.name}</span>
                    <span className="sm-company">{site.companyName}{site.siteCode ? ` · ${site.siteCode}` : ''}</span>
                  </th>
                  {matrix.modules.map((key) => (
                    <td key={key} className="sm-col">
                      <input
                        type="checkbox"
                        checked={site.modules.includes(key)}
                        disabled={!canEdit || busy === site.id}
                        onChange={() => void toggle(site, key)}
                        aria-label={`${site.name}: ${labels[key] ?? key}`}
                      />
                    </td>
                  ))}
                  <td className="sm-status">{saved === site.id ? t.siteModulesSaved : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
