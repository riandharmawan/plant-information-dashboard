import { Router } from 'express'
import { requireAuth, requirePermission } from '../access.js'
import { query } from '../db.js'
import { finishedOilFromDays, historyFromDays, hourlyFromDays, ledgerFromDays, snapshotFromDays } from '../refineryQuality.js'

const router = Router({ mergeParams: true })

function num(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function inRange(iso, from, to) {
  if (!iso) return !from && !to
  if (from && iso < from) return false
  if (to && iso > to) return false
  return true
}

const CERT_FIELD = {
  'lab.ffa': 'ffa',
  'lab.moisture': 'moisture',
  'lab.color_r': 'colorR',
  'lab.color_y': 'colorY',
  'lab.iv': 'iv',
  'lab.pv': 'pv',
  'lab.smp': 'smp',
  'lab.cloud_point': 'cloudPoint',
  'lab.anv': 'anv',
  'lab.carotene': 'carotene',
  'lab.phosphorus': 'phosphorus',
  'lab.dobi': 'dobi',
  'lab.totox': 'totox',
}

router.get('/storage', async (req, res, next) => {
  try {
    const from = req.query.from || null
    const to = req.query.to || null
    const result = await query(
      `SELECT c.id, t.code AS tank_code, c.oil, c.analysis_date, c.capacity, c.quantity, c.empty_space,
              c.temperature_c, c.odor, c.remark, c.snapshot_on, c.revision
       FROM storage_certificates c
       JOIN tanks t ON t.id = c.tank_id
       WHERE c.site_id = $1
       ORDER BY c.snapshot_on, t.code, c.revision`,
      [req.params.siteId],
    )
    const tests = await query(
      `SELECT p.certificate_id, p.canonical_code, p.numeric_value
       FROM certificate_parameters p
       JOIN storage_certificates c ON c.id = p.certificate_id
       WHERE c.site_id = $1`,
      [req.params.siteId],
    )
    const byCertificate = new Map()
    for (const row of tests.rows) {
      const list = byCertificate.get(row.certificate_id) ?? []
      list.push(row)
      byCertificate.set(row.certificate_id, list)
    }
    const rows = result.rows
      .filter((row) => inRange(row.snapshot_on, from, to))
      .map((row) => {
        const testsForRow = {
          ffa: null, moisture: null, colorR: null, colorY: null, iv: null, pv: null, smp: null,
          cloudPoint: null, anv: null, carotene: null, phosphorus: null, dobi: null, totox: null,
        }
        for (const test of byCertificate.get(row.id) ?? []) {
          const field = CERT_FIELD[test.canonical_code]
          if (field) testsForRow[field] = num(test.numeric_value)
        }
        return {
          tankId: row.tank_code,
          oil: row.oil,
          analysisDate: row.analysis_date,
          capacity: num(row.capacity),
          quantity: num(row.quantity),
          emptySpace: num(row.empty_space),
          temperatureC: num(row.temperature_c),
          ...testsForRow,
          odor: row.odor,
          remark: row.remark,
          snapshotOn: row.snapshot_on,
          revision: row.revision,
        }
      })
    res.json(rows)
  } catch (error) {
    next(error)
  }
})

router.get('/vessels', async (req, res, next) => {
  try {
    const from = req.query.from || null
    const to = req.query.to || null
    const tickets = await query(
      `SELECT * FROM vessel_tickets WHERE site_id = $1 ORDER BY arrival, id`,
      [req.params.siteId],
    )
    const samples = await query(
      `SELECT s.ticket_id, s.palka, s.sample_no, s.ffa, s.iv, s.dobi, s.moisture
       FROM vessel_palka_samples s
       JOIN vessel_tickets t ON t.id = s.ticket_id
       WHERE t.site_id = $1
       ORDER BY s.id`,
      [req.params.siteId],
    )
    const byTicket = new Map()
    for (const sample of samples.rows) {
      const list = byTicket.get(sample.ticket_id) ?? []
      list.push({
        palka: sample.palka,
        sampleNo: sample.sample_no,
        ffa: num(sample.ffa),
        iv: num(sample.iv),
        dobi: num(sample.dobi),
        moisture: num(sample.moisture),
      })
      byTicket.set(sample.ticket_id, list)
    }
    res.json(tickets.rows.filter((row) => inRange(row.arrival, from, to)).map((row) => ({
      id: row.id,
      ship: row.ship,
      supplier: row.supplier,
      commodity: row.commodity,
      arrival: row.arrival,
      quantityLabel: row.quantity_label,
      contractNo: row.contract_no,
      ffaMax: num(row.ffa_max),
      moistureMax: num(row.moisture_max),
      dobiMin: num(row.dobi_min),
      release: row.release,
      samples: byTicket.get(row.id) ?? [],
      composite: {
        ffa: num(row.composite_ffa),
        iv: num(row.composite_iv),
        moisture: num(row.composite_moisture),
        dobi: num(row.composite_dobi),
        pv: num(row.composite_pv),
        anv: num(row.composite_anv),
        triene: num(row.composite_triene),
        totox: num(row.composite_totox),
        carotene: num(row.composite_carotene),
        mineralOil: row.composite_mineral_oil,
      },
      leader: row.leader,
      leaderSigned: row.leader_signed,
      head: row.head,
      headSigned: row.head_signed,
    })))
  } catch (error) {
    next(error)
  }
})

router.get('/trucks', async (req, res, next) => {
  try {
    const from = req.query.from || null
    const to = req.query.to || null
    const batch = await query(
      `SELECT * FROM truck_batches WHERE site_id = $1 ORDER BY id LIMIT 1`,
      [req.params.siteId],
    )
    const header = batch.rows[0]
    if (!header) {
      return res.json({
        supplier: null,
        material: '',
        vessel: null,
        arrival: null,
        contractNo: null,
        ffaMax: null,
        moistureMax: null,
        rows: [],
      })
    }
    const samples = await query(
      `SELECT * FROM truck_samples WHERE batch_id = $1 ORDER BY id`,
      [header.id],
    )
    res.json({
      supplier: header.supplier,
      material: header.material,
      vessel: header.vessel,
      arrival: header.arrival,
      contractNo: header.contract_no,
      ffaMax: num(header.ffa_max),
      moistureMax: num(header.moisture_max),
      rows: samples.rows
        .filter((row) => inRange(row.sampled_on, from, to))
        .map((row) => ({
          sampleNo: row.sample_no ?? '',
          sampledOn: row.sampled_on,
          policeNo: row.police_no,
          ffa: num(row.ffa),
          moisture: num(row.moisture),
          iv: num(row.iv),
          dobi: num(row.dobi),
          pv: num(row.pv),
          colorR: num(row.color_r),
          colorY: num(row.color_y),
          analyst: row.analyst,
          remark: row.remark,
        })),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/movements', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT d.movement_date::text AS movement_date, m.vehicle, m.commodity_text,
              m.time_in, m.time_out, m.customer, m.seal_in, m.seal_out, m.operator, m.remark
       FROM oil_movements m
       JOIN oil_movement_days d ON d.id = m.day_id
       WHERE d.site_id = $1
       ORDER BY d.movement_date, m.row_index`,
      [req.params.siteId],
    )
    const first = result.rows[0]
    const last = result.rows[result.rows.length - 1]
    res.json({
      periodStart: first?.movement_date ?? null,
      periodEnd: last?.movement_date ?? null,
      rows: result.rows.map((row) => ({
        movementDate: row.movement_date,
        vehicle: row.vehicle,
        commodity: row.commodity_text,
        timeIn: row.time_in,
        timeOut: row.time_out,
        customer: row.customer,
        sealIn: row.seal_in,
        sealOut: row.seal_out,
        operator: row.operator,
        remark: row.remark,
      })),
    })
  } catch (error) {
    next(error)
  }
})

function allowedSite(req, res) {
  const siteId = req.params.siteId
  if (!req.sessionUser.sites.some((site) => site.id === siteId)) {
    res.status(403).json({ error: 'forbidden' })
    return false
  }
  return true
}

async function loadDays(siteId, from, to) {
  const result = await query(
    `SELECT d.production_date, d.report_date, d.declared_oils, pu.code AS unit_code, pu.name AS unit_name,
            s.imported_at, r.observed_time, r.row_index, r.from_tank_text, r.flow_rate, r.remark,
            st.stream, st.commodity_text, st.destination_text, p.canonical_code, p.numeric_value, p.text_value
     FROM refinery_quality_days d
     JOIN process_units pu ON pu.id = d.process_unit_id
     JOIN logsheet_submissions s ON s.id = d.submission_id
     LEFT JOIN refinery_quality_readings r ON r.day_id = d.id
     LEFT JOIN refinery_quality_streams st ON st.reading_id = r.id
     LEFT JOIN refinery_quality_parameters p ON p.stream_id = st.id
     WHERE d.site_id = $1
       AND ($2::date IS NULL OR d.production_date >= $2::date)
       AND ($3::date IS NULL OR d.production_date <= $3::date)
     ORDER BY d.production_date, r.row_index`,
    [siteId, from, to],
  )
  const days = new Map()
  for (const row of result.rows) {
    const date = row.production_date
    if (!days.has(date)) {
      days.set(date, {
        productionDate: date,
        reportDate: row.report_date,
        processUnit: row.unit_code,
        processUnitName: row.unit_name,
        declaredOils: row.declared_oils,
        importedAt: row.imported_at,
        readings: new Map(),
      })
    }
    const day = days.get(date)
    if (row.row_index == null) continue
    if (!day.readings.has(row.row_index)) {
      day.readings.set(row.row_index, {
        time: row.observed_time,
        fromTank: row.from_tank_text,
        flowRate: row.flow_rate == null ? null : Number(row.flow_rate),
        remark: row.remark,
        streams: { raw_material: null, bleaching_oil: null, finished_good: null, by_product: null, spent_earth: null },
      })
    }
    const reading = day.readings.get(row.row_index)
    if (!row.stream) continue
    if (!reading.streams[row.stream]) {
      reading.streams[row.stream] = { commodity: row.commodity_text, destination: row.destination_text, parameters: {} }
    }
    if (row.canonical_code) {
      reading.streams[row.stream].parameters[row.canonical_code] = row.text_value ?? (row.numeric_value == null ? null : Number(row.numeric_value))
    }
  }
  return [...days.values()].map((day) => ({ ...day, readings: [...day.readings.values()] }))
}

router.get('/refinery', requireAuth, requirePermission('qc', 'view'), async (req, res, next) => {
  try {
    if (!allowedSite(req, res)) return
    const days = await loadDays(req.params.siteId, req.query.from || null, req.query.to || null)
    res.json(snapshotFromDays(days, req.query.from || null, req.query.to || null))
  } catch (error) {
    next(error)
  }
})

router.get('/refinery/history', requireAuth, requirePermission('qc', 'view'), async (req, res, next) => {
  try {
    if (!allowedSite(req, res)) return
    const oil = String(req.query.oil || '')
    const parameter = String(req.query.parameter || 'lab.ffa')
    const stream = String(req.query.stream || 'finished_good')
    const days = await loadDays(req.params.siteId, req.query.from || null, req.query.to || null)
    const oils = [...new Set(days.flatMap((day) => day.readings.flatMap((reading) => [
      reading.streams.raw_material?.commodity,
      reading.streams.finished_good?.commodity,
    ].filter(Boolean))))]
    const selected = req.query.oils ? String(req.query.oils).split(',').filter(Boolean) : null
    const chosen = oil || finishedOilFromDays(days, selected)
    res.json({
      oil: chosen,
      oils,
      parameter,
      stream,
      points: historyFromDays(days, req.query.from || null, req.query.to || null, chosen, parameter, stream),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/refinery/hourly', requireAuth, requirePermission('qc', 'view'), async (req, res, next) => {
  try {
    if (!allowedSite(req, res)) return
    const date = String(req.query.date || '')
    const oil = String(req.query.oil || '')
    const days = await loadDays(req.params.siteId, date || null, date || null)
    const sheet = hourlyFromDays(days, date, oil)
    if (!sheet) return res.status(404).json({ error: 'not_found' })
    res.json(sheet)
  } catch (error) {
    next(error)
  }
})

router.get('/refinery/ledger', requireAuth, requirePermission('qc', 'view'), async (req, res, next) => {
  try {
    if (!allowedSite(req, res)) return
    const days = await loadDays(req.params.siteId, req.query.from || null, req.query.to || null)
    res.json(ledgerFromDays(days))
  } catch (error) {
    next(error)
  }
})

export default router
