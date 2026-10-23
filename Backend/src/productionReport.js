import { query } from './db.js'

const PLANT_OF = {
  refinery150: 'refinery150',
  refinery500: 'refinery500',
  fractionation400: 'fract400',
  fractionation500: 'fract500',
}

const UTILITY_OF = {
  power: 'powerKwh',
  gas: 'gasMmBtu',
  steam: 'steam',
  water: 'water',
}

function num(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function blankPlant(yieldApplicable) {
  return {
    feed: null,
    product: null,
    coproduct: null,
    beBags: null,
    pa: null,
    powerKwh: null,
    gasMmBtu: null,
    steam: null,
    water: null,
    compressor: null,
    yieldApplicable,
  }
}

function emptyDay(id) {
  return {
    id,
    refinery500: blankPlant(true),
    refinery150: blankPlant(true),
    fract400: blankPlant(false),
    fract500: blankPlant(false),
    separator: blankPlant(true),
  }
}

function ensure(byDate, date) {
  if (!byDate.has(date)) byDate.set(date, emptyDay(date))
  return byDate.get(date)
}

/**
 * One screen day per production_date. Quantities are the stored printed numbers.
 * A missing unit, a blank cell, or a sum of only blanks stays null.
 */
export async function loadProductionDays(siteId) {
  const [units, flows, materials, utilities] = await Promise.all([
    query(
      `SELECT d.production_date::text AS production_date, pu.code AS unit
       FROM production_days d
       JOIN process_units pu ON pu.id = d.process_unit_id
       WHERE d.site_id = $1`,
      [siteId],
    ),
    query(
      `SELECT d.production_date::text AS production_date, pu.code AS unit, f.block,
              SUM(f.quantity) AS quantity
       FROM production_days d
       JOIN process_units pu ON pu.id = d.process_unit_id
       JOIN production_flows f ON f.day_id = d.id
       WHERE d.site_id = $1
       GROUP BY d.production_date, pu.code, f.block`,
      [siteId],
    ),
    query(
      `SELECT d.production_date::text AS production_date, pu.code AS unit,
              SUM(m.quantity) FILTER (WHERE m.material = 'bleaching_earth') AS be_bags,
              SUM(m.total_quantity) FILTER (WHERE m.material = 'phosphoric_acid') AS pa
       FROM production_days d
       JOIN process_units pu ON pu.id = d.process_unit_id
       JOIN production_materials m ON m.day_id = d.id
       WHERE d.site_id = $1
       GROUP BY d.production_date, pu.code`,
      [siteId],
    ),
    query(
      `SELECT d.production_date::text AS production_date, pu.code AS unit, u.canonical_code,
              SUM(u.quantity) AS quantity
       FROM production_days d
       JOIN process_units pu ON pu.id = d.process_unit_id
       JOIN production_utilities u ON u.day_id = d.id AND u.owner
       WHERE d.site_id = $1
       GROUP BY d.production_date, pu.code, u.canonical_code`,
      [siteId],
    ),
  ])

  const byDate = new Map()
  for (const row of units.rows) {
    const key = PLANT_OF[row.unit]
    if (key) ensure(byDate, row.production_date)
  }
  for (const row of flows.rows) {
    const key = PLANT_OF[row.unit]
    if (!key || (row.block !== 'feed' && row.block !== 'product' && row.block !== 'coproduct')) continue
    ensure(byDate, row.production_date)[key][row.block] = num(row.quantity)
  }
  for (const row of materials.rows) {
    const key = PLANT_OF[row.unit]
    if (!key) continue
    const plant = ensure(byDate, row.production_date)[key]
    plant.beBags = num(row.be_bags)
    plant.pa = num(row.pa)
  }
  for (const row of utilities.rows) {
    const key = PLANT_OF[row.unit]
    const field = UTILITY_OF[row.canonical_code]
    if (!key || !field) continue
    ensure(byDate, row.production_date)[key][field] = num(row.quantity)
  }

  return [...byDate.values()].sort((left, right) => left.id.localeCompare(right.id))
}
