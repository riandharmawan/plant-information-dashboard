import type { OilFamily } from './types.ts'

export function oilFamilyOf(productName: string): OilFamily {
  const name = productName.toUpperCase()
  if (name.includes('PFAD')) return 'PFAD'
  if (name.includes('PMF')) return 'PMF'
  if (name.includes('SLUDGE')) return 'SLUDGE'
  // Palm oil mill effluent oil, including RPOME. Without this RPOME would read as RPO.
  if (name.includes('POME')) return 'UNKNOWN'
  if (name.includes('RBDPS') || name.includes('RPS')) return 'RPS'
  if (name.includes('RPOL') || name.includes('RPL') || name.includes('RBDPL')) return 'RPL'
  if (name.includes('RBDPO') || name.includes('RPO')) return 'RPO'
  if (name.includes('CPO')) return 'CPO'
  if (
    name.includes('OLEIN') ||
    name.includes('IV64') ||
    name.includes('IV 64') ||
    name.includes('TOOL')
  ) {
    return 'OLEIN'
  }
  return 'UNKNOWN'
}
