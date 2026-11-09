import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../access.js'

const router = Router()
router.use(requireAuth)

// Company, Site and Plant as stored in the database. DataHub fills these through the admin sync.
router.get('/org', async (_req, res, next) => {
  try {
    const [companies, sites, plants] = await Promise.all([
      query(`SELECT id, code, name, short_name, country, hub_code, is_active FROM companies ORDER BY name`),
      query(`SELECT id, company_id, name, timezone, address, hub_code, is_active FROM sites ORDER BY name`),
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
      })),
      sites: sites.rows.map((row) => ({
        id: row.id,
        companyId: row.company_id,
        name: row.name,
        timezone: row.timezone,
        address: row.address,
        hubCode: row.hub_code,
        isActive: row.is_active !== false,
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

export default router
