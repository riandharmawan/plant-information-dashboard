import { Router } from 'express'
import { query } from '../db.js'
import { clearSession, hashPassword, loadSession, requireAuth, signSession, verifyPassword } from '../access.js'

const router = Router()

router.post('/login', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim()
    const password = String(req.body?.password ?? '')
    if (!username || !password) return res.status(400).json({ error: 'invalid_credentials' })
    const userId = await verifyPassword(username, password)
    if (!userId) return res.status(401).json({ error: 'invalid_credentials' })
    signSession(res, userId)
    res.json(await loadSession(userId))
  } catch (error) {
    next(error)
  }
})

router.post('/logout', (req, res) => {
  clearSession(res)
  res.status(204).end()
})

router.get('/me', requireAuth, (req, res) => {
  res.json(req.sessionUser)
})

router.put('/password', requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword ?? '')
    const newPassword = String(req.body?.newPassword ?? '')
    if (!currentPassword) return res.status(400).json({ error: 'current_password_required' })
    if (!newPassword) return res.status(400).json({ error: 'new_password_required' })
    if (newPassword.length < 6) return res.status(400).json({ error: 'password_short' })
    if (newPassword === currentPassword) return res.status(400).json({ error: 'same_password' })

    const row = await query(
      `SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL AND is_active = TRUE`,
      [req.sessionUser.id],
    )
    if (!row.rows[0]) return res.status(401).json({ error: 'unauthenticated' })
    const userId = await verifyPassword(req.sessionUser.username, currentPassword)
    if (!userId) return res.status(401).json({ error: 'bad_current_password' })

    await query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [await hashPassword(newPassword), req.sessionUser.id],
    )
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

export default router
