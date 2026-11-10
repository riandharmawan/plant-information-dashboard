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
  'admin-datahub',
]

/** The modules a site can switch on. Master data and Administration are not site modules. */
export const SITE_MODULES = ['live-ops', 'qc', 'utility', 'daily-production']

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
    `SELECT s.id, s.name, s.timezone, s.hub_code AS site_code,
            c.name AS company_name, COALESCE(c.hub_code, c.code) AS company_code
     FROM user_sites us
     JOIN sites s ON s.id = us.site_id
     JOIN companies c ON c.id = s.company_id
     WHERE us.user_id = $1 AND s.is_activated
     ORDER BY c.name, s.name`,
    [row.id],
  )
  const modules = await query(
    `SELECT site_id, module_key FROM site_modules WHERE site_id = ANY($1::text[])`,
    [sites.rows.map((site) => site.id)],
  )
  const modulesBySite = new Map()
  for (const row of modules.rows) {
    if (!modulesBySite.has(row.site_id)) modulesBySite.set(row.site_id, [])
    modulesBySite.get(row.site_id).push(row.module_key)
  }
  const adminRole = await query(
    `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND r.name = 'Administrator' AND r.is_system_role = TRUE LIMIT 1`,
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
    sites: sites.rows.map((site) => ({
      id: site.id,
      name: site.name,
      timezone: site.timezone,
      siteCode: site.site_code,
      companyName: site.company_name,
      companyCode: site.company_code,
      modules: SITE_MODULES.filter((key) => modulesBySite.get(site.id)?.includes(key)),
    })),
    permissions,
    // The system Administrator may grant any activated site. Other users grant only their own.
    isAdministrator: adminRole.rows.length > 0,
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

/** The site in the URL must be one the signed-in user holds. Use after requireAuth. */
export function requireSiteAccess(req, res, next) {
  const siteId = req.params.siteId
  if (!req.sessionUser?.sites?.some((site) => site.id === siteId)) {
    return res.status(403).json({ error: 'forbidden' })
  }
  next()
}

/** The site in the URL must have this module switched on. Use after requireAuth and requireSiteAccess. */
export function requireSiteModule(moduleKey) {
  return (req, res, next) => {
    const site = req.sessionUser?.sites?.find((s) => s.id === req.params.siteId)
    if (!site?.modules?.includes(moduleKey)) return res.status(403).json({ error: 'module_not_enabled' })
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
