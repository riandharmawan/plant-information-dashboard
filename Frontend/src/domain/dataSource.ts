/** Where a tank's figures come from: the tank gauging system (ATG, TankVision) or the operators' logsheets. */
export type DataSource = 'atg' | 'logsheet'

/** A tank read by a gauge system says so on its reading. Anything else comes from the logsheets. */
export function sourceOfTanks(tanks: Array<{ readingKind?: 'live' | 'round' | null }>): DataSource | null {
  if (tanks.length === 0) return null
  return tanks.some((tank) => tank.readingKind === 'live' || tank.readingKind === 'round') ? 'atg' : 'logsheet'
}
