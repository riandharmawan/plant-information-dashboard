import { Router } from 'express'
import { requireAuth, requirePermission } from '../access.js'
import { loadProductionDays } from '../productionReport.js'

const router = Router()

function allowedSite(req, res) {
  const siteId = req.params.siteId
  if (!req.sessionUser.sites.some((site) => site.id === siteId)) {
    res.status(403).json({ error: 'forbidden' })
    return false
  }
  return true
}

router.get('/sites/:siteId/production', requireAuth, requirePermission('daily-production', 'view'), async (req, res, next) => {
  try {
    if (!allowedSite(req, res)) return
    const days = await loadProductionDays(req.params.siteId)
    res.json({ days })
  } catch (error) {
    next(error)
  }
})

export default router
