import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../../data/api.ts'
import { useAuth } from '../../data/AuthContext.tsx'
import { useMaster } from '../../data/MasterContext.tsx'
import { useLocale } from '../../i18n/LocaleContext.tsx'

type Entity = 'company' | 'site'

const ENTITIES: Array<{ key: Entity; label: string }> = [
  { key: 'company', label: 'Company' },
  { key: 'site', label: 'Site' },
]

interface Config {
  baseUrl: string
  publicKey: string
  enabled: boolean
  privateKeyConfigured: boolean
  source: string
  lastSyncAt: string | null
  lastSyncOk: boolean | null
  lastError: string | null
}

interface Run {
  id: number
  entityType: Entity
  status: string
  hubRecordCount: number
  newCount: number
  changedCount: number
  unchangedCount: number
  appliedCount: number
  error: string | null
  startedAt: string
}

interface Item {
  id: number
  localId: string | null
  hubCode: string | null
  label: string
  diffKind: 'new' | 'changed' | 'unchanged'
  decision: 'pending' | 'approved' | 'rejected'
  fieldDiff: Record<string, { from: unknown; to: unknown }>
  parentMissing: boolean
  appliedAt: string | null
  applyError: string | null
}

interface TestResult {
  ok: boolean
  slug: string
  error?: string
  fieldKeys?: string[]
}

function messageOf(error: unknown) {
  return error instanceof ApiError ? error.code : 'Request failed'
}

function show(value: unknown) {
  return value == null || value === '' ? '—' : String(value)
}

export function DataHubPage() {
  const { t } = useLocale()
  const { can } = useAuth()
  const { data } = useMaster()
  const canEdit = can('admin-datahub', 'edit')

  const [config, setConfig] = useState<Config | null>(null)
  const [form, setForm] = useState({ baseUrl: '', publicKey: '', privateKey: '', enabled: false })
  const [runs, setRuns] = useState<Run[]>([])
  const [open, setOpen] = useState<{ run: Run; items: Item[] } | null>(null)
  const [tests, setTests] = useState<Record<string, TestResult> | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState({ entity: 'company' as Entity, localId: '', hubCode: '' })

  const loadConfig = useCallback(async () => {
    const next = await api<Config>('/api/v1/admin/datahub/config')
    setConfig(next)
    setForm({ baseUrl: next.baseUrl, publicKey: next.publicKey, privateKey: '', enabled: next.enabled })
  }, [])

  const loadRuns = useCallback(async () => {
    setRuns(await api<Run[]>('/api/v1/admin/datahub/runs'))
  }, [])

  useEffect(() => {
    Promise.all([loadConfig(), loadRuns()]).catch((e) => setError(messageOf(e)))
  }, [loadConfig, loadRuns])

  const run = async (name: string, work: () => Promise<void>) => {
    setBusy(name)
    setError(null)
    setNotice(null)
    try {
      await work()
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setBusy(null)
    }
  }

  const save = () =>
    run('save', async () => {
      await api('/api/v1/admin/datahub/config', { method: 'PUT', body: JSON.stringify(form) })
      await loadConfig()
      setNotice('Connection saved.')
    })

  const test = () =>
    run('test', async () => {
      const result = await api<{ results: Record<string, TestResult> }>('/api/v1/admin/datahub/test', { method: 'POST' })
      setTests(result.results)
    })

  const openRun = async (id: number) => {
    const detail = await api<{ run: Run; items: Item[] }>(`/api/v1/admin/datahub/runs/${id}`)
    setOpen(detail)
  }

  const pull = (entity: Entity) =>
    run(`pull-${entity}`, async () => {
      const result = await api<{ run: Run | null; noChanges?: boolean }>('/api/v1/admin/datahub/runs', {
        method: 'POST',
        body: JSON.stringify({ entityType: entity }),
      })
      await loadRuns()
      if (result.run) await openRun(result.run.id)
      else setNotice(`${entity}: DataHub and this app already match.`)
    })

  const decide = async (item: Item, decision: 'approved' | 'rejected') => {
    if (!open) return
    await api(`/api/v1/admin/datahub/runs/${open.run.id}/items`, {
      method: 'PATCH',
      body: JSON.stringify({ decisions: [{ itemId: item.id, decision }] }),
    })
    setOpen({ ...open, items: open.items.map((row) => (row.id === item.id ? { ...row, decision } : row)) })
  }

  const apply = () =>
    run('apply', async () => {
      if (!open) return
      const result = await api<{ created: number; updated: number; failed: number }>(
        `/api/v1/admin/datahub/runs/${open.run.id}/apply`,
        { method: 'POST' },
      )
      setNotice(`Applied: ${result.created} created, ${result.updated} updated, ${result.failed} failed.`)
      await openRun(open.run.id)
      await loadRuns()
    })

  const discard = () =>
    run('discard', async () => {
      if (!open) return
      await api(`/api/v1/admin/datahub/runs/${open.run.id}/discard`, { method: 'POST' })
      setOpen(null)
      await loadRuns()
    })

  const doLink = () =>
    run('link', async () => {
      await api('/api/v1/admin/datahub/link', {
        method: 'POST',
        body: JSON.stringify({ entityType: link.entity, localId: link.localId, hubCode: link.hubCode }),
      })
      setNotice(`Linked ${link.localId} to ${link.hubCode}. Pull ${link.entity} again to see the differences.`)
      setLink({ ...link, localId: '', hubCode: '' })
    })

  const localOptions: Array<{ id: string; name: string }> =
    link.entity === 'company' ? data.companies : data.sites

  const staged = open?.run.status === 'staged'

  return (
    <div className="page">
      <Link className="master-back" to="/admin">{t.backToAdmin}</Link>
      <header className="page-title-row">
        <h1 className="page-title">DataHub</h1>
      </header>
      <p className="page-note">
        Pull Company and Site from DataHub. Each pull is staged for review and nothing is written until you apply it.
        Sync in order: Company, then Site.
      </p>
      {notice ? <p className="admin-notice" role="status">{notice}</p> : null}
      {error ? <p className="master-error" role="alert">{error}</p> : null}

      <section className="master-panel">
        <h2>Connection</h2>
        <div className="admin-toolbar__tools">
          <input className="admin-input" style={{ minWidth: 280 }} placeholder="API base URL" value={form.baseUrl} disabled={!canEdit}
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} aria-label="API base URL" />
          <input className="admin-input" placeholder="Public key" value={form.publicKey} disabled={!canEdit}
            onChange={(e) => setForm({ ...form, publicKey: e.target.value })} aria-label="Public key" />
          <input className="admin-input" type="password" autoComplete="off" disabled={!canEdit}
            placeholder={config?.privateKeyConfigured ? 'Private key stored. Leave blank to keep.' : 'Private key'}
            value={form.privateKey} onChange={(e) => setForm({ ...form, privateKey: e.target.value })} aria-label="Private key" />
          <label>
            <input type="checkbox" checked={form.enabled} disabled={!canEdit}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enabled
          </label>
          {canEdit ? (
            <>
              <button type="button" className="btn btn--primary" disabled={busy !== null} onClick={() => void save()}>Save</button>
              <button type="button" className="btn btn--secondary" disabled={busy !== null} onClick={() => void test()}>Test connection</button>
            </>
          ) : null}
        </div>
        {config ? (
          <p className="admin-sub">
            Source: {config.source}.{' '}
            {config.lastSyncAt ? `Last sync ${new Date(config.lastSyncAt).toLocaleString()} — ${config.lastSyncOk ? 'ok' : `failed: ${config.lastError ?? ''}`}` : 'No sync yet.'}
          </p>
        ) : null}
        {tests ? (
          <ul>
            {ENTITIES.map(({ key, label }) => {
              const r = tests[key]
              return (
                <li key={key}>
                  {label}: {r?.ok ? `ok (${r.slug}: ${r.fieldKeys?.join(', ')})` : `not available — ${r?.error ?? 'unknown'}`}
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>

      <section className="master-panel">
        <h2>Pull from DataHub</h2>
        <div className="admin-toolbar__tools">
          {ENTITIES.map(({ key, label }) => (
            <button key={key} type="button" className="btn btn--primary" disabled={!canEdit || busy !== null} onClick={() => void pull(key)}>
              {busy === `pull-${key}` ? 'Pulling…' : `Pull ${label}`}
            </button>
          ))}
        </div>
      </section>

      {open ? (
        <section className="master-panel">
          <div className="admin-toolbar">
            <h2>
              Run #{open.run.id} — {open.run.entityType} — {open.run.status}
              <span className="admin-sub admin-sub--inline">
                {open.run.newCount} new, {open.run.changedCount} changed, {open.run.unchangedCount} unchanged
              </span>
            </h2>
            {staged && canEdit ? (
              <div className="admin-toolbar__tools">
                <button type="button" className="btn btn--primary" disabled={busy !== null} onClick={() => void apply()}>Apply approved</button>
                <button type="button" className="btn btn--secondary" disabled={busy !== null} onClick={() => void discard()}>Discard</button>
              </div>
            ) : null}
          </div>
          <div className="master-table-wrap">
            <table className="master-table">
              <thead>
                <tr><th>Name</th><th>Hub code</th><th>Change</th><th>Details</th><th>Decision</th></tr>
              </thead>
              <tbody>
                {open.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.label}</td>
                    <td>{show(item.hubCode)}</td>
                    <td><span className={item.diffKind === 'new' ? 'admin-badge admin-badge--on' : 'admin-badge'}>{item.diffKind}</span></td>
                    <td>
                      {Object.entries(item.fieldDiff).map(([field, d]) => (
                        <span key={field} className="admin-sub">{field}: {show(d.from)} → {show(d.to)}</span>
                      ))}
                      {item.parentMissing ? <span className="admin-sub">Parent not synced yet</span> : null}
                      {item.applyError ? <span className="master-error">{item.applyError}</span> : null}
                      {item.appliedAt ? <span className="admin-sub">Applied</span> : null}
                    </td>
                    <td>
                      {staged && canEdit ? (
                        <select className="admin-input" value={item.decision} aria-label={`Decision for ${item.label}`}
                          onChange={(e) => void decide(item, e.target.value as 'approved' | 'rejected')}>
                          <option value="approved">Approve</option>
                          <option value="rejected">Reject</option>
                        </select>
                      ) : item.decision}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {canEdit ? (
        <section className="master-panel">
          <h2>Link an existing record</h2>
          <p className="admin-sub">
            Use this when a record here has a different name from DataHub, so the pull would add a duplicate.
            Link it to the DataHub code, then pull again.
          </p>
          <div className="admin-toolbar__tools">
            <select className="admin-input" value={link.entity} aria-label="Record type"
              onChange={(e) => setLink({ entity: e.target.value as Entity, localId: '', hubCode: link.hubCode })}>
              {ENTITIES.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
            </select>
            <select className="admin-input" value={link.localId} aria-label="Record"
              onChange={(e) => setLink({ ...link, localId: e.target.value })}>
              <option value="">Choose a record</option>
              {localOptions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
            <input className="admin-input" placeholder="Hub code, e.g. ORG-0007" value={link.hubCode}
              onChange={(e) => setLink({ ...link, hubCode: e.target.value })} aria-label="Hub code" />
            <button type="button" className="btn btn--secondary" disabled={busy !== null || !link.localId || !link.hubCode.trim()}
              onClick={() => void doLink()}>Link</button>
          </div>
        </section>
      ) : null}

      <section className="master-panel">
        <h2>Recent runs</h2>
        <div className="master-table-wrap">
          <table className="master-table">
            <thead><tr><th>Run</th><th>Type</th><th>Status</th><th>New</th><th>Changed</th><th>Applied</th><th>Started</th><th /></tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>#{r.id}</td><td>{r.entityType}</td><td>{r.status}</td>
                  <td>{r.newCount}</td><td>{r.changedCount}</td><td>{r.appliedCount}</td>
                  <td>{new Date(r.startedAt).toLocaleString()}</td>
                  <td><button type="button" className="btn-text" onClick={() => void openRun(r.id)}>Open</button></td>
                </tr>
              ))}
              {runs.length === 0 ? <tr><td colSpan={8}>No runs yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
