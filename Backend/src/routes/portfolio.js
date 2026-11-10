/**
 * The management Stock Overview. One call returns every site the user holds with the Tank farm module on,
 * built from the same tank rows Live Ops shows. Needs the management-stock right, not Live Ops, so a
 * management role does not have to be given the operational pages.
 */
import { Router } from 'express'
import { requireAuth, requirePermission } from '../access.js'
import { NEAR_FULL, summarisePortfolio, summariseSite } from '../domain/portfolio.js'
import { loadSiteTanks, loadTankHistory, siteOf } from './operations.js'

const router = Router()

router.use('/portfolio', requireAuth, requirePermission('management-stock', 'view'))

function dayBefore(day) {
  if (!day) return null
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

/** The sites this user may see here: held by them, and with the Tank farm module on. */
function visibleSites(user) {
  return (user.sites ?? []).filter((site) => site.modules?.includes('live-ops'))
}

router.get('/portfolio/stock', async (req, res, next) => {
  try {
    const nearFull = NEAR_FULL
    const held = visibleSites(req.sessionUser)
    const settled = await Promise.all(
      held.map(async (held) => {
        try {
          const site = await siteOf(held.id)
          if (!site) return null
          const current = await loadSiteTanks(site)
          const before = current.day ? await loadSiteTanks(site, dayBefore(current.day)) : null
          return summariseSite(
            { id: site.id, name: site.name, companyName: site.company_name, timezone: site.timezone },
            current.tanks,
            { day: current.day, live: current.live, previous: before?.tanks ?? null, nearFull },
          )
        } catch (error) {
          console.error(`portfolio: site ${held.id} failed`, error)
          return { id: held.id, name: held.name, error: true }
        }
      }),
    )
    const sites = settled.filter((site) => site && !site.error).sort((a, b) => b.quantityKg - a.quantityKg)
    const failed = settled.filter((site) => site?.error).map((site) => ({ id: site.id, name: site.name }))
    res.json({ generatedAt: new Date().toISOString(), portfolio: summarisePortfolio(sites, nearFull), sites, failed })
  } catch (error) {
    next(error)
  }
})

router.get('/portfolio/sites/:siteId/tanks/:tankId/history', async (req, res, next) => {
  try {
    if (!visibleSites(req.sessionUser).some((site) => site.id === req.params.siteId)) {
      return res.status(403).json({ error: 'forbidden' })
    }
    const points = await loadTankHistory(req.params.siteId, req.params.tankId)
    res.json(
      points.map((point) => ({
        recordedOn: point.recordedOn,
        roundIndex: point.roundIndex,
        quantityKg: point.massKg,
        capacityKg: point.capacityKg,
        fillRatio: point.massKg != null && point.capacityKg ? point.massKg / point.capacityKg : null,
        levelM: point.soundingLevelM,
        temperatureC: point.temperatureC,
      })),
    )
  } catch (error) {
    next(error)
  }
})

export default router
