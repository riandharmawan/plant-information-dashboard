import { query } from '../db.js'

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function normalizeHubUserId(hubUserId) {
  const value = typeof hubUserId === 'string' ? hubUserId.trim() : ''
  if (!value || value.length > 128) return ''
  return value
}

export async function resolveHubUser({ hubUserId, email, requireVerifiedEmail, emailVerified }) {
  const hubId = normalizeHubUserId(hubUserId)
  const normalizedEmail = normalizeEmail(email)
  if (!hubId) return { error: 'missing_user_id' }

  const byHub = await query(
    `SELECT id, is_active
     FROM users
     WHERE hub_user_id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [hubId],
  )
  if (byHub.rows[0]) {
    if (byHub.rows[0].is_active === false) return { error: 'inactive_user' }
    return { userId: Number(byHub.rows[0].id) }
  }

  if (!normalizedEmail) return { error: 'missing_email_claim' }

  const byEmail = await query(
    `SELECT id, is_active, hub_user_id
     FROM users
     WHERE LOWER(email) = $1 AND deleted_at IS NULL`,
    [normalizedEmail],
  )
  if (byEmail.rows.length !== 1) return { error: 'no_linked_sso_user' }

  const row = byEmail.rows[0]
  if (row.is_active === false) return { error: 'inactive_user' }
  if (row.hub_user_id && row.hub_user_id !== hubId) return { error: 'oidc_sub_collision' }
  if (requireVerifiedEmail && emailVerified !== true) return { error: 'email_not_verified' }

  try {
    const updated = await query(
      `UPDATE users
       SET hub_user_id = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL AND hub_user_id IS NULL
       RETURNING id`,
      [hubId, row.id],
    )
    if (!updated.rows[0]) return { error: 'oidc_sub_collision' }
  } catch (error) {
    if (error.code === '23505') return { error: 'oidc_sub_collision' }
    throw error
  }

  return { userId: Number(row.id) }
}
