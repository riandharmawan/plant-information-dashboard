import calibration from '../data/tankCalibration.json'
import { type TankProfile } from './tankCalibration.ts'

/**
 * Stock figures from the October tank report, fed by the morning sounding.
 *
 * Capacity and bottom stock are the fixed kilograms on that report.
 * Level (m), temperature, and method (ISI LK / ISI LB / K LK / K LB / EMPTY)
 * come from F/TNF-003. Quantity keeps two decimal places of the sounding workbook's kilograms:
 * dip plus the tank offset, calibration liters, ring, density, and the
 * 0.0000348 temperature correction. Empty space, loadable, and level percent
 * then follow the report:
 *   empty space = capacity − quantity
 *   loadable    = quantity − bottom stock
 *   level %     = quantity / capacity
 *
 * Profiles start as the workbook seed and can be replaced at runtime
 * (CalibrationContext) after a user saves a recalibration.
 */

const FILE = calibration as unknown as {
  density: Record<string, number[][]>
  tanks: TankProfile[]
}

/** Shared temperature → density lists. A tank stores only the group name. */
export const DENSITY_TABLES: Record<string, number[][]> = FILE.density

let TANKS = new Map(FILE.tanks.map((tank) => [tank.tankId, tank]))

export const SEED_PROFILES: TankProfile[] = FILE.tanks

export function setTankProfiles(tanks: TankProfile[]): void {
  TANKS = new Map(tanks.map((tank) => [tank.tankId, tank]))
}

export function profileOf(tankId: string): TankProfile | undefined {
  return TANKS.get(tankId)
}

export interface TankStock {
  capacityKg: number | null
  quantityKg: number | null
  emptySpaceKg: number | null
  loadableKg: number | null
  levelRatio: number | null
}

const BLANK: TankStock = {
  capacityKg: null,
  quantityKg: null,
  emptySpaceKg: null,
  loadableKg: null,
  levelRatio: null,
}

function trunc2(value: number): number {
  return Math.trunc(value * 100) / 100
}

function lookupVolume(pairs: number[][], key: number, approximate: boolean): number | null {
  const roundedKey = Math.round(key * 100) / 100
  if (!approximate) {
    const hit = pairs.find(([height]) => Math.abs(height - roundedKey) < 0.0005)
    return hit ? hit[1] : null
  }
  let best: number[] | null = null
  for (const pair of pairs) {
    if (pair[0] <= roundedKey + 0.0005 && (best == null || pair[0] > best[0])) best = pair
  }
  return best ? best[1] : null
}

function lookupDensity(group: string | null, tempC: number): number | null {
  if (!group) return null
  const hit = FILE.density[group]?.find(([temp]) => temp === tempC)
  return hit ? hit[1] : null
}

export type PreviewNotice =
  | { kind: 'no-table' }
  | { kind: 'height'; lookupM: number; minM: number; maxM: number }
  | { kind: 'density'; tempC: number; group: string; minC: number; maxC: number }

function soundingTotalMm(profile: TankProfile, levelM: number, method: string): number | null {
  const normalized = method.trim().toLowerCase().replace(/\s+/g, ' ')
  const soundingMm = Math.round(levelM * 1000)
  if (normalized === 'isi lk' || normalized === 'isi lkr') return soundingMm + profile.dipOffsetMm
  if (normalized === 'isi lb') return soundingMm
  if (normalized === 'k lk' && profile.ullageLkMm != null) return profile.ullageLkMm - soundingMm
  if (normalized === 'k lb' && profile.ullageLbMm != null) return profile.ullageLbMm - soundingMm
  return null
}

/** Why a filled preview cannot produce a quantity. Blank inputs stay quiet. */
export function previewNotice(
  profile: TankProfile,
  levelM: number | null,
  tempC: number | null,
  method: string,
): PreviewNotice | null {
  if (levelM == null || tempC == null || Number.isNaN(levelM) || Number.isNaN(tempC)) return null
  const normalized = method.trim().toLowerCase().replace(/\s+/g, ' ')
  if (normalized === 'empty') return null
  if (profile.volume.length === 0 || profile.tableTempC == null) return { kind: 'no-table' }
  const totalMm = soundingTotalMm(profile, levelM, method)
  if (totalMm == null) return null
  const lookupM = trunc2(totalMm / 1000)
  const heights = profile.volume.map(([height]) => height)
  const minM = Math.min(...heights)
  const maxM = Math.max(...heights)
  if (lookupVolume(profile.volume, lookupM, profile.volumeApprox) == null && lookupM > 0) {
    return { kind: 'height', lookupM, minM, maxM }
  }
  if (!profile.densityGroup) return null
  if (lookupDensity(profile.densityGroup, tempC) != null) return null
  const temps = (FILE.density[profile.densityGroup] ?? []).map(([temp]) => temp)
  if (temps.length === 0) return null
  return {
    kind: 'density',
    tempC,
    group: profile.densityGroup.toUpperCase(),
    minC: Math.min(...temps),
    maxC: Math.max(...temps),
  }
}

function quantityKg(profile: TankProfile, levelM: number | null, tempC: number | null, method: string): number | null {
  const normalized = method.trim().toLowerCase().replace(/\s+/g, ' ')
  if (normalized === 'empty') return 0
  if (levelM == null || tempC == null || profile.tableTempC == null) return null
  if (profile.volume.length === 0) return null
  const totalMm = soundingTotalMm(profile, levelM, method)
  if (totalMm == null) return null
  const tableLiters = lookupVolume(profile.volume, trunc2(totalMm / 1000), profile.volumeApprox)
  if (tableLiters == null) return trunc2(totalMm / 1000) <= 0 ? 0 : null
  const roundedMm = Math.round(totalMm)
  const digit = Math.abs(roundedMm) % 10
  let ring = 0
  if (digit !== 0 && profile.ringVolumes.length > 0) {
    let offset = 0
    for (const band of profile.ringBands) {
      const [low, high, bandOffset] = band
      if (roundedMm >= low && roundedMm <= high) offset += bandOffset
    }
    const index = offset * 10 + digit
    ring = index >= 1 && index <= profile.ringVolumes.length ? (profile.ringVolumes[index - 1] ?? 0) : 0
  }
  const density = lookupDensity(profile.densityGroup, tempC)
  if (density == null) return null
  const factor = 1 + 0.0000348 * (tempC - profile.tableTempC)
  return kilograms((tableLiters + ring) * density * factor)
}

/** Keep two decimal places. Extra digits are cut off, not rounded to the next kilogram. */
function kilograms(value: number): number {
  const sign = value < 0 ? -1 : 1
  return sign * Math.floor(Math.abs(value) * 100 + 1e-8) / 100
}

export function stockFromProfile(
  profile: TankProfile,
  levelM: number | null,
  tempC: number | null,
  method: string,
): TankStock {
  const quantity = quantityKg(profile, levelM, tempC, method)
  const capacityKg = profile.capacityKg
  if (quantity == null || capacityKg == null || profile.bottomStockKg == null || capacityKg === 0) {
    return { ...BLANK, capacityKg, quantityKg: quantity }
  }
  return {
    capacityKg,
    quantityKg: quantity,
    emptySpaceKg: capacityKg - quantity,
    loadableKg: quantity - profile.bottomStockKg,
    levelRatio: quantity / capacityKg,
  }
}

export function stockOf(tankId: string, levelM: number | null, tempC: number | null, method: string): TankStock {
  const profile = TANKS.get(tankId)
  if (!profile) return BLANK
  return stockFromProfile(profile, levelM, tempC, method)
}
