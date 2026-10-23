import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config()

const here = path.dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.SEED_DATA_DIR || path.resolve(here, '../../Frontend/src/data')
const siteId = 'bekasi'
const plantId = 'priscolin-proj-bekasi'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const FORMS = [
  ['F/TNF-003', 'Storage Tank Sounding Report', 'f80caa03-a6b0-4ad7-b823-459b2f828ce3', 'sounding', '06:30,14:30'],
  ['F/TNF-004', 'Monitor Masuk dan Keluar Minyak', null, null, null],
  ['F/TNF-005', 'Checklist Pipa Pemuatan', null, null, null],
  ['F/TNF-002', 'Logbook Pergantian Filter Bag', null, null, null],
  ['F/TNF-009', 'Food Additive Logbook (Vitamin A)', null, null, null],
  ['F/QCO-001', 'Daily Storage Tank Analytical Result', '9e1e978f-18c0-42dc-a558-e28e65bdf5ce', 'lab', '07:00'],
  ['F/QCO-002', 'Daily Quality Refinery 150 MT & 500 MT', '54c4be2f-6076-4f6e-b897-90f12622d142', 'refinery-quality', null],
  ['F/QCO-003', 'Daily Quality Composite Fractionation', null, null, null],
  ['F/QCO-004', 'Form Registrasi Retain Sample', null, null, null],
  ['F/QCO-006', 'Form Container Inspection', null, null, null],
  ['F/QCO-008', 'Truck / Isotank Cleanliness Status', null, null, null],
  ['F/QCO-009', 'Analytical Result of Incoming Material by Vessel', null, 'vessel', null],
  ['F/QCO-010', 'Analytical Result of Incoming Material by Truck', null, 'truck', null],
  ['F/QCO-011', 'Analytical Result of Incoming Plant Chemical / Ingredient', null, null, null],
  ['F/QCO-012(A)', 'Registered in the briefing', null, null, null],
  ['F/QCO-012(B)', 'Registered in the briefing', null, null, null],
  ['F/QCO-013', 'Analytical Result of Outgoing Shipment Product by Truck', null, null, null],
  ['F/QCO-014', 'Cleanliness Storage Tank / Vessel Tank Inspection', null, null, null],
  ['F/QCO-018', 'Form Transfer', null, null, null],
  ['F/QCO-020', 'Analytical Result of Outgoing Shipment by Vessel', null, null, null],
  ['F/QCO-021', 'Cleanliness Laboratory Room Checklist', null, null, null],
  ['F/QCO-022', 'Cleanliness Equipment Laboratory Checklist', null, null, null],
  ['F/UTI-004', 'Form Pemakaian Bahan Bakar Boiler Taihu 15 T/H', null, null, null],
  ['F/UTI-005', 'Logbook Pemakaian Chemical Boiler', null, null, null],
  ['F/UTI-006', 'Monitoring Display Meter Air', null, null, null],
  ['F/UTI-010', 'Logsheet Batu Bara', null, null, null],
  ['F/UTI-011(a)', 'Registered in the briefing', null, null, null],
  ['F/UTI-011(b)', 'Registered in the briefing', null, null, null],
  ['F/UTI-012', 'Laporan Analisa Air Boiler', null, null, null],
  ['F/WTP-001', 'Laporan Analisa Air WTP & WWTP', null, null, null],
  ['F/WTP-006', 'Realization & Verification Cleaning RO', null, null, null],
  ['F/WWTP-001', 'WWTP Operational', null, null, null],
  ['F/RFA-001', 'Quality Report', null, null, null],
  ['F/RFA-002', 'Logsheet Pretreatment, Bleaching & Filtration', null, null, null],
  ['F/RFA-003', 'Logsheet Deodorizing & Filtration Section', null, null, null],
  ['F/RFA-004(A)', 'Refinery daily log', 'b1d7e44d-e90d-447f-9772-ffecba657b1e', null, null],
  ['F/RFA-004(B)', 'Fractionation daily log', '476fba4b-8ee8-4e3b-8fb1-627da45a47d3', null, null],
  ['F/RFA-010', 'Logsheet Dry Fractionation', null, null, null],
  ['F/RFA-013', 'Checklist Lamps and Glass Control', null, null, null],
  ['F/RFA-015', 'Change Product Checklist', null, null, null],
  ['F/RFA-016', 'Start Up Produksi Checklist', null, null, null],
]

const PAGE_KEYS = [
  'live-ops', 'ops-analytics', 'qc', 'daily-production', 'refinery-fractionation', 'utility', 'coverage',
  'master-companies', 'master-sites', 'master-plants', 'master-commodities', 'master-calibration',
  'master-tanks', 'master-logsheets', 'master-quality-rules', 'admin-users', 'admin-roles',
]
const VIEWER_KEYS = new Set(['live-ops', 'ops-analytics', 'qc', 'daily-production'])

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'))
}

function tankKey(code) {
  return `tank-${code.toLowerCase().replace(/\s+/g, '-')}`
}

async function chunks(client, sqlPrefix, rows, width, suffix = '') {
  const size = 400
  for (let index = 0; index < rows.length; index += size) {
    const slice = rows.slice(index, index + size)
    if (slice.length === 0) continue
    const params = []
    const values = slice.map((row, rowIndex) => {
      params.push(...row)
      const offset = rowIndex * width
      return `(${Array.from({ length: width }, (_, column) => `$${offset + column + 1}`).join(',')})`
    })
    await client.query(`${sqlPrefix} ${values.join(',')} ${suffix}`, params)
  }
}

const client = await pool.connect()
try {
  await client.query('BEGIN')
  const master = JSON.parse(fs.readFileSync(path.join(here, '../seed/master.json'), 'utf8'))

  for (const company of master.companies) {
    await client.query(
      `INSERT INTO companies (id, code, name) VALUES ($1,$2,$3)
       ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, updated_at = NOW()`,
      [company.id, company.code, company.name],
    )
  }
  for (const site of master.sites) {
    await client.query(
      `INSERT INTO sites (id, company_id, name, timezone) VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, timezone = EXCLUDED.timezone, updated_at = NOW()`,
      [site.id, site.companyId, site.name, site.timezone],
    )
  }
  for (const plant of master.plants) {
    await client.query(
      `INSERT INTO plants (id, site_id, name) VALUES ($1,$2,$3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
      [plant.id, plant.siteId, plant.name],
    )
  }
  for (const commodity of master.commodities) {
    await client.query(
      `INSERT INTO commodities (id, company_id, code, name) VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, updated_at = NOW()`,
      [commodity.id, 'prc-general-ho-jakarta', commodity.code, commodity.name],
    )
  }
  for (const code of master.tanks) {
    await client.query(
      `INSERT INTO tanks (id, plant_id, code) VALUES ($1,$2,$3)
       ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, updated_at = NOW()`,
      [tankKey(code), plantId, code],
    )
  }

  const groups = ['CPO', 'RBDPO', 'OLEIN', 'RBDPS', 'IV 64', 'PMF', 'PFAD']
  for (const [index, code] of groups.entries()) {
    await client.query(
      `INSERT INTO stock_groups (site_id, code, name, sort_order) VALUES ($1,$2,$2,$3)
       ON CONFLICT (site_id, code) DO NOTHING`,
      [siteId, code, index],
    )
  }
  for (const [code, name] of [
    ['refinery150', 'Refinery 150'],
    ['refinery500', 'Refinery 500'],
    ['fractionation400', 'Fractionation 400'],
    ['fractionation500', 'Fractionation 500'],
  ]) {
    await client.query(
      `INSERT INTO process_units (plant_id, code, name, yield_rule)
       VALUES ($1,$2,$3,'same-day')
       ON CONFLICT (plant_id, code) DO UPDATE SET name = EXCLUDED.name`,
      [plantId, code, name],
    )
  }
  const aliases = [
    ['CPO', 'cpo'],
    ['cpo', 'cpo'],
    ['RPO', 'rpo'],
    ['rpo', 'rpo'],
    ['RPO/RBDPO', 'rpo'],
    ['RPS', 'rps'],
    ['rps', 'rps'],
    ['RPS/RBDPS', 'rps'],
    ['RRPS/RRBDPS', 'rps'],
    ['PFAD', 'pfad'],
    ['pfad', 'pfad'],
    ['PMF', 'pmf'],
    ['pmf', 'pmf'],
    ['RPL/RPOL', 'olein'],
    ['Olein', 'olein'],
    ['olein', 'olein'],
    ['Olein IV 64', 'olein'],
    ['olein iv64', 'olein'],
    ['iv 64', 'olein'],
    ['iv64', 'olein'],
    ['Olein Tooling', 'olein'],
    ['olein tolling', 'olein'],
  ]
  for (const [source, commodityId] of aliases) {
    await client.query(
      `INSERT INTO commodity_aliases (site_id, commodity_id, source_text)
       VALUES ($1,$2,$3)
       ON CONFLICT (site_id, source_text) DO UPDATE SET commodity_id = EXCLUDED.commodity_id`,
      [siteId, commodityId, source],
    )
  }

  await client.query(
    `INSERT INTO quality_rules (site_id, commodity_id, scope, parameter_code, bound, limit_value, severity)
     VALUES
       ($1,'cpo','inbound','lab.ffa','max',5,'reject'),
       ($1,'cpo','inbound','lab.moisture','max',0.5,'reject'),
       ($1,'cpo','inbound','lab.iv','min',51,'watch'),
       ($1,'cpo','inbound','lab.iv','max',54,'watch'),
       ($1,'cpo','inbound','lab.dobi','min',2,'watch')
     ON CONFLICT DO NOTHING`,
    [siteId],
  )

  const definitions = new Map()
  for (const [formCode, name, externalId, mapperKey, schedule] of FORMS) {
    const result = await client.query(
      `INSERT INTO logsheet_definitions (site_id, plant_id, external_id, form_code, name, mapper_key, schedule)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (site_id, form_code) DO UPDATE
         SET name = EXCLUDED.name, external_id = EXCLUDED.external_id,
             mapper_key = EXCLUDED.mapper_key, schedule = EXCLUDED.schedule
       RETURNING id`,
      [siteId, plantId, externalId, formCode, name, mapperKey, schedule],
    )
    definitions.set(formCode, result.rows[0].id)
  }

  async function submission(formCode, businessKey) {
    const result = await client.query(
      `INSERT INTO logsheet_submissions (definition_id, business_key, payload)
       VALUES ($1,$2,'{}'::jsonb)
       ON CONFLICT (definition_id, business_key) DO UPDATE SET imported_at = NOW()
       RETURNING id`,
      [definitions.get(formCode), businessKey],
    )
    return result.rows[0].id
  }

  await client.query(`
    TRUNCATE TABLE
      vessel_palka_samples, truck_samples, certificate_parameters, storage_certificates, gate_movements,
      logistics_events, analytics_movements, lab_results, soundings,
      tank_ring_bands, tank_ring_volumes, tank_volume_points
    RESTART IDENTITY CASCADE
  `)
  await client.query('DELETE FROM vessel_tickets')
  await client.query('DELETE FROM truck_batches')

  const soundingSubmission = await submission('F/TNF-003', 'seed:logsheets')
  const labSubmission = await submission('F/QCO-001', 'seed:labs')
  const vesselSubmission = await submission('F/QCO-009', 'seed:vessels')
  const truckSubmission = await submission('F/QCO-010', 'seed:trucks')
  const movementSubmission = await submission('F/QCO-009', 'seed:gate-movements')

  const logsheets = readJson('logsheets.json')
  const qc = readJson('qc.json')
  const calibration = readJson('tankCalibration.json')

  const soundingRows = logsheets.soundings.map((row) => [
    siteId, plantId, tankKey(row.tankId), soundingSubmission, row.recordedOn, row.roundIndex,
    row.productName ?? '', row.soundingLevelM, row.temperatureC, row.operationalStatus ?? '',
  ])
  await chunks(
    client,
    `INSERT INTO soundings
      (site_id, plant_id, tank_id, submission_id, recorded_on, round_index, product_name, level_m, temperature_c, operational_status)
     VALUES`,
    soundingRows,
    10,
  )

  for (const lab of logsheets.labs) {
    await client.query(
      `INSERT INTO lab_results
        (site_id, plant_id, tank_id, submission_id, analysis_date, snapshot_on, revision, product_name, temperature_c, parameters)
       VALUES ($1,$2,$3,$4,$5,$6,1,$7,$8,$9::jsonb)
       ON CONFLICT (tank_id, snapshot_on, revision) DO UPDATE
         SET analysis_date = EXCLUDED.analysis_date, product_name = EXCLUDED.product_name,
             temperature_c = EXCLUDED.temperature_c, parameters = EXCLUDED.parameters`,
      [
        siteId, plantId, tankKey(lab.tankId), labSubmission, lab.analysisDate, lab.snapshotOn ?? lab.analysisDate,
        lab.productName ?? '', lab.temperatureC, JSON.stringify(lab.parameters ?? []),
      ],
    )
  }

  for (const row of logsheets.logistics) {
    await client.query(
      `INSERT INTO logistics_events
        (id, site_id, plant_id, submission_id, mode, name, commodity, direction, target_label,
         ffa, moisture, sampled_on, remark, sample_breach, detail_lines)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, ffa = EXCLUDED.ffa, moisture = EXCLUDED.moisture`,
      [
        row.id, siteId, plantId, row.mode === 'vessel' ? vesselSubmission : truckSubmission,
        row.mode, row.name, row.commodity, row.direction, row.targetLabel,
        row.ffa, row.moisture, row.sampledOn, row.remark, row.sampleBreach,
        JSON.stringify(row.detailLines ?? []),
      ],
    )
  }

  const movementRows = logsheets.movements.map((row) => [siteId, soundingSubmission, row.commodity, row.direction])
  await chunks(
    client,
    `INSERT INTO analytics_movements (site_id, submission_id, commodity, direction) VALUES`,
    movementRows,
    4,
  )

  const certificateRows = qc.storage.map((row) => [
    siteId, plantId, tankKey(row.tankId), labSubmission, row.oil, row.analysisDate, row.snapshotOn, row.revision,
    row.capacity, row.quantity, row.emptySpace, row.temperatureC, row.ffa, row.moisture, row.colorR, row.colorY,
    row.iv, row.pv, row.smp, row.cloudPoint, row.anv, row.carotene, row.phosphorus, row.dobi, row.totox,
    row.odor, row.remark,
  ])
  await chunks(
    client,
    `INSERT INTO storage_certificates
      (site_id, plant_id, tank_id, submission_id, oil, analysis_date, snapshot_on, revision,
       capacity, quantity, empty_space, temperature_c, ffa, moisture, color_r, color_y,
       iv, pv, smp, cloud_point, anv, carotene, phosphorus, dobi, totox, odor, remark)
     VALUES`,
    certificateRows,
    27,
  )

  for (const ticket of qc.vessels) {
    const composite = ticket.composite ?? {}
    await client.query(
      `INSERT INTO vessel_tickets
        (id, site_id, submission_id, ship, supplier, commodity, arrival, quantity_label, contract_no,
         ffa_max, moisture_max, dobi_min, release, leader, leader_signed, head, head_signed,
         composite_ffa, composite_iv, composite_moisture, composite_dobi, composite_pv, composite_anv,
         composite_triene, composite_totox, composite_carotene, composite_mineral_oil)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
       ON CONFLICT (id) DO NOTHING`,
      [
        ticket.id, siteId, vesselSubmission, ticket.ship, ticket.supplier, ticket.commodity, ticket.arrival,
        ticket.quantityLabel, ticket.contractNo, ticket.ffaMax, ticket.moistureMax, ticket.dobiMin, ticket.release,
        ticket.leader, ticket.leaderSigned, ticket.head, ticket.headSigned,
        composite.ffa, composite.iv, composite.moisture, composite.dobi, composite.pv, composite.anv,
        composite.triene, composite.totox, composite.carotene, composite.mineralOil,
      ],
    )
    for (const sample of ticket.samples ?? []) {
      await client.query(
        `INSERT INTO vessel_palka_samples (ticket_id, palka, sample_no, ffa, iv, dobi, moisture)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [ticket.id, sample.palka, sample.sampleNo, sample.ffa, sample.iv, sample.dobi, sample.moisture],
      )
    }
  }

  const trucks = qc.trucks
  const batch = await client.query(
    `INSERT INTO truck_batches
      (site_id, submission_id, supplier, material, vessel, arrival, contract_no, ffa_max, moisture_max)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [siteId, truckSubmission, trucks.supplier, trucks.material, trucks.vessel, trucks.arrival, trucks.contractNo, trucks.ffaMax, trucks.moistureMax],
  )
  const truckRows = trucks.rows.map((row) => [
    batch.rows[0].id, row.sampleNo, row.sampledOn, row.policeNo || '', row.ffa, row.moisture, row.iv,
    row.dobi, row.pv, row.colorR, row.colorY, row.analyst, row.remark,
  ])
  await chunks(
    client,
    `INSERT INTO truck_samples
      (batch_id, sample_no, sampled_on, police_no, ffa, moisture, iv, dobi, pv, color_r, color_y, analyst, remark)
     VALUES`,
    truckRows,
    13,
  )

  const gateRows = qc.movements.rows.map((row) => [
    siteId, movementSubmission, row.vehicle, row.commodity, row.timeIn, row.timeOut, row.customer,
    row.sealIn, row.sealOut, row.operator, row.remark, qc.movements.periodStart, qc.movements.periodEnd,
  ])
  await chunks(
    client,
    `INSERT INTO gate_movements
      (site_id, submission_id, vehicle, commodity, time_in, time_out, customer, seal_in, seal_out, operator, remark, period_start, period_end)
     VALUES`,
    gateRows,
    13,
  )

  for (const tank of calibration.tanks) {
    const id = tankKey(tank.tankId)
    await client.query(
      `INSERT INTO tanks (id, plant_id, code) VALUES ($1,$2,$3)
       ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code`,
      [id, plantId, tank.tankId],
    )
    await client.query(
      `INSERT INTO tank_profiles
        (tank_id, capacity, capacity_unit, bottom_stock, dip_offset_mm, table_temp_c, ullage_lk_mm, ullage_lb_mm, density_group, volume_approx, origin)
       VALUES ($1,$2,'kg',$3,$4,$5,$6,$7,$8,$9,'seed')
       ON CONFLICT (tank_id) DO UPDATE SET
         capacity = EXCLUDED.capacity, capacity_unit = EXCLUDED.capacity_unit, bottom_stock = EXCLUDED.bottom_stock,
         dip_offset_mm = EXCLUDED.dip_offset_mm, table_temp_c = EXCLUDED.table_temp_c,
         ullage_lk_mm = EXCLUDED.ullage_lk_mm, ullage_lb_mm = EXCLUDED.ullage_lb_mm,
         density_group = EXCLUDED.density_group, volume_approx = EXCLUDED.volume_approx`,
      [
        id, tank.capacityKg, tank.bottomStockKg, tank.dipOffsetMm ?? 0, tank.tableTempC,
        tank.ullageLkMm, tank.ullageLbMm, tank.densityGroup, Boolean(tank.volumeApprox),
      ],
    )
    const points = (tank.volume ?? []).map((pair) => [id, pair[0], pair[1]])
    await chunks(
      client,
      `INSERT INTO tank_volume_points (tank_id, height_m, volume_litre) VALUES`,
      points,
      3,
      'ON CONFLICT (tank_id, height_m) DO NOTHING',
    )
    for (const band of tank.ringBands ?? []) {
      await client.query(
        `INSERT INTO tank_ring_bands (tank_id, low_mm, high_mm, offset_mm) VALUES ($1,$2,$3,$4)`,
        [id, band[0], band[1], band[2]],
      )
    }
    const rings = (tank.ringVolumes ?? []).map((volume, index) => [id, index + 1, volume])
    await chunks(
      client,
      `INSERT INTO tank_ring_volumes (tank_id, ring_index, volume_litre) VALUES`,
      rings,
      3,
      'ON CONFLICT (tank_id, ring_index) DO NOTHING',
    )
  }

  await client.query('DELETE FROM density_points')
  const densityRows = []
  for (const [group, pairs] of Object.entries(calibration.density ?? {})) {
    for (const pair of pairs) densityRows.push([group, pair[0], pair[1]])
  }
  await chunks(
    client,
    `INSERT INTO density_points (density_group, temp_c, density) VALUES`,
    densityRows,
    3,
    'ON CONFLICT (density_group, temp_c) DO NOTHING',
  )

  const adminRole = await client.query(
    `INSERT INTO roles (name, description, is_system_role) VALUES ('Administrator','Full access', TRUE)
     ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description RETURNING id`,
  )
  const viewerRole = await client.query(
    `INSERT INTO roles (name, description, is_system_role) VALUES ('Viewer','Operational view', TRUE)
     ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description RETURNING id`,
  )
  for (const key of PAGE_KEYS) {
    const permission = await client.query(
      `INSERT INTO permissions (resource_type, resource_key, can_view, can_edit, can_delete)
       VALUES ('page',$1,TRUE,TRUE,TRUE)
       ON CONFLICT (resource_type, resource_key) DO UPDATE SET can_view = TRUE
       RETURNING id`,
      [key],
    )
    await client.query(
      `INSERT INTO role_permissions (role_id, permission_id, can_view, can_edit, can_delete)
       VALUES ($1,$2,TRUE,TRUE,TRUE)
       ON CONFLICT (role_id, permission_id)
       DO UPDATE SET can_view = TRUE, can_edit = TRUE, can_delete = TRUE`,
      [adminRole.rows[0].id, permission.rows[0].id],
    )
    if (VIEWER_KEYS.has(key)) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id, can_view, can_edit, can_delete)
         VALUES ($1,$2,TRUE,FALSE,FALSE)
         ON CONFLICT (role_id, permission_id)
         DO UPDATE SET can_view = TRUE, can_edit = FALSE, can_delete = FALSE`,
        [viewerRole.rows[0].id, permission.rows[0].id],
      )
    }
  }

  if ((process.env.APP_ENV || '') === 'dev') {
    const hash = bcrypt.hashSync('admin123', 10)
    const user = await client.query(
      `INSERT INTO users (username, display_name, password_hash, is_active, deleted_at)
       VALUES ('admin','Administrator',$1,TRUE,NULL)
       ON CONFLICT (username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash, is_active = TRUE, deleted_at = NULL, updated_at = NOW()
       RETURNING id`,
      [hash],
    )
    await client.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [user.rows[0].id, adminRole.rows[0].id],
    )
    await client.query(
      `INSERT INTO user_sites (user_id, site_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [user.rows[0].id, siteId],
    )
    console.log('local admin seeded for APP_ENV=dev only')
  } else {
    console.log('local admin seed skipped')
  }

  await client.query('COMMIT')
  console.log('seed complete')
} catch (error) {
  await client.query('ROLLBACK')
  console.error(error)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
