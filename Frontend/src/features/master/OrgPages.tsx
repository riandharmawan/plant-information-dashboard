import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ChevronDown, ChevronUp, MapPin, Search, X } from 'lucide-react'
import { useAuth } from '../../data/AuthContext.tsx'
import { useMaster } from '../../data/MasterContext.tsx'
import type { CompanyRecord, SiteRecord } from '../../domain/master.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'

type Filter = 'all' | 'on' | 'off' | 'hubOff'

const TIMEZONES: Array<{ value: string; label: string }> = [
  { value: 'Asia/Jakarta', label: 'Asia/Jakarta · WIB (UTC+7)' },
  { value: 'Asia/Makassar', label: 'Asia/Makassar · WITA (UTC+8)' },
  { value: 'Asia/Jayapura', label: 'Asia/Jayapura · WIT (UTC+9)' },
  { value: 'Asia/Kuala_Lumpur', label: 'Asia/Kuala_Lumpur (UTC+8)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (UTC+8)' },
]

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template)
}

function initials(name: string): string {
  const parts = name.replace(/^PT\.?\s+/i, '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function matches(needle: string, ...parts: Array<string | null | undefined>): boolean {
  return !needle || parts.filter(Boolean).join(' ').toLowerCase().includes(needle)
}

/** A switch for "in use". Shows a busy state while the change is being saved. */
function UseSwitch({
  on,
  label,
  disabled,
  title,
  onChange,
}: {
  on: boolean
  label: string
  disabled?: boolean
  title?: string
  onChange: (next: boolean) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={title}
      disabled={disabled || busy}
      className={`um-toggle${on ? ' um-toggle--on' : ''}${busy ? ' um-toggle--busy' : ''}`}
      onClick={async (event) => {
        event.stopPropagation()
        setBusy(true)
        try {
          await onChange(!on)
        } finally {
          setBusy(false)
        }
      }}
    >
      <span className="um-toggle__knob" />
    </button>
  )
}

function useBanners() {
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  return { notice, setNotice, error, setError }
}

function Banners({
  notice,
  error,
  clear,
}: {
  notice: string | null
  error: string | null
  clear: () => void
}) {
  const { t } = useLocale()
  return (
    <>
      {notice ? (
        <div className="um-banner um-banner--ok" role="status">
          <span>{notice}</span>
          <button type="button" className="um-icon-btn" aria-label={t.close} onClick={clear}><X size={14} /></button>
        </div>
      ) : null}
      {error ? (
        <div className="um-banner um-banner--error" role="alert">
          <span>{error}</span>
          <button type="button" className="um-icon-btn" aria-label={t.close} onClick={clear}><X size={14} /></button>
        </div>
      ) : null}
    </>
  )
}

function SortHead({ label, active, dir, onClick }: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void }) {
  return (
    <th aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="um-sort" onClick={onClick}>
        {label}
        {active ? (dir === 'asc' ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />) : null}
      </button>
    </th>
  )
}

function Tiles({ filter, setFilter, counts }: { filter: Filter; setFilter: (next: Filter) => void; counts: Record<Filter, number> }) {
  const { t } = useLocale()
  const tiles: Array<{ key: Filter; label: string; tone?: 'warn' }> = [
    { key: 'all', label: t.allLabel },
    { key: 'on', label: t.inUse },
    { key: 'off', label: t.notInUse },
    { key: 'hubOff', label: t.inactiveInDataHub, tone: 'warn' },
  ]
  return (
    <div className="um-tiles" role="group" aria-label={t.status}>
      {tiles.map((tile) => (
        <button
          key={tile.key}
          type="button"
          className={`um-tile${tile.tone === 'warn' ? ' um-tile--warn' : ''}${filter === tile.key ? ' um-tile--on' : ''}`}
          aria-pressed={filter === tile.key}
          onClick={() => setFilter(tile.key)}
        >
          <span className="um-tile__count">{counts[tile.key]}</span>
          <span className="um-tile__label">{tile.label}</span>
        </button>
      ))}
    </div>
  )
}

function Frame({
  title,
  blurb,
  tiles,
  banners,
  toolbar,
  children,
}: {
  title: string
  blurb: string
  tiles: ReactNode
  banners: ReactNode
  toolbar: ReactNode
  children: ReactNode
}) {
  const { t } = useLocale()
  const { can } = useAuth()
  return (
    <div className="page um">
      <Link className="master-back" to="/master">{t.backToMaster}</Link>
      <header className="um-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="um-subtitle">{blurb}</p>
        </div>
        {can('admin-datahub', 'view') ? (
          <Link className="btn btn--secondary um-add" to="/admin/datahub">{t.pullFromDataHub}</Link>
        ) : null}
      </header>
      {banners}
      {tiles}
      <section className="um-card">
        <div className="um-toolbar">{toolbar}</div>
        {children}
      </section>
    </div>
  )
}

function counted<T extends { isActivated?: boolean; isActive?: boolean }>(rows: T[]): Record<Filter, number> {
  return {
    all: rows.length,
    on: rows.filter((row) => row.isActivated).length,
    off: rows.filter((row) => !row.isActivated).length,
    hubOff: rows.filter((row) => row.isActive === false).length,
  }
}

function passes<T extends { isActivated?: boolean; isActive?: boolean }>(filter: Filter, row: T): boolean {
  if (filter === 'on') return row.isActivated === true
  if (filter === 'off') return row.isActivated !== true
  if (filter === 'hubOff') return row.isActive === false
  return true
}

function activationError(t: ReturnType<typeof useLocale>['t'], code: string): string {
  if (code === 'company_not_activated') return t.activationNeedsCompany
  if (code === 'company_has_active_sites') return t.activationHasSites
  if (code === 'forbidden') return t.accessDeniedBody
  return t.requestFailed
}

export function CompaniesPage() {
  const { t } = useLocale()
  const { can } = useAuth()
  const master = useMaster()
  const canEdit = can('master-companies', 'edit')
  const { notice, setNotice, error, setError } = useBanners()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sortKey, setSortKey] = useState<'name' | 'code' | 'use'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const companies = master.data.companies
  const sitesOf = (id: string) => master.data.sites.filter((site) => site.companyId === id)

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = companies.filter((row) => passes(filter, row) && matches(needle, row.name, row.code, row.hubCode))
    const value = (row: CompanyRecord) => (sortKey === 'code' ? row.hubCode ?? row.code : sortKey === 'use' ? (row.isActivated ? '1' : '0') : row.name)
    const sign = sortDir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => value(a).localeCompare(value(b), undefined, { numeric: true }) * sign)
  }, [companies, query, filter, sortKey, sortDir])

  const sortBy = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const toggle = async (row: CompanyRecord, next: boolean) => {
    setNotice(null)
    setError(null)
    const code = await master.setActivation('company', row.id, next)
    if (code) setError(activationError(t, code))
    else setNotice(fill(next ? t.activatedNotice : t.deactivatedNotice, { name: row.name }))
  }

  return (
    <Frame
      title={`${t.masterDash} ${t.company}`}
      blurb={t.companyBlurb}
      banners={<Banners notice={notice} error={error} clear={() => { setNotice(null); setError(null) }} />}
      tiles={<Tiles filter={filter} setFilter={setFilter} counts={counted(companies)} />}
      toolbar={(
        <>
          <label className="um-search">
            <Search size={16} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchCompanies} aria-label={t.searchCompanies} />
            {query ? <button type="button" className="um-icon-btn" aria-label={t.clearFilters} onClick={() => setQuery('')}><X size={14} /></button> : null}
          </label>
          <span className="um-count" aria-live="polite">{fill(t.companiesShown, { n: rows.length, total: companies.length })}</span>
        </>
      )}
    >
      {companies.length === 0 ? (
        <div className="um-empty"><p>{t.noCompaniesYet}</p></div>
      ) : rows.length === 0 ? (
        <div className="um-empty">
          <p>{t.noMatch}</p>
          <button type="button" className="btn btn--secondary" onClick={() => { setQuery(''); setFilter('all') }}>{t.clearFilters}</button>
        </div>
      ) : (
        <div className="um-table-wrap">
          <table className="um-table">
            <thead>
              <tr>
                <SortHead label={t.company} active={sortKey === 'name'} dir={sortDir} onClick={() => sortBy('name')} />
                <SortHead label={t.dataHubCode} active={sortKey === 'code'} dir={sortDir} onClick={() => sortBy('code')} />
                <th>{t.sites}</th>
                <SortHead label={t.inUse} active={sortKey === 'use'} dir={sortDir} onClick={() => sortBy('use')} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const sites = sitesOf(row.id)
                const used = sites.filter((site) => site.isActivated).length
                return (
                  <tr key={row.id} className={row.isActivated ? undefined : 'um-row--off'}>
                    <td>
                      <div className="um-user">
                        <span className="um-avatar um-avatar--role" aria-hidden="true">{initials(row.name) || <Building2 size={16} />}</span>
                        <span className="um-user__text">
                          <span className="um-user__name">
                            <strong>{row.name}</strong>
                            {row.isActive === false ? <span className="um-chip um-chip--warn">{t.inactiveInDataHub}</span> : null}
                          </span>
                          <span className="um-muted">{row.code}</span>
                        </span>
                      </div>
                    </td>
                    <td>{row.hubCode ? <span className="um-code um-code--chip">{row.hubCode}</span> : <span className="um-muted">{t.unavailable}</span>}</td>
                    <td>
                      {sites.length === 0 ? <span className="um-muted">—</span> : (
                        <span className={used > 0 ? 'um-chip um-chip--role' : 'um-chip um-chip--more'} title={sites.map((site) => site.name).join(', ')}>
                          {fill(t.sitesInUse, { n: used, total: sites.length })}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="um-use">
                        <UseSwitch
                          on={row.isActivated === true}
                          label={`${row.isActivated ? t.deactivate : t.activate} ${row.name}`}
                          disabled={!canEdit}
                          title={!canEdit ? t.accessDeniedBody : undefined}
                          onChange={(next) => toggle(row, next)}
                        />
                        <span className={row.isActivated ? 'um-use__text um-use__text--on' : 'um-use__text'}>{row.isActivated ? t.activated : t.notActivated}</span>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Frame>
  )
}

export function SitesPage() {
  const { t } = useLocale()
  const { can } = useAuth()
  const master = useMaster()
  const canEdit = can('master-sites', 'edit')
  const { notice, setNotice, error, setError } = useBanners()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [companyId, setCompanyId] = useState('')
  const [sortKey, setSortKey] = useState<'name' | 'company' | 'code' | 'use'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sites = master.data.sites
  const companyOf = (id: string) => master.data.companies.find((company) => company.id === id)

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = sites.filter((row) => {
      if (!passes(filter, row)) return false
      if (companyId && row.companyId !== companyId) return false
      const company = master.data.companies.find((item) => item.id === row.companyId)
      return matches(needle, row.name, row.hubCode, company?.name, company?.hubCode)
    })
    const value = (row: SiteRecord) => {
      if (sortKey === 'company') return master.data.companies.find((item) => item.id === row.companyId)?.name ?? ''
      if (sortKey === 'code') return row.hubCode ?? ''
      if (sortKey === 'use') return row.isActivated ? '1' : '0'
      return row.name
    }
    const sign = sortDir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => value(a).localeCompare(value(b), undefined, { numeric: true }) * sign)
  }, [sites, master.data.companies, query, filter, companyId, sortKey, sortDir])

  const sortBy = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const toggle = async (row: SiteRecord, next: boolean) => {
    setNotice(null)
    setError(null)
    const code = await master.setActivation('site', row.id, next)
    if (code) setError(activationError(t, code))
    else setNotice(fill(next ? t.activatedNotice : t.deactivatedNotice, { name: row.name }))
  }

  const changeZone = async (row: SiteRecord, timezone: string) => {
    setNotice(null)
    setError(null)
    const code = await master.setSiteTimezone(row.id, timezone)
    if (code) setError(code === 'invalid_timezone' ? t.invalidTimezone : activationError(t, code))
    else setNotice(fill(t.timezoneSaved, { name: row.name, zone: timezone }))
  }

  return (
    <Frame
      title={`${t.masterDash} ${t.site}`}
      blurb={t.siteBlurb}
      banners={<Banners notice={notice} error={error} clear={() => { setNotice(null); setError(null) }} />}
      tiles={<Tiles filter={filter} setFilter={setFilter} counts={counted(sites)} />}
      toolbar={(
        <>
          <label className="um-search">
            <Search size={16} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchSites} aria-label={t.searchSites} />
            {query ? <button type="button" className="um-icon-btn" aria-label={t.clearFilters} onClick={() => setQuery('')}><X size={14} /></button> : null}
          </label>
          <select className="um-select" value={companyId} onChange={(event) => setCompanyId(event.target.value)} aria-label={t.company}>
            <option value="">{t.allCompanies}</option>
            {master.data.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
          <span className="um-count" aria-live="polite">{fill(t.sitesShown, { n: rows.length, total: sites.length })}</span>
        </>
      )}
    >
      {sites.length === 0 ? (
        <div className="um-empty"><p>{t.noSitesYet}</p></div>
      ) : rows.length === 0 ? (
        <div className="um-empty">
          <p>{t.noMatch}</p>
          <button type="button" className="btn btn--secondary" onClick={() => { setQuery(''); setFilter('all'); setCompanyId('') }}>{t.clearFilters}</button>
        </div>
      ) : (
        <div className="um-table-wrap">
          <table className="um-table">
            <thead>
              <tr>
                <SortHead label={t.site} active={sortKey === 'name'} dir={sortDir} onClick={() => sortBy('name')} />
                <SortHead label={t.company} active={sortKey === 'company'} dir={sortDir} onClick={() => sortBy('company')} />
                <SortHead label={t.dataHubCode} active={sortKey === 'code'} dir={sortDir} onClick={() => sortBy('code')} />
                <th>{t.timezone}</th>
                <SortHead label={t.inUse} active={sortKey === 'use'} dir={sortDir} onClick={() => sortBy('use')} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const company = companyOf(row.companyId)
                const blocked = !row.isActivated && company?.isActivated !== true
                const zones = TIMEZONES.some((zone) => zone.value === row.timezone)
                  ? TIMEZONES
                  : [...TIMEZONES, { value: row.timezone, label: row.timezone }]
                return (
                  <tr key={row.id} className={row.isActivated ? undefined : 'um-row--off'}>
                    <td>
                      <div className="um-user">
                        <span className="um-avatar um-avatar--role" aria-hidden="true"><MapPin size={16} /></span>
                        <span className="um-user__text">
                          <span className="um-user__name">
                            <strong>{row.name}</strong>
                            {row.isActive === false ? <span className="um-chip um-chip--warn">{t.inactiveInDataHub}</span> : null}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="um-user__text">
                        <strong className="um-plain">{company?.name ?? t.unavailable}</strong>
                        {company?.hubCode ? <span className="um-code">{company.hubCode}</span> : null}
                      </span>
                    </td>
                    <td>{row.hubCode ? <span className="um-code um-code--chip">{row.hubCode}</span> : <span className="um-muted">{t.unavailable}</span>}</td>
                    <td>
                      {canEdit ? (
                        <select
                          className="um-select um-select--compact"
                          value={row.timezone}
                          aria-label={`${t.timezone} ${row.name}`}
                          onChange={(event) => void changeZone(row, event.target.value)}
                        >
                          {zones.map((zone) => <option key={zone.value} value={zone.value}>{zone.label}</option>)}
                        </select>
                      ) : row.timezone}
                    </td>
                    <td>
                      <span className="um-use">
                        <UseSwitch
                          on={row.isActivated === true}
                          label={`${row.isActivated ? t.deactivate : t.activate} ${row.name}`}
                          disabled={!canEdit || blocked}
                          title={blocked ? t.activationNeedsCompany : undefined}
                          onChange={(next) => toggle(row, next)}
                        />
                        <span className={row.isActivated ? 'um-use__text um-use__text--on' : 'um-use__text'}>{row.isActivated ? t.activated : t.notActivated}</span>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Frame>
  )
}
