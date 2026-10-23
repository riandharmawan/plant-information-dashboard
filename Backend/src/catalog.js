import { query } from './db.js'
import { massToKg } from './domain/stock.js'

let cached = null

function num(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function loadCatalog() {
  if (cached) return cached
  const profiles = await query(`
    SELECT t.code AS tank_code, p.*
    FROM tank_profiles p
    JOIN tanks t ON t.id = p.tank_id
  `)
  const volumes = await query(`
    SELECT t.code AS tank_code, v.height_m, v.volume_litre
    FROM tank_volume_points v
    JOIN tanks t ON t.id = v.tank_id
    ORDER BY t.code, v.height_m
  `)
  const bands = await query(`
    SELECT t.code AS tank_code, b.low_mm, b.high_mm, b.offset_mm
    FROM tank_ring_bands b
    JOIN tanks t ON t.id = b.tank_id
    ORDER BY b.id
  `)
  const rings = await query(`
    SELECT t.code AS tank_code, r.ring_index, r.volume_litre
    FROM tank_ring_volumes r
    JOIN tanks t ON t.id = r.tank_id
    ORDER BY t.code, r.ring_index
  `)
  const density = await query(`SELECT density_group, temp_c, density FROM density_points ORDER BY density_group, temp_c`)

  const byTank = new Map()
  for (const row of profiles.rows) {
    byTank.set(row.tank_code, {
      tankId: row.tank_code,
      capacityKg: massToKg(num(row.capacity), row.capacity_unit),
      bottomStockKg: massToKg(num(row.bottom_stock), row.capacity_unit),
      dipOffsetMm: num(row.dip_offset_mm) ?? 0,
      tableTempC: num(row.table_temp_c),
      ullageLkMm: num(row.ullage_lk_mm),
      ullageLbMm: num(row.ullage_lb_mm),
      densityGroup: row.density_group,
      volumeApprox: row.volume_approx,
      volume: [],
      ringVolumes: [],
      ringBands: [],
    })
  }
  for (const row of volumes.rows) {
    byTank.get(row.tank_code)?.volume.push([num(row.height_m), num(row.volume_litre)])
  }
  for (const row of bands.rows) {
    byTank.get(row.tank_code)?.ringBands.push([num(row.low_mm), num(row.high_mm), num(row.offset_mm)])
  }
  for (const row of rings.rows) {
    const profile = byTank.get(row.tank_code)
    if (!profile) continue
    profile.ringVolumes[row.ring_index - 1] = num(row.volume_litre)
  }
  const tables = {}
  for (const row of density.rows) {
    if (!tables[row.density_group]) tables[row.density_group] = []
    tables[row.density_group].push([num(row.temp_c), num(row.density)])
  }
  cached = { profiles: byTank, tables }
  return cached
}

export function clearCatalog() {
  cached = null
}
