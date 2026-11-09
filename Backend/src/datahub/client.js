/**
 * DataHub (DHM) read client for Company, Site and Plant.
 *
 * Reads use the local replica pattern: GET /v1/sync/{slug}, page by page.
 * Auth prefers the short-lived app token, because some proxies drop the
 * X-DHM-* key headers. Builds without /auth/token fall back to the key pair.
 */

const DEFAULT_TIMEOUT_MS = 10_000
export const SYNC_PAGE_LIMIT = 500
const MAX_PAGES = 100

/** Local entity -> DataHub slugs to try, in order. */
export const ENTITY_SLUGS = {
  company: ['company', 'organization'],
  site: ['site'],
  plant: ['plant'],
}

function timeoutMs() {
  const n = parseInt(process.env.DHM_TIMEOUT_MS || '', 10)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS
}

function str(value) {
  if (value == null) return null
  const text = String(value).trim()
  return text === '' ? null : text
}

export function trimBaseUrl(raw) {
  return String(raw || '').trim().replace(/\/+$/, '')
}

export function parseExpiresInSeconds(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
  const m = /^\s*(\d+(?:\.\d+)?)\s*([smhd])?\s*$/i.exec(String(raw ?? ''))
  if (!m) return 3600
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return 3600
  const unit = (m[2] || 's').toLowerCase()
  return n * (unit === 'd' ? 86400 : unit === 'h' ? 3600 : unit === 'm' ? 60 : 1)
}

export function looksLikeHtml(res, text) {
  const type = String(res?.headers?.get?.('content-type') ?? '')
  if (/text\/html/i.test(type)) return true
  return /^\s*(?:<!doctype\s+html|<html[\s>])/i.test(String(text ?? ''))
}

async function fetchJson(url, headers, fetchImpl = fetch, init = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs())
  let res
  try {
    res = await fetchImpl(url, { ...init, headers, signal: ctrl.signal })
  } catch (error) {
    if (error?.name === 'AbortError') {
      const err = new Error(`DataHub request timed out after ${timeoutMs()}ms`)
      err.status = 0
      throw err
    }
    throw error
  } finally {
    clearTimeout(timer)
  }

  const text = await res.text()
  if (looksLikeHtml(res, text)) {
    const err = new Error(
      `DataHub returned a web page (HTTP ${res.status}), not JSON. The base URL looks like the portal instead of the /v1 API host.`,
    )
    err.status = res.status
    throw err
  }
  if (!res.ok) {
    let message = text.slice(0, 300)
    try {
      const parsed = JSON.parse(text)
      message = parsed.message || parsed.error || message
    } catch {
      /* keep the raw snippet */
    }
    const err = new Error(`DataHub HTTP ${res.status}: ${message}`)
    err.status = res.status
    throw err
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('DataHub returned a non-JSON response')
  }
}

function keyPairHeaders(cfg) {
  const publicKey = str(cfg?.publicKey)
  const privateKey = str(cfg?.privateKey)
  if (!publicKey || !privateKey) throw new Error('DataHub public and private keys are required')
  return { Accept: 'application/json', 'X-DHM-Public-Key': publicKey, 'X-DHM-Private-Key': privateKey }
}

const tokenCache = new Map()
const SKEW_MS = 60_000

export function clearTokenCache() {
  tokenCache.clear()
}

export async function fetchAppToken(cfg, fetchImpl = fetch) {
  const publicKey = str(cfg?.publicKey)
  const privateKey = str(cfg?.privateKey)
  if (!publicKey || !privateKey) throw new Error('DataHub public and private keys are required')
  const body = await fetchJson(
    `${cfg.baseUrl}/auth/token`,
    { Accept: 'application/json', 'Content-Type': 'application/json' },
    fetchImpl,
    { method: 'POST', body: JSON.stringify({ publicKey, privateKey }) },
  )
  const token = str(body?.token)
  if (!token) throw new Error('DataHub did not return an app token')
  return { token, expiresInSeconds: parseExpiresInSeconds(body?.expiresIn) }
}

export async function resolveAuthHeaders(cfg, fetchImpl = fetch) {
  const cacheKey = `${cfg.baseUrl}|${str(cfg.publicKey)}`
  const hit = tokenCache.get(cacheKey)
  if (hit && hit.expiresAt > Date.now() + SKEW_MS) {
    return { Accept: 'application/json', Authorization: `Bearer ${hit.token}` }
  }
  try {
    const { token, expiresInSeconds } = await fetchAppToken(cfg, fetchImpl)
    tokenCache.set(cacheKey, { token, expiresAt: Date.now() + expiresInSeconds * 1000 })
    return { Accept: 'application/json', Authorization: `Bearer ${token}` }
  } catch (error) {
    if (Number(error?.status) === 404) return keyPairHeaders(cfg)
    throw error
  }
}

/** A reference field is a UUID or code string, or an object that carries one. */
export function referenceOf(raw) {
  if (raw == null) return null
  if (typeof raw === 'object') return str(raw.id ?? raw.recordId ?? raw.code)
  return str(raw)
}

function envelope(record, values, parent) {
  const data = record?.data && typeof record.data === 'object' ? record.data : {}
  return {
    hubCode: str(data.code),
    hubRecordId: str(record.id),
    hubVersion: Number.isFinite(Number(record.version)) ? Number(record.version) : null,
    hubUpdatedAt: record.updatedAt ?? null,
    isDeleted: record.isDeleted === true,
    parentRef: parent ?? null,
    values,
  }
}

function activeFlag(data) {
  return !(data.is_active === false || data.isActive === false)
}

export function normalizeCompany(record) {
  const data = record?.data && typeof record.data === 'object' ? record.data : null
  const name = str(data?.name ?? data?.Name)
  if (!name) return null
  return envelope(record, {
    name,
    short_name: str(data.short_name ?? data.shortName ?? data.Short_Name),
    company_code_sap: str(
      data.company_code_sap ?? data.companyCodeSap ?? data.Company_Code_SAP ?? data.sap_code ?? data.sapCode,
    ),
    country: str(data.country ?? data.Country),
    is_active: activeFlag(data),
  })
}

export function normalizeSite(record) {
  const data = record?.data && typeof record.data === 'object' ? record.data : null
  const name = str(data?.name ?? data?.Name)
  if (!name) return null
  return envelope(
    record,
    { name, address: str(data.address), is_active: activeFlag(data) },
    referenceOf(data.organization_id ?? data.organizationId ?? data.company_id ?? data.companyId),
  )
}

export function normalizePlant(record) {
  const data = record?.data && typeof record.data === 'object' ? record.data : null
  const name = str(data?.name ?? data?.Name)
  if (!name) return null
  return envelope(record, { name, is_active: activeFlag(data) }, referenceOf(data.site_id ?? data.siteId))
}

export const NORMALIZERS = { company: normalizeCompany, site: normalizeSite, plant: normalizePlant }

export function parseSyncPage(body, normalize) {
  const records = Array.isArray(body?.records) ? body.records : []
  return {
    records: records.map(normalize).filter(Boolean),
    hasMore: body?.hasMore === true,
    nextCursor: body?.nextCursor ? String(body.nextCursor) : null,
  }
}

export async function fetchAllSyncRecords(cfg, slug, normalize, fetchImpl = fetch) {
  const headers = await resolveAuthHeaders(cfg, fetchImpl)
  const out = []
  let url = `${cfg.baseUrl}/v1/sync/${encodeURIComponent(slug)}?limit=${SYNC_PAGE_LIMIT}`
  let pages = 0
  while (url && pages < MAX_PAGES) {
    const page = parseSyncPage(await fetchJson(url, headers, fetchImpl), normalize)
    out.push(...page.records)
    pages += 1
    url =
      page.hasMore && page.nextCursor
        ? `${cfg.baseUrl}/v1/sync/${encodeURIComponent(slug)}?cursor=${encodeURIComponent(page.nextCursor)}`
        : null
  }
  return out
}

/** Full snapshot for one local entity. Company tries the portal slug, then the documented one. */
export async function fetchEntityRecords(cfg, entityType, fetchImpl = fetch) {
  const slugs = ENTITY_SLUGS[entityType]
  const normalize = NORMALIZERS[entityType]
  if (!slugs) throw new Error(`Unknown entity type: ${entityType}`)
  let lastError
  for (const slug of slugs) {
    try {
      return await fetchAllSyncRecords(cfg, slug, normalize, fetchImpl)
    } catch (error) {
      lastError = error
      if (Number(error?.status) === 404) continue
      throw error
    }
  }
  throw lastError
}

/** Connection test: field list of one catalog entity. Also proves the key is allowlisted for it. */
export async function fetchEntityCatalog(cfg, slug, fetchImpl = fetch) {
  const body = await fetchJson(
    `${cfg.baseUrl}/v1/catalog/${encodeURIComponent(slug)}`,
    await resolveAuthHeaders(cfg, fetchImpl),
    fetchImpl,
  )
  const fields = Array.isArray(body?.fields) ? body.fields : []
  return { slug: body?.slug ?? slug, name: body?.name ?? null, fieldKeys: fields.map((f) => f?.key).filter(Boolean) }
}
