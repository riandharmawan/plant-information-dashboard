/**
 * Load a file made by export-gauge-data.js into this database. Safe to repeat.
 *
 *   node scripts/import-gauge-data.js backups/gauge-data.json            dry run: does everything, then rolls back
 *   node scripts/import-gauge-data.js backups/gauge-data.json --apply    saves it
 *
 * The sites must already exist here with the same ids (they come from DataHub). Everything runs in one
 * transaction. Rows already here are updated, never duplicated, so it can be run again after a poll.
 * User ids are not carried over. Gauge passwords are never in the file.
 * Reads DATABASE_URL from Backend/.env or the environment.
 */
import fs from 'node:fs'
import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config()

const file = process.argv[2]
const apply = process.argv.includes('--apply')
if (!file || !process.env.DATABASE_URL) {
  console.error('Usage: node scripts/import-gauge-data.js <file.json> [--apply]   (DATABASE_URL must be set)')
  process.exit(1)
}

const bundle = JSON.parse(fs.readFileSync(file, 'utf8'))
if (bundle.version !== 1) throw new Error(`Unsupported file version ${bundle.version}`)
const t = bundle.tables
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

// One statement per table. $1 is the table's rows as JSON.
const STEPS = [
  [
    'plants',
    `INSERT INTO plants (id, site_id, name, is_active)
     SELECT id, site_id, name, COALESCE(is_active, TRUE) FROM jsonb_populate_recordset(NULL::plants, $1::jsonb)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = EXCLUDED.is_active`,
  ],
  [
    'tanks',
    `INSERT INTO tanks (id, plant_id, code, name, sort_order, source, stock_group)
     SELECT id, plant_id, code, name, COALESCE(sort_order, 0), COALESCE(source, 'atg'), stock_group
     FROM jsonb_populate_recordset(NULL::tanks, $1::jsonb)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order,
       source = EXCLUDED.source, stock_group = EXCLUDED.stock_group, updated_at = NOW()`,
  ],
  [
    'tank_profiles',
    `INSERT INTO tank_profiles (tank_id, bottom_stock, dip_offset_mm, table_temp_c, ullage_lk_mm, ullage_lb_mm,
                               density_group, volume_approx, origin, capacity, capacity_unit)
     SELECT tank_id, bottom_stock, COALESCE(dip_offset_mm, 0), table_temp_c, ullage_lk_mm, ullage_lb_mm,
            density_group, COALESCE(volume_approx, FALSE), COALESCE(origin, 'seed'), capacity, COALESCE(capacity_unit, 'kg')
     FROM jsonb_populate_recordset(NULL::tank_profiles, $1::jsonb)
     ON CONFLICT (tank_id) DO UPDATE SET capacity = EXCLUDED.capacity, capacity_unit = EXCLUDED.capacity_unit,
       bottom_stock = EXCLUDED.bottom_stock, origin = EXCLUDED.origin`,
  ],
  [
    'tank_gauging_info',
    `INSERT INTO tank_gauging_info (tank_id, max_capacity_litre, tank_height_mm, tank_location, tank_state, roof_status, fetched_at, raw_payload)
     SELECT tank_id, max_capacity_litre, tank_height_mm, tank_location, tank_state, roof_status, fetched_at, raw_payload
     FROM jsonb_populate_recordset(NULL::tank_gauging_info, $1::jsonb)
     ON CONFLICT (tank_id) DO UPDATE SET max_capacity_litre = EXCLUDED.max_capacity_litre, tank_height_mm = EXCLUDED.tank_height_mm,
       tank_location = EXCLUDED.tank_location, tank_state = EXCLUDED.tank_state, roof_status = EXCLUDED.roof_status,
       fetched_at = EXCLUDED.fetched_at, raw_payload = EXCLUDED.raw_payload`,
  ],
  [
    'tank_gauging_tank_map',
    // The map is keyed twice (by gauge address and by tank), so rows for these tanks are replaced.
    // Two statements: a delete and an insert in one statement would still see the old rows.
    [
      `DELETE FROM tank_gauging_tank_map m
       USING jsonb_populate_recordset(NULL::tank_gauging_tank_map, $1::jsonb) i
       WHERE m.tank_id = i.tank_id
          OR (m.site_id = i.site_id AND m.source_base_url = i.source_base_url
              AND m.source_unit_name = i.source_unit_name AND m.external_tank_id = i.external_tank_id)`,
      `INSERT INTO tank_gauging_tank_map (site_id, source_base_url, source_unit_name, external_tank_id, tank_id)
       SELECT site_id, source_base_url, source_unit_name, external_tank_id, tank_id
       FROM jsonb_populate_recordset(NULL::tank_gauging_tank_map, $1::jsonb)`,
    ],
  ],
  [
    'tank_gauging_latest',
    `INSERT INTO tank_gauging_latest (tank_id, product_name, tank_comment, level_mm, temperature_c, observed_density_kg_m3,
                                      total_observed_volume, total_mass, flow_rate_tph, status_text, tank_status_code,
                                      level_movement, gauge_ref_height_mm, capacity, recorded_at, fetched_at, raw_payload,
                                      source, source_base_url, source_unit_name)
     SELECT tank_id, product_name, tank_comment, level_mm, temperature_c, observed_density_kg_m3,
            total_observed_volume, total_mass, flow_rate_tph, status_text, tank_status_code,
            level_movement, gauge_ref_height_mm, capacity, recorded_at, fetched_at, raw_payload,
            source, source_base_url, source_unit_name
     FROM jsonb_populate_recordset(NULL::tank_gauging_latest, $1::jsonb)
     ON CONFLICT (tank_id) DO UPDATE SET product_name = EXCLUDED.product_name, tank_comment = EXCLUDED.tank_comment,
       level_mm = EXCLUDED.level_mm, temperature_c = EXCLUDED.temperature_c, observed_density_kg_m3 = EXCLUDED.observed_density_kg_m3,
       total_observed_volume = EXCLUDED.total_observed_volume, total_mass = EXCLUDED.total_mass, flow_rate_tph = EXCLUDED.flow_rate_tph,
       status_text = EXCLUDED.status_text, tank_status_code = EXCLUDED.tank_status_code, level_movement = EXCLUDED.level_movement,
       gauge_ref_height_mm = EXCLUDED.gauge_ref_height_mm, capacity = EXCLUDED.capacity, recorded_at = EXCLUDED.recorded_at,
       fetched_at = EXCLUDED.fetched_at, raw_payload = EXCLUDED.raw_payload, source = EXCLUDED.source,
       source_base_url = EXCLUDED.source_base_url, source_unit_name = EXCLUDED.source_unit_name
     WHERE tank_gauging_latest.fetched_at IS NULL OR EXCLUDED.fetched_at >= tank_gauging_latest.fetched_at`,
  ],
  [
    'tank_gauging_samples',
    `INSERT INTO tank_gauging_samples (tank_id, source_base_url, product_name, tank_comment, total_mass, flow_rate_tph, level_mm,
                                      temperature_c, observed_density_kg_m3, total_observed_volume, status_text, sampled_at,
                                      raw_payload, archived_at)
     SELECT i.tank_id, i.source_base_url, i.product_name, i.tank_comment, i.total_mass, i.flow_rate_tph, i.level_mm,
            i.temperature_c, i.observed_density_kg_m3, i.total_observed_volume, i.status_text, i.sampled_at,
            i.raw_payload, i.archived_at
     FROM jsonb_populate_recordset(NULL::tank_gauging_samples, $1::jsonb) i
     WHERE NOT EXISTS (SELECT 1 FROM tank_gauging_samples s WHERE s.tank_id = i.tank_id AND s.sampled_at = i.sampled_at)`,
  ],
  [
    'tank_gauging_sources',
    `INSERT INTO tank_gauging_sources (site_id, base_url, label, enabled, auth_type)
     SELECT site_id, base_url, label, COALESCE(enabled, TRUE), 'none'
     FROM jsonb_populate_recordset(NULL::tank_gauging_sources, $1::jsonb)
     ON CONFLICT (site_id, base_url) DO UPDATE SET label = EXCLUDED.label, enabled = EXCLUDED.enabled, updated_at = NOW()`,
  ],
  [
    'tank_gauging_settings',
    `INSERT INTO tank_gauging_settings (site_id, round_times, round_tolerance_min)
     SELECT site_id, round_times, round_tolerance_min FROM jsonb_populate_recordset(NULL::tank_gauging_settings, $1::jsonb)
     ON CONFLICT (site_id) DO UPDATE SET round_times = EXCLUDED.round_times, round_tolerance_min = EXCLUDED.round_tolerance_min, updated_at = NOW()`,
  ],
  [
    'stock_groups',
    `INSERT INTO stock_groups (site_id, code, name, sort_order)
     SELECT site_id, code, name, COALESCE(sort_order, 0) FROM jsonb_populate_recordset(NULL::stock_groups, $1::jsonb)
     ON CONFLICT (site_id, code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order`,
  ],
  [
    'site_modules',
    `INSERT INTO site_modules (site_id, module_key)
     SELECT site_id, module_key FROM jsonb_populate_recordset(NULL::site_modules, $1::jsonb)
     ON CONFLICT DO NOTHING`,
  ],
  [
    'soundings',
    `INSERT INTO soundings (site_id, plant_id, tank_id, recorded_on, round_index, product_name, level_m, temperature_c,
                           operational_status, source, mass_kg, density_kg_m3, volume_litre, sampled_at)
     SELECT site_id, plant_id, tank_id, recorded_on, round_index, product_name, level_m, temperature_c,
            operational_status, source, mass_kg, density_kg_m3, volume_litre, sampled_at
     FROM jsonb_populate_recordset(NULL::soundings, $1::jsonb)
     ON CONFLICT (tank_id, recorded_on, round_index) DO NOTHING`,
  ],
]

const client = await pool.connect()
try {
  const sites = await client.query('SELECT id FROM sites WHERE id = ANY($1::text[])', [bundle.sites])
  const missing = bundle.sites.filter((id) => !sites.rows.some((row) => row.id === id))
  if (missing.length) {
    throw new Error(`These sites do not exist here: ${missing.join(', ')}. Run the DataHub sync, or check the site ids, first.`)
  }
  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${file}, exported ${bundle.exportedAt}, sites ${bundle.sites.join(', ')}`)

  await client.query('BEGIN')
  for (const [name, sql] of STEPS) {
    const list = t[name] ?? []
    if (list.length === 0) {
      console.log(`  ${name.padEnd(24)} 0 rows`)
      continue
    }
    let written = 0
    for (const statement of Array.isArray(sql) ? sql : [sql]) {
      written = (await client.query(statement, [JSON.stringify(list)])).rowCount
    }
    console.log(`  ${name.padEnd(24)} ${String(list.length).padStart(5)} in file, ${written} written`)
  }
  if (apply) {
    await client.query('COMMIT')
    console.log('Saved.')
  } else {
    await client.query('ROLLBACK')
    console.log('Rolled back. Nothing was saved. Add --apply to save.')
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => {})
  console.error(`Failed, nothing was saved: ${error.message}`)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
