/**
 * Gauge system hosts per site. Credentials are encrypted at rest and never returned to the browser.
 */
import { decryptSecret, encryptSecret } from '../datahub/config.js'
import { trimBaseUrl } from './client.js'

export const AUTH_TYPES = new Set(['none', 'basic', 'cookie'])

export function normalizeSourceUrl(raw) {
  const base = trimBaseUrl(raw).replace(/\/index\.esp$/i, '')
  if (!base) throw new Error('baseUrl is required')
  let url
  try {
    url = new URL(base)
  } catch {
    throw new Error('baseUrl must be a valid URL')
  }
  if (!/^https?:$/i.test(url.protocol)) throw new Error('baseUrl must be http or https')
  return trimBaseUrl(url.origin + url.pathname)
}

function authFromRow(row) {
  const type = AUTH_TYPES.has(row?.auth_type) ? row.auth_type : 'none'
  if (type === 'none') return { type: 'none', user: null, secret: null }
  let secret = ''
  if (row.auth_secret_encrypted) {
    try {
      secret = decryptSecret(row.auth_secret_encrypted)
    } catch {
      secret = ''
    }
  }
  return { type, user: row.auth_user || null, secret: secret || null }
}

export function toAdminDto(row) {
  return {
    id: Number(row.id),
    siteId: row.site_id,
    baseUrl: row.base_url,
    label: row.label,
    enabled: row.enabled === true,
    authType: row.auth_type,
    authUser: row.auth_user,
    secretConfigured: Boolean(row.auth_secret_encrypted),
    lastPollAt: row.last_poll_at,
    lastPollOk: row.last_poll_ok,
    lastError: row.last_error,
  }
}

export async function listSources(db, siteId) {
  const r = await db.query('SELECT * FROM tank_gauging_sources WHERE site_id = $1 ORDER BY label NULLS LAST, id', [siteId])
  return r.rows.map(toAdminDto)
}

/** Enabled sources with their credentials, for the poller. */
export async function resolveEnabledSources(db, { siteId } = {}) {
  const r = await db.query(
    `SELECT * FROM tank_gauging_sources WHERE enabled AND ($1::text IS NULL OR site_id = $1) ORDER BY site_id, id`,
    [siteId ?? null],
  )
  return r.rows.map((row) => ({ id: Number(row.id), siteId: row.site_id, baseUrl: row.base_url, label: row.label, auth: authFromRow(row) }))
}

export async function getSource(db, id) {
  const r = await db.query('SELECT * FROM tank_gauging_sources WHERE id = $1', [id])
  return r.rows[0] ?? null
}

export async function sourceWithAuth(db, id) {
  const row = await getSource(db, id)
  return row ? { id: Number(row.id), siteId: row.site_id, baseUrl: row.base_url, auth: authFromRow(row) } : null
}

function checkAuth(type, user, secretGiven, hadSecret) {
  if (!AUTH_TYPES.has(type)) throw new Error('authType must be none, basic or cookie')
  if (type === 'basic' && !user) throw new Error('A user name is required for basic authentication')
  if ((type === 'basic' || type === 'cookie') && !secretGiven && !hadSecret) {
    throw new Error('A password or cookie is required for this authentication type')
  }
}

export async function createSource(db, siteId, input, userId) {
  const baseUrl = normalizeSourceUrl(input.baseUrl)
  const type = input.authType ?? 'none'
  const secret = input.secret != null && String(input.secret).trim() ? String(input.secret).trim() : null
  checkAuth(type, input.authUser ? String(input.authUser).trim() : null, secret, false)
  const r = await db.query(
    `INSERT INTO tank_gauging_sources (site_id, base_url, label, enabled, auth_type, auth_user, auth_secret_encrypted, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      siteId,
      baseUrl,
      input.label ? String(input.label).trim() : null,
      input.enabled !== false,
      type,
      type === 'none' ? null : input.authUser ? String(input.authUser).trim() : null,
      type === 'none' || !secret ? null : encryptSecret(secret),
      userId ?? null,
    ],
  )
  return toAdminDto(r.rows[0])
}

/** A blank secret keeps the stored one. */
export async function updateSource(db, id, input, userId) {
  const row = await getSource(db, id)
  if (!row) return null
  const baseUrl = input.baseUrl != null ? normalizeSourceUrl(input.baseUrl) : row.base_url
  const type = input.authType ?? row.auth_type
  const user = type === 'none' ? null : input.authUser != null ? String(input.authUser).trim() || null : row.auth_user
  const secretGiven = input.secret != null && String(input.secret).trim() ? String(input.secret).trim() : null
  checkAuth(type, user, secretGiven, Boolean(row.auth_secret_encrypted))
  const secretEncrypted = type === 'none' ? null : secretGiven ? encryptSecret(secretGiven) : row.auth_secret_encrypted
  const r = await db.query(
    `UPDATE tank_gauging_sources
     SET base_url = $2, label = $3, enabled = $4, auth_type = $5, auth_user = $6, auth_secret_encrypted = $7,
         updated_at = NOW(), updated_by = $8
     WHERE id = $1 RETURNING *`,
    [
      id,
      baseUrl,
      input.label != null ? String(input.label).trim() || null : row.label,
      input.enabled != null ? Boolean(input.enabled) : row.enabled,
      type,
      user,
      secretEncrypted,
      userId ?? null,
    ],
  )
  return toAdminDto(r.rows[0])
}

/** Removes the host and its tank links. The tanks and their history stay. */
export async function deleteSource(db, id) {
  const row = await getSource(db, id)
  if (!row) return false
  await db.query('DELETE FROM tank_gauging_tank_map WHERE site_id = $1 AND source_base_url = $2', [row.site_id, row.base_url])
  await db.query('DELETE FROM tank_gauging_sources WHERE id = $1', [id])
  return true
}

export async function updateSourcePollHealth(db, id, { ok, error }) {
  if (id == null) return
  await db.query(
    `UPDATE tank_gauging_sources SET last_poll_at = NOW(), last_poll_ok = $2, last_error = $3 WHERE id = $1`,
    [id, Boolean(ok), ok ? null : String(error || 'poll failed').slice(0, 1000)],
  )
}
