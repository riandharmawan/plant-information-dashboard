/**
 * DataHub client configuration. The database row wins, then DHM_* environment.
 * The private key is encrypted at rest and never returned by the admin API.
 */
import crypto from 'node:crypto'
import { trimBaseUrl } from './client.js'

function encryptionKey() {
  const secret = process.env.DATAHUB_SECRET_KEY || process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  return crypto.createHash('sha256').update(secret).digest()
}

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const body = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString('base64')).join('.')
}

export function decryptSecret(payload) {
  const [iv, tag, body] = String(payload).split('.').map((part) => Buffer.from(part, 'base64'))
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
}

export function normalizeBaseUrl(raw) {
  const base = trimBaseUrl(raw)
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

async function loadRow(db) {
  const r = await db.query('SELECT * FROM datahub_config WHERE id = 1')
  return r.rows[0] ?? null
}

function envConfig() {
  const baseUrl = trimBaseUrl(process.env.DHM_BASE_URL)
  if (!baseUrl) return null
  return {
    source: 'environment',
    baseUrl,
    publicKey: String(process.env.DHM_PUBLIC_KEY || '').trim() || null,
    privateKey: String(process.env.DHM_PRIVATE_KEY || '').trim() || null,
    enabled: true,
  }
}

/** Credentials for server-side calls. Never send this to the browser. */
export async function getEffectiveConfig(db) {
  const row = await loadRow(db)
  if (row?.enabled && row.base_url) {
    let privateKey = null
    if (row.private_key_encrypted) {
      try {
        privateKey = decryptSecret(row.private_key_encrypted)
      } catch {
        privateKey = null
      }
    }
    return {
      source: 'database',
      baseUrl: trimBaseUrl(row.base_url),
      publicKey: row.public_key || null,
      privateKey,
      enabled: true,
    }
  }
  return envConfig() ?? { source: 'none', enabled: false, baseUrl: null, publicKey: null, privateKey: null }
}

export async function getConfigForAdmin(db) {
  const row = await loadRow(db)
  const env = envConfig()
  const effective = await getEffectiveConfig(db)
  return {
    baseUrl: row?.base_url || env?.baseUrl || '',
    publicKey: row?.public_key || env?.publicKey || '',
    enabled: Boolean(row?.enabled),
    privateKeyConfigured: Boolean(row?.private_key_encrypted) || Boolean(env?.privateKey),
    source: effective.source,
    lastSyncAt: row?.last_sync_at ?? null,
    lastSyncOk: row?.last_sync_ok ?? null,
    lastError: row?.last_error ?? null,
  }
}

/** A blank privateKey keeps the stored one. */
export async function saveConfig(db, input, userId) {
  const row = await loadRow(db)
  const baseUrl = input.baseUrl != null ? normalizeBaseUrl(input.baseUrl) : row?.base_url ?? null
  const publicKey = input.publicKey != null ? String(input.publicKey).trim() || null : row?.public_key ?? null
  const enabled = input.enabled != null ? Boolean(input.enabled) : row?.enabled ?? false
  let privateKeyEncrypted = row?.private_key_encrypted ?? null
  if (input.privateKey != null && String(input.privateKey).trim()) {
    privateKeyEncrypted = encryptSecret(String(input.privateKey).trim())
  }
  if (enabled && (!baseUrl || !publicKey || !privateKeyEncrypted)) {
    throw new Error('baseUrl, publicKey and privateKey are required to enable DataHub')
  }
  await db.query(
    `UPDATE datahub_config
     SET base_url = $1, public_key = $2, private_key_encrypted = $3, enabled = $4,
         updated_at = NOW(), updated_by = $5
     WHERE id = 1`,
    [baseUrl, publicKey, privateKeyEncrypted, enabled, userId ?? null],
  )
}

export async function recordSyncHealth(db, ok, error) {
  await db.query(
    `UPDATE datahub_config
     SET last_sync_at = NOW(), last_sync_ok = $1, last_error = $2, updated_at = NOW()
     WHERE id = 1`,
    [Boolean(ok), ok ? null : String(error || 'sync failed').slice(0, 2000)],
  )
}
