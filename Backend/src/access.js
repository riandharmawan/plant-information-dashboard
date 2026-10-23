import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from './db.js'

export const PAGE_KEYS = [
  'live-ops',
  'ops-analytics',
  'qc',
  'daily-production',
  'refinery-fractionation',
  'utility',
  'coverage',
  'master-companies',
  'master-sites',
  'master-plants',
  'master-commodities',
  'master-calibration',
  'master-tanks',
  'master-logsheets',
  'master-quality-rules',
  'admin-users',
  'admin-roles',
]

const COOKIE = 'pid_session'

function secret() {
  const value = process.env.JWT_SECRET
  if (!value) throw new Error('JWT_SECRET is not set')
  return value
}

function flags(row) {
  return {
    view: row.can_view === true,
    edit: row.can_edit === true,
    delete: row.can_delete === true,
  }
}

export async function loadSession(userId) {
  const user = await query(
    `SELECT id, username, display_name, email, is_active
     FROM users
     WHERE id = $1 AND deleted_at IS NULL`,
    [userId],
  )
  const row = user.rows[0]
  if (!row || row.is_active === false) return null

  const sites = await query(
    `SELECT s.id, s.name, s.timezone
     FROM user_sites us
     JOIN sites s ON s.id = us.site_id
     WHERE us.user_id = $1
     ORDER BY s.name`,
    [row.id],
  )
  const rights = await query(
    `SELECT p.resource_key,
            BOOL_OR(rp.can_view) AS can_view,
            BOOL_OR(rp.can_edit) AS can_edit,
            BOOL_OR(rp.can_delete) AS can_delete
     FROM user_roles ur
     JOIN role_permissions rp ON rp.role_id = ur.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = $1
     GROUP BY p.resource_key`,
    [row.id],
  )
  const permissions = {}
  for (const right of rights.rows) permissions[right.resource_key] = flags(right)

  return {
    id: Number(row.id),
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    sites: sites.rows.map((site) => ({ id: site.id, name: site.name, timezone: site.timezone })),
    permissions,
  }
}

export function signSession(res, userId) {
  const token = jwt.sign({ sub: userId }, secret(), { expiresIn: process.env.JWT_EXPIRES_IN || '8h' })
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  })
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { path: '/' })
}

export async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE]
  if (!token) return res.status(401).json({ error: 'unauthenticated' })
  try {
    const payload = jwt.verify(token, secret())
    const user = await loadSession(payload.sub)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })
    req.sessionUser = user
    next()
  } catch {
    return res.status(401).json({ error: 'unauthenticated' })
  }
}

export function requirePermission(page, action) {
  return (req, res, next) => {
    const permission = req.sessionUser?.permissions?.[page]
    if (!permission?.[action]) return res.status(403).json({ error: 'forbidden' })
    next()
  }
}

export function requireAny(checks) {
  return (req, res, next) => {
    const allowed = checks.some(([page, action]) => req.sessionUser?.permissions?.[page]?.[action])
    if (!allowed) return res.status(403).json({ error: 'forbidden' })
    next()
  }
}

export async function verifyPassword(usernameOrEmail, password) {
  const result = await query(
    `SELECT id, password_hash, is_active, deleted_at
     FROM users
     WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
     LIMIT 1`,
    [usernameOrEmail.trim()],
  )
  const row = result.rows[0]
  if (!row || row.deleted_at || row.is_active === false) return null
  const match = await bcrypt.compare(String(password), row.password_hash)
  if (!match) return null
  return Number(row.id)
}

export function hashPassword(password) {
  return bcrypt.hash(String(password), 10)
}
