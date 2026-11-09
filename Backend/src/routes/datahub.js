import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth, requirePermission } from '../access.js'
import { fetchEntityCatalog, clearTokenCache, ENTITY_SLUGS } from '../datahub/client.js'
import { getConfigForAdmin, getEffectiveConfig, recordSyncHealth, saveConfig } from '../datahub/config.js'
import { applyRun, linkLocalRow, pullAndStage } from '../datahub/sync.js'

// The structure stops at the site. Plant sync still exists in the sync module but is not offered.
const ENTITY_TYPES = ['company', 'site']

const router = Router()
router.use(requireAuth)

const view = requirePermission('admin-datahub', 'view')
const edit = requirePermission('admin-datahub', 'edit')

function toRun(row) {
  return {
    id: Number(row.id),
    entityType: row.entity_type,
    status: row.status,
    hubRecordCount: Number(row.hub_record_count),
    newCount: Number(row.new_count),
    changedCount: Number(row.changed_count),
    unchangedCount: Number(row.unchanged_count),
    appliedCount: Number(row.applied_count),
    error: row.error,
    startedAt: row.started_at,
    appliedAt: row.applied_at,
  }
}

function toItem(row) {
  const payload = row.payload || {}
  return {
    id: Number(row.id),
    localId: row.local_id,
    hubCode: row.hub_code,
    label: row.label,
    diffKind: row.diff_kind,
    decision: row.decision,
    fieldDiff: row.field_diff ?? {},
    parentMissing: payload.parentMissing === true,
    appliedAt: row.applied_at,
    applyError: row.apply_error,
  }
}

function failure(error) {
  const status = Number(error?.status)
  const message = error?.message || 'DataHub request failed'
  if (status === 403 || /not permitted to call/i.test(message)) {
    return {
      httpStatus: 403,
      error: message,
      hint: 'DataHub has not allowlisted this entity for the PID application key. Ask the DataHub integrator to enable it, then retry.',
    }
  }
  return { httpStatus: 502, error: message, hint: null }
}

router.get('/config', view, async (_req, res, next) => {
  try {
    res.json(await getConfigForAdmin(pool))
  } catch (error) {
    next(error)
  }
})

router.put('/config', edit, async (req, res, next) => {
  try {
    await saveConfig(pool, req.body ?? {}, req.sessionUser.id)
    clearTokenCache()
    res.json(await getConfigForAdmin(pool))
  } catch (error) {
    if (/required|valid URL|http or https/.test(error?.message ?? '')) {
      return res.status(400).json({ error: error.message })
    }
    next(error)
  }
})

// Connection test: reads the field list of each entity. Shows which ones the key may call.
router.post('/test', edit, async (_req, res, next) => {
  try {
    const cfg = await getEffectiveConfig(pool)
    if (!cfg.enabled || !cfg.baseUrl || !cfg.publicKey || !cfg.privateKey) {
      return res.status(400).json({ error: 'DataHub is not configured.' })
    }
    const results = {}
    for (const entity of ENTITY_TYPES) {
      let last = null
      for (const slug of ENTITY_SLUGS[entity]) {
        try {
          const catalog = await fetchEntityCatalog(cfg, slug)
          results[entity] = { ok: true, slug, fieldKeys: catalog.fieldKeys }
          last = null
          break
        } catch (error) {
          last = { ok: false, slug, error: error.message, status: error.status ?? null }
          if (Number(error?.status) !== 404) break
        }
      }
      if (last) results[entity] = last
    }
    res.json({ results })
  } catch (error) {
    next(error)
  }
})

router.get('/runs', view, async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 20, 50))
    const entity = ENTITY_TYPES.includes(req.query.entityType) ? req.query.entityType : null
    const r = await pool.query(
      `SELECT * FROM datahub_sync_runs
       WHERE ($1::text IS NULL OR entity_type = $1)
       ORDER BY started_at DESC LIMIT $2`,
      [entity, limit],
    )
    res.json(r.rows.map(toRun))
  } catch (error) {
    next(error)
  }
})

router.post('/runs', edit, async (req, res, next) => {
  const entity = req.body?.entityType
  if (!ENTITY_TYPES.includes(entity)) return res.status(400).json({ error: 'entityType must be company or site' })
  const cfg = await getEffectiveConfig(pool)
  if (!cfg.enabled || !cfg.baseUrl) return res.status(400).json({ error: 'DataHub is not configured.' })
  if (!cfg.publicKey || !cfg.privateKey) return res.status(400).json({ error: 'DataHub key pair is not configured.' })
  try {
    const { runId, summary } = await pullAndStage(pool, cfg, entity, { createdBy: req.sessionUser.id })
    await recordSyncHealth(pool, true)
    if (runId == null) return res.status(201).json({ run: null, summary, noChanges: true })
    const row = await pool.query('SELECT * FROM datahub_sync_runs WHERE id = $1', [runId])
    res.status(201).json({ run: toRun(row.rows[0]), summary })
  } catch (error) {
    if (error?.status === undefined && !/DataHub/.test(error?.message ?? '')) return next(error)
    await recordSyncHealth(pool, false, error?.message).catch(() => {})
    const { httpStatus, error: message, hint } = failure(error)
    res.status(httpStatus).json({ error: message, hint })
  }
})

router.get('/runs/:id(\\d+)', view, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    const run = await pool.query('SELECT * FROM datahub_sync_runs WHERE id = $1', [id])
    if (run.rows.length === 0) return res.status(404).json({ error: 'Sync run not found' })
    const items = await pool.query(
      `SELECT * FROM datahub_sync_items WHERE run_id = $1
       ORDER BY CASE diff_kind WHEN 'changed' THEN 0 WHEN 'new' THEN 1 ELSE 2 END, label`,
      [id],
    )
    res.json({ run: toRun(run.rows[0]), items: items.rows.map(toItem) })
  } catch (error) {
    next(error)
  }
})

router.patch('/runs/:id(\\d+)/items', edit, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    const decisions = Array.isArray(req.body?.decisions) ? req.body.decisions : null
    if (!decisions) return res.status(400).json({ error: 'decisions must be an array' })
    const run = await pool.query('SELECT status FROM datahub_sync_runs WHERE id = $1', [id])
    if (run.rows.length === 0) return res.status(404).json({ error: 'Sync run not found' })
    if (run.rows[0].status !== 'staged') return res.status(409).json({ error: `Sync run is already ${run.rows[0].status}` })
    for (const d of decisions) {
      const itemId = parseInt(d?.itemId, 10)
      if (!Number.isFinite(itemId) || !['approved', 'rejected'].includes(d?.decision)) continue
      await pool.query('UPDATE datahub_sync_items SET decision = $1 WHERE run_id = $2 AND id = $3', [d.decision, id, itemId])
    }
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

router.post('/runs/:id(\\d+)/apply', edit, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    const result = await applyRun(pool, id, req.sessionUser.id)
    if (result.notFound) return res.status(404).json({ error: 'Sync run not found' })
    if (result.conflict) return res.status(409).json({ error: `Sync run is already ${result.conflict}` })
    res.json({ ok: true, runId: id, ...result })
  } catch (error) {
    next(error)
  }
})

router.post('/runs/:id(\\d+)/discard', edit, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    const r = await pool.query(
      `UPDATE datahub_sync_runs SET status = 'discarded' WHERE id = $1 AND status = 'staged' RETURNING id`,
      [id],
    )
    if (r.rows.length === 0) return res.status(409).json({ error: 'Sync run is not staged' })
    res.json({ ok: true, runId: id })
  } catch (error) {
    next(error)
  }
})

// Link a local row to a hub code by hand, then run the sync again to see the field differences.
router.post('/link', edit, async (req, res, next) => {
  try {
    const { entityType, localId, hubCode } = req.body ?? {}
    if (!ENTITY_TYPES.includes(entityType)) return res.status(400).json({ error: 'entityType must be company or site' })
    res.json(await linkLocalRow(pool, entityType, localId, hubCode))
  } catch (error) {
    if ([400, 404, 409].includes(error?.status)) return res.status(error.status).json({ error: error.message })
    next(error)
  }
})

export default router
