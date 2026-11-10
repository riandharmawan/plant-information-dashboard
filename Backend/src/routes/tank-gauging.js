import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth, requirePermission } from '../access.js'
import { fetchTankMeta, parseTankMetaResponse, trimBaseUrl } from '../tankgauging/client.js'
import { runTankGaugingPoll } from '../tankgauging/poll.js'
import { loadRoundSettings, saveRoundSettings } from '../tankgauging/rounds.js'
import {
  createSource,
  deleteSource,
  getSource,
  listSources,
  sourceWithAuth,
  updateSource,
} from '../tankgauging/sources.js'

const router = Router()
router.use(requireAuth)

const view = requirePermission('master-tanks', 'view')
const edit = requirePermission('master-tanks', 'edit')

/** The Administrator may use any activated site. Anyone else only the sites they hold. */
async function siteAllowed(req, siteId) {
  const site = await pool.query('SELECT s.id, s.name, s.timezone FROM sites s WHERE s.id = $1 AND s.is_activated', [siteId])
  if (!site.rows[0]) return null
  if (req.sessionUser.isAdministrator === true) return site.rows[0]
  return req.sessionUser.sites.some((s) => s.id === siteId) ? site.rows[0] : null
}

async function withSite(req, res, next) {
  const site = await siteAllowed(req, req.params.siteId)
  if (!site) return res.status(404).json({ error: 'not_found' })
  req.site = site
  next()
}

/** Turn a validation failure or a duplicate into a clean answer. Anything else is left for the error handler. */
function bad(res, error) {
  if (error?.code === '23505') return res.status(409).json({ error: 'source_exists' })
  if (Number(error?.status) === 400) return res.status(400).json({ error: error.message })
  if (/required|valid URL|http or https|must be|at least one|between/i.test(error?.message ?? '')) {
    return res.status(400).json({ error: error.message })
  }
  return null
}

router.get('/sites/:siteId/overview', view, withSite, async (req, res, next) => {
  try {
    const siteId = req.site.id
    const [sources, settings, tanks] = await Promise.all([
      listSources(pool, siteId),
      loadRoundSettings(pool, siteId),
      pool.query(
        `SELECT t.id, t.code, t.name, t.sort_order, l.source_unit_name, l.source_base_url, l.product_name,
                l.level_mm, l.temperature_c, l.total_mass, l.observed_density_kg_m3, l.total_observed_volume,
                l.status_text, l.recorded_at, l.fetched_at, t.stock_group, i.max_capacity_litre, i.tank_state
         FROM tanks t
         JOIN plants pl ON pl.id = t.plant_id
         LEFT JOIN tank_gauging_latest l ON l.tank_id = t.id
         LEFT JOIN tank_gauging_info i ON i.tank_id = t.id
         WHERE pl.site_id = $1 AND t.source = 'atg'
         ORDER BY t.sort_order, t.code`,
        [siteId],
      ),
    ])
    res.json({
      site: { id: req.site.id, name: req.site.name, timezone: req.site.timezone },
      sources,
      settings,
      tanks: tanks.rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        unitName: row.source_unit_name,
        sourceBaseUrl: row.source_base_url,
        productName: row.product_name,
        levelMm: row.level_mm == null ? null : Number(row.level_mm),
        temperatureC: row.temperature_c == null ? null : Number(row.temperature_c),
        totalMassTon: row.total_mass == null ? null : Number(row.total_mass),
        densityKgM3: row.observed_density_kg_m3 == null ? null : Number(row.observed_density_kg_m3),
        statusText: row.status_text,
        recordedAt: row.recorded_at,
        fetchedAt: row.fetched_at,
        capacityLitre: row.max_capacity_litre == null ? null : Number(row.max_capacity_litre),
        tankState: row.tank_state,
        stockGroup: row.stock_group,
      })),
    })
  } catch (error) {
    next(error)
  }
})

router.post('/sites/:siteId/sources', edit, withSite, async (req, res, next) => {
  try {
    res.status(201).json(await createSource(pool, req.site.id, req.body ?? {}, req.sessionUser.id))
  } catch (error) {
    if (!bad(res, error)) next(error)
  }
})

async function ownSource(req, res, next) {
  const row = await getSource(pool, parseInt(req.params.id, 10))
  if (!row) return res.status(404).json({ error: 'not_found' })
  if (!(await siteAllowed(req, row.site_id))) return res.status(404).json({ error: 'not_found' })
  req.sourceRow = row
  next()
}

router.put('/sources/:id(\\d+)', edit, ownSource, async (req, res, next) => {
  try {
    res.json(await updateSource(pool, req.sourceRow.id, req.body ?? {}, req.sessionUser.id))
  } catch (error) {
    if (!bad(res, error)) next(error)
  }
})

router.delete('/sources/:id(\\d+)', edit, ownSource, async (req, res, next) => {
  try {
    await deleteSource(pool, req.sourceRow.id)
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

// Reads the tank list only, as Jetty Planning System does. Scheduled polling stays with cron.
router.post('/sources/:id(\\d+)/test', edit, ownSource, async (req, res, next) => {
  try {
    const source = await sourceWithAuth(pool, req.sourceRow.id)
    const started = Date.now()
    try {
      const meta = await fetchTankMeta({ baseUrl: trimBaseUrl(source.baseUrl), auth: source.auth })
      const parsed = parseTankMetaResponse(meta.text)
      const tankCount = parsed.units.reduce((n, unit) => n + unit.tanks.length, 0)
      res.json({
        ok: meta.ok && tankCount > 0,
        httpStatus: meta.status,
        ms: Date.now() - started,
        controller: parsed.controllerName,
        units: parsed.units.map((unit) => ({ name: unit.name, tanks: unit.tanks.length })),
        tankCount,
        error: meta.ok ? (tankCount > 0 ? null : 'The reply had no tanks') : `HTTP ${meta.status}`,
      })
    } catch (error) {
      res.json({ ok: false, ms: Date.now() - started, tankCount: 0, units: [], error: error?.message || 'Could not connect' })
    }
  } catch (error) {
    next(error)
  }
})

router.put('/sites/:siteId/settings', edit, withSite, async (req, res, next) => {
  try {
    res.json(await saveRoundSettings(pool, req.site.id, req.body ?? {}, req.sessionUser.id))
  } catch (error) {
    if (!bad(res, error)) next(error)
  }
})

// One poll and the rounds, on demand. The 15 minute schedule is cron.
router.post('/sites/:siteId/poll', edit, withSite, async (req, res, next) => {
  try {
    res.json(await runTankGaugingPoll(pool, { siteId: req.site.id }))
  } catch (error) {
    next(error)
  }
})

export default router
