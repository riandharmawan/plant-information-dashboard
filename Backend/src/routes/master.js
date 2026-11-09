import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../access.js'

const router = Router()
router.use(requireAuth)

// Company, Site and Plant as stored in the database. DataHub fills these through the admin sync.
router.get('/org', async (_req, res, next) => {
  try {
    const [companies, sites, plants] = await Promise.all([
      query(`SELECT id, code, name, short_name, country, hub_code, is_active, is_activated FROM companies ORDER BY name`),
      query(`SELECT id, company_id, name, timezone, address, hub_code, is_active, is_activated FROM sites ORDER BY name`),
      query(`SELECT id, site_id, name, hub_code, is_active FROM plants ORDER BY name`),
    ])
    res.json({
      companies: companies.rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        shortName: row.short_name,
        country: row.country,
        hubCode: row.hub_code,
        isActive: row.is_active !== false,
        isActivated: row.is_activated === true,
      })),
      sites: sites.rows.map((row) => ({
        id: row.id,
        companyId: row.company_id,
        name: row.name,
        timezone: row.timezone,
        address: row.address,
        hubCode: row.hub_code,
        isActive: row.is_active !== false,
        isActivated: row.is_activated === true,
      })),
      plants: plants.rows.map((row) => ({
        id: row.id,
        siteId: row.site_id,
        name: row.name,
        hubCode: row.hub_code,
        isActive: row.is_active !== false,
      })),
    })
  } catch (error) {
    next(error)
  }
})

// Switch a company or site on or off for this application.
// A site needs its company on. A company with a site that is on cannot be switched off.
async function setActivation(req, res, next) {
  try {
    const { entityType, id, activated } = req.body ?? {}
    if (!['company', 'site'].includes(entityType) || !id || typeof activated !== 'boolean') {
      return res.status(400).json({ error: 'invalid_request' })
    }
    const page = entityType === 'company' ? 'master-companies' : 'master-sites'
    if (!req.sessionUser?.permissions?.[page]?.edit) return res.status(403).json({ error: 'forbidden' })

    if (entityType === 'site') {
      const site = await query('SELECT s.id, c.is_activated AS company_on FROM sites s JOIN companies c ON c.id = s.company_id WHERE s.id = $1', [id])
      if (site.rows.length === 0) return res.status(404).json({ error: 'not_found' })
      if (activated && !site.rows[0].company_on) return res.status(409).json({ error: 'company_not_activated' })
      await query('UPDATE sites SET is_activated = $2, updated_at = NOW() WHERE id = $1', [id, activated])
    } else {
      const company = await query('SELECT id FROM companies WHERE id = $1', [id])
      if (company.rows.length === 0) return res.status(404).json({ error: 'not_found' })
      if (!activated) {
        const open = await query('SELECT 1 FROM sites WHERE company_id = $1 AND is_activated LIMIT 1', [id])
        if (open.rows.length) return res.status(409).json({ error: 'company_has_active_sites' })
      }
      await query('UPDATE companies SET is_activated = $2, updated_at = NOW() WHERE id = $1', [id, activated])
    }
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
}

router.put('/org/activation', setActivation)

// Timezone is local to this application. DataHub has no timezone field.
router.put('/org/sites/:id', async (req, res, next) => {
  try {
    if (!req.sessionUser?.permissions?.['master-sites']?.edit) return res.status(403).json({ error: 'forbidden' })
    const timezone = String(req.body?.timezone ?? '').trim()
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone })
    } catch {
      return res.status(400).json({ error: 'invalid_timezone' })
    }
    const result = await query('UPDATE sites SET timezone = $2, updated_at = NOW() WHERE id = $1 RETURNING id', [req.params.id, timezone])
    if (result.rows.length === 0) return res.status(404).json({ error: 'not_found' })
    res.json({ ok: true, timezone })
  } catch (error) {
    next(error)
  }
})

export default router
