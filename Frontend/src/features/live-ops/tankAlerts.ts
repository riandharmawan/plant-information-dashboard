import type { TankLive } from '../../domain/types.ts'

export const CRITICAL_FILL = 0.95
export const HIGH_FILL = 0.8

export function isEmptyTank(tank: Pick<TankLive, 'operationalStatus' | 'soundingLevelM' | 'productName'>): boolean {
  return tank.operationalStatus === 'EMPTY' || (tank.soundingLevelM == null && !tank.productName)
}

export function isOverfilled(ratio: number | null | undefined): boolean {
  return ratio != null && ratio > CRITICAL_FILL
}

/** Hotter than 1.3 times the farm average, the same rule as the tank table. */
export function isTempAnomaly(temperature: number | null | undefined, average: number | null): boolean {
  if (temperature == null || average == null || average <= 0) return false
  return temperature > average * 1.3
}

export function isCritical(tank: TankLive, averageTemperature: number | null): boolean {
  return isOverfilled(tank.fillRatio) || isTempAnomaly(tank.temperatureC, averageTemperature)
}

export function fillTone(ratio: number | null | undefined): 'low' | 'high' | 'critical' {
  if (ratio != null && ratio > CRITICAL_FILL) return 'critical'
  if (ratio != null && ratio > HIGH_FILL) return 'high'
  return 'low'
}
