import { Router } from 'express'
import { pool, query } from '../db.js'
import { PAGE_KEYS, hashPassword, requireAny, requireAuth, requirePermission } from '../access.js'

const router = Router()

router.use(requireAuth)

function numId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function clean(value) {
  const text = String(value ?? '').trim()
  return text || null
}

async function isLastActiveAdmin(userId) {
  const result = await query(
    `SELECT u.id
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE r.name = 'Administrator'
       AND r.is_system_role = TRUE
       AND u.is_active = TRUE
       AND u.deleted_at IS NULL`,
  )
  const ids = result.rows.map((row) => Number(row.id))
  return ids.length === 1 && ids[0] === Number(userId)
}

async function replaceRoles(client, userId, roleIds) {
  await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId])
  for (const roleId of roleIds) {
    await client.query(
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
      [userId, roleId],
    )
  }
}

async function replaceSites(client, userId, siteIds, actorSiteIds) {
  const existing = await client.query('SELECT site_id FROM user_sites WHERE user_id = $1', [userId])
  const actor = new Set(actorSiteIds)
  const preserved = existing.rows.map((row) => row.site_id).filter((id) => !actor.has(id))
  const granted = siteIds.filter((id) => actor.has(id))
  const next = [...new Set([...preserved, ...granted])]
  await client.query('DELETE FROM user_sites WHERE user_id = $1', [userId])
  for (const siteId of next) {
    await client.query('INSERT INTO user_sites (user_id, site_id) VALUES ($1, $2)', [userId, siteId])
  }
  return next.length
}

const userSelect = `
  SELECT u.id, u.username, u.display_name, u.email, u.is_active,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', r.id, 'name', r.name, 'isSystemRole', r.is_system_role
      ) ORDER BY r.name)
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = u.id
    ), '[]'::json) AS roles,
    COALESCE((
      SELECT json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY s.name)
      FROM user_sites us
      JOIN sites s ON s.id = us.site_id
      WHERE us.user_id = u.id
    ), '[]'::json) AS sites
  FROM users u
`

function presentUser(row) {
  return {
    id: Number(row.id),
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    isActive: row.is_active !== false,
    roles: row.roles ?? [],
    sites: row.sites ?? [],
  }
}

router.get('/sites', requirePermission('admin-users', 'view'), async (req, res, next) => {
  try {
    const ids = req.sessionUser.sites.map((site) => site.id)
    if (ids.length === 0) return res.json([])
    const result = await query(
      `SELECT id, name, timezone FROM sites WHERE id = ANY($1::text[]) ORDER BY name`,
      [ids],
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
})

router.get('/roles', requireAny([['admin-roles', 'view'], ['admin-users', 'view']]), async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT r.id, r.name, r.description, r.is_system_role,
              (
                SELECT COUNT(*)::int
                FROM user_roles ur
                JOIN users u ON u.id = ur.user_id AND u.deleted_at IS NULL
                WHERE ur.role_id = r.id
              ) AS user_count
       FROM roles r
       ORDER BY r.is_system_role DESC, r.name`,
    )
    res.json(result.rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      description: row.description,
      isSystemRole: row.is_system_role === true,
      userCount: row.user_count,
    })))
  } catch (error) {
    next(error)
  }
})

router.get('/permissions', requirePermission('admin-roles', 'view'), async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT resource_key FROM permissions WHERE resource_type = 'page'`,
    )
    const have = new Set(result.rows.map((row) => row.resource_key))
    res.json(PAGE_KEYS.filter((key) => have.has(key)))
  } catch (error) {
    next(error)
  }
})

router.get('/roles/:id', requirePermission('admin-roles', 'view'), async (req, res, next) => {
  try {
    const id = numId(req.params.id)
    if (!id) return res.status(400).json({ error: 'not_found' })
    const role = await query(
      `SELECT id, name, description, is_system_role FROM roles WHERE id = $1`,
      [id],
    )
    if (!role.rows[0]) return res.status(404).json({ error: 'not_found' })
    const rights = await query(
      `SELECT p.resource_key, rp.can_view, rp.can_edit, rp.can_delete
       FROM permissions p
       LEFT JOIN role_permissions rp ON rp.permission_id = p.id AND rp.role_id = $1
       WHERE p.resource_type = 'page'`,
      [id],
    )
    const byKey = new Map(rights.rows.map((row) => [row.resource_key, row]))
    res.json({
      id: Number(role.rows[0].id),
      name: role.rows[0].name,
      description: role.rows[0].description,
      isSystemRole: role.rows[0].is_system_role === true,
      permissions: PAGE_KEYS.filter((key) => byKey.has(key)).map((key) => {
        const row = byKey.get(key)
        return {
          resourceKey: key,
          view: row.can_view === true,
          edit: row.can_edit === true,
          delete: row.can_delete === true,
        }
      }),
    })
  } catch (error) {
    next(error)
  }
})

async function saveRolePermissions(client, roleId, permissions) {
  const catalog = await client.query(
    `SELECT id, resource_key FROM permissions WHERE resource_type = 'page'`,
  )
  const byKey = new Map(catalog.rows.map((row) => [row.resource_key, row.id]))
  await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId])
  for (const entry of permissions) {
    const permissionId = byKey.get(entry.resourceKey)
    if (!permissionId) continue
    const view = entry.view === true || entry.edit === true || entry.delete === true
    const edit = entry.edit === true
    const canDelete = entry.delete === true
    if (!view && !edit && !canDelete) continue
    await client.query(
      `INSERT INTO role_permissions (role_id, permission_id, can_view, can_edit, can_delete)
       VALUES ($1, $2, $3, $4, $5)`,
      [roleId, permissionId, view, edit, canDelete],
    )
  }
}

router.post('/roles', requirePermission('admin-roles', 'edit'), async (req, res, next) => {
  const client = await pool.connect()
  try {
    const name = clean(req.body?.name)
    if (!name) return res.status(400).json({ error: 'role_name_required' })
    await client.query('BEGIN')
    const created = await client.query(
      `INSERT INTO roles (name, description, is_system_role) VALUES ($1, $2, FALSE) RETURNING id`,
      [name, clean(req.body?.description)],
    )
    await saveRolePermissions(client, created.rows[0].id, Array.isArray(req.body?.permissions) ? req.body.permissions : [])
    await client.query('COMMIT')
    res.status(201).json({ id: Number(created.rows[0].id) })
  } catch (error) {
    await client.query('ROLLBACK')
    if (error.code === '23505') return res.status(409).json({ error: 'role_name_taken' })
    next(error)
  } finally {
    client.release()
  }
})

router.put('/roles/:id', requirePermission('admin-roles', 'edit'), async (req, res, next) => {
  const client = await pool.connect()
  try {
    const id = numId(req.params.id)
    if (!id) return res.status(400).json({ error: 'not_found' })
    const name = clean(req.body?.name)
    if (!name) return res.status(400).json({ error: 'role_name_required' })
    const current = await client.query('SELECT is_system_role, name FROM roles WHERE id = $1', [id])
    if (!current.rows[0]) return res.status(404).json({ error: 'not_found' })
    const nextName = current.rows[0].is_system_role ? current.rows[0].name : name
    await client.query('BEGIN')
    await client.query(
      `UPDATE roles SET name = $1, description = $2, updated_at = NOW() WHERE id = $3`,
      [nextName, clean(req.body?.description), id],
    )
    await saveRolePermissions(client, id, Array.isArray(req.body?.permissions) ? req.body.permissions : [])
    await client.query('COMMIT')
    res.json({ id })
  } catch (error) {
    await client.query('ROLLBACK')
    if (error.code === '23505') return res.status(409).json({ error: 'role_name_taken' })
    next(error)
  } finally {
    client.release()
  }
})

router.delete('/roles/:id', requirePermission('admin-roles', 'delete'), async (req, res, next) => {
  try {
    const id = numId(req.params.id)
    if (!id) return res.status(400).json({ error: 'not_found' })
    const role = await query('SELECT is_system_role FROM roles WHERE id = $1', [id])
    if (!role.rows[0]) return res.status(404).json({ error: 'not_found' })
    if (role.rows[0].is_system_role) return res.status(409).json({ error: 'system_role' })
    const used = await query(
      `SELECT 1
       FROM user_roles ur
       JOIN users u ON u.id = ur.user_id AND u.deleted_at IS NULL
       WHERE ur.role_id = $1
       LIMIT 1`,
      [id],
    )
    if (used.rows[0]) return res.status(409).json({ error: 'role_in_use' })
    await query('DELETE FROM roles WHERE id = $1', [id])
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

router.get('/users', requirePermission('admin-users', 'view'), async (_req, res, next) => {
  try {
    const result = await query(`${userSelect} WHERE u.deleted_at IS NULL ORDER BY LOWER(COALESCE(u.display_name, u.username))`)
    res.json(result.rows.map(presentUser))
  } catch (error) {
    next(error)
  }
})

router.get('/users/:id', requirePermission('admin-users', 'view'), async (req, res, next) => {
  try {
    const id = numId(req.params.id)
    if (!id) return res.status(400).json({ error: 'not_found' })
    const result = await query(`${userSelect} WHERE u.id = $1 AND u.deleted_at IS NULL`, [id])
    if (!result.rows[0]) return res.status(404).json({ error: 'not_found' })
    res.json(presentUser(result.rows[0]))
  } catch (error) {
    next(error)
  }
})

async function roleIdsExist(client, roleIds) {
  if (roleIds.length === 0) return true
  const found = await client.query('SELECT id FROM roles WHERE id = ANY($1::bigint[])', [roleIds])
  return found.rows.length === roleIds.length
}

router.post('/users', requirePermission('admin-users', 'edit'), async (req, res, next) => {
  const client = await pool.connect()
  try {
    const username = clean(req.body?.username)
    const password = String(req.body?.password ?? '')
    if (!username) return res.status(400).json({ error: 'username_required' })
    if (!password) return res.status(400).json({ error: 'password_required' })
    if (password.length < 6) return res.status(400).json({ error: 'password_short' })
    const roleIds = [...new Set((req.body?.roleIds ?? []).map(numId).filter(Boolean))]
    const siteIds = [...new Set((req.body?.siteIds ?? []).map((id) => String(id)))]
    await client.query('BEGIN')
    if (!(await roleIdsExist(client, roleIds))) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'not_found' })
    }
    const created = await client.query(
      `INSERT INTO users (username, display_name, email, password_hash, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [username, clean(req.body?.displayName), clean(req.body?.email), await hashPassword(password), req.body?.isActive !== false],
    )
    const userId = created.rows[0].id
    await replaceRoles(client, userId, roleIds)
    const siteCount = await replaceSites(client, userId, siteIds, req.sessionUser.sites.map((site) => site.id))
    await client.query('COMMIT')
    res.status(201).json({ id: Number(userId), siteCount })
  } catch (error) {
    await client.query('ROLLBACK')
    if (error.code === '23505') {
      const constraint = String(error.constraint ?? '')
      return res.status(409).json({ error: constraint.includes('email') ? 'email_taken' : 'username_taken' })
    }
    next(error)
  } finally {
    client.release()
  }
})

router.put('/users/:id', requirePermission('admin-users', 'edit'), async (req, res, next) => {
  const client = await pool.connect()
  try {
    const id = numId(req.params.id)
    if (!id) return res.status(400).json({ error: 'not_found' })
    const current = await client.query(
      'SELECT id, is_active FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id],
    )
    if (!current.rows[0]) return res.status(404).json({ error: 'not_found' })
    const isActive = req.body?.isActive !== false
    if (!isActive && id === req.sessionUser.id) return res.status(400).json({ error: 'self_deactivate' })
    if (!isActive && current.rows[0].is_active && await isLastActiveAdmin(id)) {
      return res.status(409).json({ error: 'last_admin' })
    }
    const password = String(req.body?.password ?? '')
    if (password && password.length < 6) return res.status(400).json({ error: 'password_short' })
    const roleIds = [...new Set((req.body?.roleIds ?? []).map(numId).filter(Boolean))]
    const siteIds = [...new Set((req.body?.siteIds ?? []).map((siteId) => String(siteId)))]
    await client.query('BEGIN')
    if (!(await roleIdsExist(client, roleIds))) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'not_found' })
    }
    await client.query(
      `UPDATE users
       SET display_name = $1, email = $2, is_active = $3, updated_at = NOW()
       WHERE id = $4`,
      [clean(req.body?.displayName), clean(req.body?.email), isActive, id],
    )
    if (password) {
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [await hashPassword(password), id],
      )
    }
    await replaceRoles(client, id, roleIds)
    const siteCount = await replaceSites(client, id, siteIds, req.sessionUser.sites.map((site) => site.id))
    await client.query('COMMIT')
    res.json({ id, siteCount })
  } catch (error) {
    await client.query('ROLLBACK')
    if (error.code === '23505') return res.status(409).json({ error: 'email_taken' })
    next(error)
  } finally {
    client.release()
  }
})

router.delete('/users/:id', requirePermission('admin-users', 'delete'), async (req, res, next) => {
  const client = await pool.connect()
  try {
    const id = numId(req.params.id)
    if (!id) return res.status(400).json({ error: 'not_found' })
    if (id === req.sessionUser.id) return res.status(400).json({ error: 'self_delete' })
    const current = await client.query(
      'SELECT id, is_active FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id],
    )
    if (!current.rows[0]) return res.status(404).json({ error: 'not_found' })
    if (current.rows[0].is_active && await isLastActiveAdmin(id)) {
      return res.status(409).json({ error: 'last_admin' })
    }
    await client.query('BEGIN')
    await client.query('DELETE FROM user_roles WHERE user_id = $1', [id])
    await client.query('DELETE FROM user_sites WHERE user_id = $1', [id])
    await client.query(
      'UPDATE users SET deleted_at = NOW(), is_active = FALSE, updated_at = NOW() WHERE id = $1',
      [id],
    )
    await client.query('COMMIT')
    res.status(204).end()
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

export default router
