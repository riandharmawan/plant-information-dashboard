import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plug, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { api, ApiError } from '../../data/api.ts'
import { useAuth } from '../../data/AuthContext.tsx'
import { useMaster } from '../../data/MasterContext.tsx'
import { useLocale } from '../../i18n/LocaleContext.tsx'

type AuthType = 'none' | 'basic' | 'cookie'

interface Source {
  id: number
  baseUrl: string
  label: string | null
  enabled: boolean
  authType: AuthType
  authUser: string | null
  secretConfigured: boolean
  lastPollAt: string | null
  lastPollOk: boolean | null
  lastError: string | null
}

interface GaugedTank {
  id: string
  code: string
  name: string | null
  unitName: string | null
  productName: string | null
  levelMm: number | null
  temperatureC: number | null
  totalMassTon: number | null
  capacityLitre?: number | null
  tankState?: string | null
  stockGroup?: string | null
  statusText: string | null
  recordedAt: string | null
  fetchedAt: string | null
}

interface Overview {
  site: { id: string; name: string; timezone: string }
  sources: Source[]
  settings: { roundTimes: string[]; toleranceMin: number }
  tanks: GaugedTank[]
}

interface TestResult {
  ok: boolean
  ms: number
  controller?: string | null
  units: Array<{ name: string; tanks: number }>
  tankCount: number
  error: string | null
}

interface SourceDraft {
  id: number | null
  baseUrl: string
  label: string
  enabled: boolean
  authType: AuthType
  authUser: string
  secret: string
  secretConfigured: boolean
}

const BLANK: SourceDraft = { id: null, baseUrl: '', label: '', enabled: true, authType: 'none', authUser: '', secret: '', secretConfigured: false }

const AUTH_LABEL: Record<AuthType, string> = { none: 'None', basic: 'User and password', cookie: 'Session cookie' }

function message(error: unknown): string {
  if (!(error instanceof ApiError)) return 'The request failed.'
  const known: Record<string, string> = {
    source_exists: 'That address is already set up for this site.',
    not_found: 'That site or gauge system was not found.',
    forbidden: 'You do not have the right to do that.',
    request_failed: 'The request failed.',
  }
  return known[error.code] ?? error.code
}

function ago(iso: string | null, now: number): string {
  if (!iso) return 'never'
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} days ago`
}

function statusTone(status: string | null): 'ok' | 'bad' | 'plain' {
  const key = String(status ?? '').toUpperCase().replace(/\s+/g, '')
  if (key === 'OK') return 'ok'
  if (key === 'NODATA' || key === 'FAIL' || key === 'INVALIDDATA') return 'bad'
  return 'plain'
}

const fmt = (value: number | null, digits: number) =>
  value == null ? '—' : value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })

export function TankGaugingPage() {
  const { t } = useLocale()
  const { can } = useAuth()
  const master = useMaster()
  const canEdit = can('master-tanks', 'edit')
  const sites = master.data.sites.filter((site) => site.isActivated)
  const [siteId, setSiteId] = useState('')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [draft, setDraft] = useState<SourceDraft | null>(null)
  const [removing, setRemoving] = useState<Source | null>(null)
  const [tests, setTests] = useState<Record<number, TestResult>>({})
  const [query, setQuery] = useState('')
  const [times, setTimes] = useState('')
  const [tolerance, setTolerance] = useState('30')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!siteId && sites.length > 0) setSiteId(sites[0].id)
  }, [siteId, sites])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  const load = useCallback(async (id: string) => {
    if (!id) return
    setLoading(true)
    try {
      const next = await api<Overview>(`/api/v1/tank-gauging/sites/${encodeURIComponent(id)}/overview`)
      setOverview(next)
      setTimes(next.settings.roundTimes.join(', '))
      setTolerance(String(next.settings.toleranceMin))
      setError(null)
    } catch (e) {
      setOverview(null)
      setError(message(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setTests({})
    void load(siteId)
  }, [siteId, load])

  const run = async (name: string, work: () => Promise<void>) => {
    setBusy(name)
    setError(null)
    setNotice(null)
    try {
      await work()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(null)
    }
  }

  const pollNow = () =>
    run('poll', async () => {
      const r = await api<{ skipped?: boolean; reason?: string; ok?: boolean; stored?: number; sources?: Array<{ error?: string | null }>; rounds?: Array<{ written?: number }> }>(
        `/api/v1/tank-gauging/sites/${encodeURIComponent(siteId)}/poll`,
        { method: 'POST' },
      )
      if (r.skipped) {
        setNotice(r.reason === 'lock_not_acquired' ? 'A poll is already running. Try again in a moment.' : 'No gauge system is switched on for this site.')
      } else {
        const rounds = (r.rounds ?? []).reduce((n, x) => n + (x.written ?? 0), 0)
        const failed = (r.sources ?? []).filter((s) => s.error).length
        setNotice(`Polled: ${r.stored ?? 0} readings stored, ${rounds} round(s) written${failed ? `, ${failed} gauge system(s) failed` : ''}.`)
      }
      await load(siteId)
    })

  const test = (source: Source) =>
    run(`test-${source.id}`, async () => {
      const r = await api<TestResult>(`/api/v1/tank-gauging/sources/${source.id}/test`, { method: 'POST' })
      setTests((current) => ({ ...current, [source.id]: r }))
    })

  const saveSource = () =>
    run('save-source', async () => {
      if (!draft) return
      const body = {
        baseUrl: draft.baseUrl,
        label: draft.label,
        enabled: draft.enabled,
        authType: draft.authType,
        authUser: draft.authType === 'basic' ? draft.authUser : '',
        secret: draft.authType === 'none' ? '' : draft.secret,
      }
      if (draft.id == null) {
        await api(`/api/v1/tank-gauging/sites/${encodeURIComponent(siteId)}/sources`, { method: 'POST', body: JSON.stringify(body) })
      } else {
        await api(`/api/v1/tank-gauging/sources/${draft.id}`, { method: 'PUT', body: JSON.stringify(body) })
      }
      setDraft(null)
      setNotice('Gauge system saved.')
      await load(siteId)
    })

  const toggleEnabled = (source: Source) =>
    run(`enable-${source.id}`, async () => {
      await api(`/api/v1/tank-gauging/sources/${source.id}`, { method: 'PUT', body: JSON.stringify({ enabled: !source.enabled }) })
      await load(siteId)
    })

  const confirmRemove = () =>
    run('remove', async () => {
      if (!removing) return
      await api(`/api/v1/tank-gauging/sources/${removing.id}`, { method: 'DELETE' })
      setRemoving(null)
      setNotice('Gauge system removed. Its tanks and history are kept.')
      await load(siteId)
    })

  const saveSettings = () =>
    run('settings', async () => {
      await api(`/api/v1/tank-gauging/sites/${encodeURIComponent(siteId)}/settings`, {
        method: 'PUT',
        body: JSON.stringify({ roundTimes: times, toleranceMin: Number(tolerance) }),
      })
      setNotice('Round times saved.')
      await load(siteId)
    })

  const tanks = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = overview?.tanks ?? []
    if (!needle) return list
    return list.filter((tank) => [tank.code, tank.name, tank.unitName, tank.productName].filter(Boolean).join(' ').toLowerCase().includes(needle))
  }, [overview, query])

  const sources = overview?.sources ?? []
  const withReading = (overview?.tanks ?? []).filter((tank) => statusTone(tank.statusText) !== 'bad' && tank.levelMm != null).length
  const lastPoll = sources.map((s) => s.lastPollAt).filter(Boolean).sort().at(-1) ?? null

  return (
    <div className="page um">
      <Link className="master-back" to="/master">{t.backToMaster}</Link>
      <header className="um-header">
        <div>
          <h1 className="page-title">{`${t.masterDash} ${t.tankGauging}`}</h1>
          <p className="um-subtitle">{t.tankGaugingBlurb}</p>
        </div>
        <div className="um-header__tools">
          <select className="um-select" value={siteId} onChange={(event) => setSiteId(event.target.value)} aria-label={t.site}>
            {sites.map((site) => <option key={site.id} value={site.id}>{site.name} · {master.data.companies.find((c) => c.id === site.companyId)?.name ?? ''}</option>)}
          </select>
          {canEdit ? (
            <button type="button" className="btn btn--primary um-add" disabled={busy !== null || !overview} onClick={() => void pollNow()}>
              <RefreshCw size={16} aria-hidden="true" />
              {busy === 'poll' ? 'Polling…' : 'Poll now'}
            </button>
          ) : null}
        </div>
      </header>

      {notice ? (
        <div className="um-banner um-banner--ok" role="status"><span>{notice}</span>
          <button type="button" className="um-icon-btn" aria-label={t.close} onClick={() => setNotice(null)}><X size={14} /></button></div>
      ) : null}
      {error ? (
        <div className="um-banner um-banner--error" role="alert"><span>{error}</span>
          <button type="button" className="um-icon-btn" aria-label={t.close} onClick={() => setError(null)}><X size={14} /></button></div>
      ) : null}

      <div className="um-tiles" role="group" aria-label="Summary">
        <div className="um-tile um-tile--static"><span className="um-tile__count">{overview?.tanks.length ?? 0}</span><span className="um-tile__label">Tanks</span></div>
        <div className="um-tile um-tile--static"><span className="um-tile__count">{withReading}</span><span className="um-tile__label">With a usable reading</span></div>
        <div className="um-tile um-tile--static"><span className="um-tile__count">{sources.filter((s) => s.enabled).length}/{sources.length}</span><span className="um-tile__label">Gauge systems on</span></div>
        <div className="um-tile um-tile--static"><span className="um-tile__count um-tile__count--text">{ago(lastPoll, now)}</span><span className="um-tile__label">Last poll</span></div>
      </div>

      <section className="um-card um-section">
        <div className="um-section__head">
          <div>
            <h2>Gauge systems</h2>
            <p className="um-muted">TankVision units this site is read from. The schedule that polls them runs on the server.</p>
          </div>
          {canEdit ? <button type="button" className="btn btn--secondary" onClick={() => setDraft({ ...BLANK })}>Add gauge system</button> : null}
        </div>
        {loading && !overview ? <div className="um-skeleton" aria-busy="true"><div className="um-skeleton__row" /></div> : sources.length === 0 ? (
          <div className="um-empty"><p>No gauge system is set up for this site yet.</p></div>
        ) : (
          <div className="um-table-wrap">
            <table className="um-table">
              <thead><tr><th>Gauge system</th><th>Sign-in</th><th>Last poll</th><th>On</th><th className="um-th-actions"><span className="visually-hidden">{t.actions}</span></th></tr></thead>
              <tbody>
                {sources.map((source) => {
                  const result = tests[source.id]
                  return (
                    <tr key={source.id} className={source.enabled ? undefined : 'um-row--off'}>
                      <td>
                        <span className="um-user__text">
                          <strong className="um-plain">{source.label || source.baseUrl}</strong>
                          <span className="um-code">{source.baseUrl}</span>
                          {result ? (
                            <span className={result.ok ? 'um-muted um-ok-text' : 'um-muted um-bad-text'}>
                              {result.ok
                                ? `Reached ${result.controller ?? 'the unit'}: ${result.units.length} unit(s), ${result.tankCount} tanks, ${result.ms} ms`
                                : `Could not read it: ${result.error ?? 'unknown error'}`}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td>{AUTH_LABEL[source.authType]}{source.authType === 'basic' && source.authUser ? ` · ${source.authUser}` : ''}</td>
                      <td>
                        {source.lastPollAt ? (
                          <span className="um-user__text">
                            <span className={source.lastPollOk ? 'um-status um-status--on' : 'um-status um-status--bad'}><i aria-hidden="true" />{source.lastPollOk ? 'OK' : 'Failed'} · {ago(source.lastPollAt, now)}</span>
                            {source.lastError ? <span className="um-muted um-bad-text" title={source.lastError}>{source.lastError.length > 90 ? `${source.lastError.slice(0, 90)}…` : source.lastError}</span> : null}
                          </span>
                        ) : <span className="um-muted">Not polled yet</span>}
                      </td>
                      <td>
                        <button type="button" role="switch" aria-checked={source.enabled} aria-label={`${source.enabled ? 'Switch off' : 'Switch on'} ${source.label || source.baseUrl}`}
                          disabled={!canEdit || busy !== null}
                          className={`um-toggle${source.enabled ? ' um-toggle--on' : ''}`} onClick={() => void toggleEnabled(source)}>
                          <span className="um-toggle__knob" />
                        </button>
                      </td>
                      <td className="um-actions">
                        {canEdit ? (
                          <>
                            <button type="button" className="um-icon-btn" title="Test connection" aria-label={`Test ${source.label || source.baseUrl}`} disabled={busy !== null} onClick={() => void test(source)}><Plug size={16} /></button>
                            <button type="button" className="um-icon-btn" title={t.edit} aria-label={`${t.edit} ${source.label || source.baseUrl}`}
                              onClick={() => setDraft({ id: source.id, baseUrl: source.baseUrl, label: source.label ?? '', enabled: source.enabled, authType: source.authType, authUser: source.authUser ?? '', secret: '', secretConfigured: source.secretConfigured })}><Pencil size={16} /></button>
                            <button type="button" className="um-icon-btn um-icon-btn--danger" title={t.remove} aria-label={`${t.remove} ${source.label || source.baseUrl}`} onClick={() => setRemoving(source)}><Trash2 size={16} /></button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="um-card um-section">
        <div className="um-section__head">
          <div>
            <h2>Daily rounds</h2>
            <p className="um-muted">At these times ({overview?.site.timezone ?? 'site time'}) the nearest reading is saved as a round, so Live Ops and the history charts work as they do for logsheet sites.</p>
          </div>
        </div>
        <div className="um-inline-form">
          <label className="um-field">
            <span>Round times</span>
            <input value={times} disabled={!canEdit} onChange={(event) => setTimes(event.target.value)} placeholder="06:30, 14:30" />
          </label>
          <label className="um-field um-field--narrow">
            <span>Match within (min)</span>
            <input type="number" min={1} max={240} value={tolerance} disabled={!canEdit} onChange={(event) => setTolerance(event.target.value)} />
          </label>
          {canEdit ? <button type="button" className="btn btn--secondary" disabled={busy !== null} onClick={() => void saveSettings()}>Save</button> : null}
        </div>
      </section>

      <section className="um-card">
        <div className="um-toolbar">
          <label className="um-search">
            <Search size={16} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tank, unit or product" aria-label="Search tanks" />
            {query ? <button type="button" className="um-icon-btn" aria-label={t.clearFilters} onClick={() => setQuery('')}><X size={14} /></button> : null}
          </label>
          <span className="um-count">{tanks.length} of {overview?.tanks.length ?? 0} tanks</span>
        </div>
        {!overview || overview.tanks.length === 0 ? (
          <div className="um-empty"><p>{loading ? 'Loading…' : 'No tanks yet. They appear after the first successful poll.'}</p></div>
        ) : tanks.length === 0 ? (
          <div className="um-empty"><p>{t.noMatch}</p></div>
        ) : (
          <div className="um-table-wrap">
            <table className="um-table">
              <thead><tr><th>Tank</th><th>Unit</th><th>Product</th><th className="um-num">Level (m)</th><th className="um-num">Temp (°C)</th><th className="um-num">Mass (t)</th><th className="um-num">Capacity (kL)</th><th>Reading</th><th>Updated</th></tr></thead>
              <tbody>
                {tanks.map((tank) => {
                  const tone = statusTone(tank.statusText)
                  return (
                    <tr key={tank.id}>
                      <td><span className="um-user__text"><strong className="um-plain">{tank.code}</strong>{tank.name && tank.name !== tank.code ? <span className="um-muted">{tank.name}</span> : null}</span></td>
                      <td>{tank.unitName || '—'}</td>
                      <td>{tank.productName || '—'}</td>
                      <td className="um-num">{fmt(tank.levelMm == null ? null : tank.levelMm / 1000, 3)}</td>
                      <td className="um-num">{fmt(tank.temperatureC, 1)}</td>
                      <td className="um-num">{fmt(tank.totalMassTon, 1)}</td>
                      <td className="um-num" title={tank.tankState ?? ''}>
                        {tank.capacityLitre ? fmt(tank.capacityLitre / 1000, 1) : tank.capacityLitre === 0 ? 'Not in use' : '—'}
                      </td>
                      <td><span className={`um-chip${tone === 'ok' ? ' um-chip--ok' : tone === 'bad' ? ' um-chip--bad' : ''}`}>{tank.statusText ?? '—'}</span></td>
                      <td><span className="um-muted" title={tank.fetchedAt ?? ''}>{ago(tank.fetchedAt, now)}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {draft ? (
        <div className="admin-overlay" onClick={() => setDraft(null)} role="presentation">
          <div className="um-dialog um-dialog--narrow" role="dialog" aria-modal="true" aria-labelledby="gauge-dialog-title" onClick={(event) => event.stopPropagation()}>
            <header className="um-dialog__head">
              <span className="um-avatar um-avatar--lg um-avatar--role" aria-hidden="true"><Plug size={20} /></span>
              <div className="um-dialog__title"><h2 id="gauge-dialog-title">{draft.id == null ? 'Add gauge system' : 'Edit gauge system'}</h2><span className="um-muted">TankVision / NXA host</span></div>
              <button type="button" className="um-icon-btn" aria-label={t.close} onClick={() => setDraft(null)}><X size={18} /></button>
            </header>
            <div className="um-dialog__body um-dialog__body--auto">
              <div className="um-form">
                <label className="um-field um-field--wide"><span>Address</span>
                  <input value={draft.baseUrl} placeholder="http://172.16.250.15" onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} />
                  <span className="um-muted">The host only, without /index.esp.</span></label>
                <label className="um-field um-field--wide"><span>Name</span>
                  <input value={draft.label} placeholder="NXA820_BT_1" onChange={(event) => setDraft({ ...draft, label: event.target.value })} /></label>
                <label className="um-field"><span>Sign-in</span>
                  <select value={draft.authType} onChange={(event) => setDraft({ ...draft, authType: event.target.value as AuthType })}>
                    {(Object.keys(AUTH_LABEL) as AuthType[]).map((type) => <option key={type} value={type}>{AUTH_LABEL[type]}</option>)}
                  </select></label>
                {draft.authType === 'basic' ? (
                  <label className="um-field"><span>User</span>
                    <input value={draft.authUser} autoComplete="off" onChange={(event) => setDraft({ ...draft, authUser: event.target.value })} /></label>
                ) : <span />}
                {draft.authType !== 'none' ? (
                  <label className="um-field um-field--wide"><span>{draft.authType === 'basic' ? 'Password' : 'Cookie'}</span>
                    <input type="password" autoComplete="new-password" value={draft.secret}
                      placeholder={draft.secretConfigured ? 'Stored. Leave blank to keep it.' : ''}
                      onChange={(event) => setDraft({ ...draft, secret: event.target.value })} />
                    <span className="um-muted">Stored encrypted. It is never shown again.</span></label>
                ) : null}
                <label className="um-switch-row">
                  <span className="um-switch-row__text"><strong>On</strong><span className="um-muted">Off units are skipped by the poller.</span></span>
                  <input type="checkbox" role="switch" className="um-switch" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />
                </label>
              </div>
            </div>
            <footer className="um-dialog__foot">
              <span />
              <div className="um-dialog__buttons">
                <button type="button" className="btn btn--secondary" onClick={() => setDraft(null)} disabled={busy !== null}>{t.cancel}</button>
                <button type="button" className="btn btn--primary" onClick={() => void saveSource()} disabled={busy !== null}>{busy === 'save-source' ? t.saving : t.save}</button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}

      {removing ? (
        <div className="admin-overlay" onClick={() => setRemoving(null)} role="presentation">
          <div className="um-confirm" role="alertdialog" aria-modal="true" aria-labelledby="gauge-remove-title" onClick={(event) => event.stopPropagation()}>
            <span className="um-confirm__icon" aria-hidden="true"><Trash2 size={20} /></span>
            <h2 id="gauge-remove-title">Remove this gauge system?</h2>
            <p>{removing.label || removing.baseUrl} will no longer be polled. Its tanks and their history stay.</p>
            <div className="um-confirm__actions">
              <button type="button" className="btn btn--secondary" onClick={() => setRemoving(null)}>{t.cancel}</button>
              <button type="button" className="btn um-btn-danger" onClick={() => void confirmRemove()}>{t.remove}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
