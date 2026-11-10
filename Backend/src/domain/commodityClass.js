/**
 * The few commodity classes management compares sites by. Every site names its products differently
 * (Bekasi has 7 stock groups, Bontang 18), so a tank is placed in a class from its product name, or
 * from the group the gauge assigns when it has no product.
 */
export const COMMODITY_CLASSES = ['crude', 'refined', 'byproduct', 'biodiesel', 'glycerin', 'chemical', 'other']

const has = (text, token) => new RegExp(`(^|[^A-Z0-9])${token}([^A-Z0-9]|$)`).test(text)

export function commodityClassOf(...names) {
  const text = names
    .map((name) => String(name ?? '').toUpperCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((name) => name && name !== '-')
    .join(' | ')
  if (!text) return 'other'

  if (text.includes('FAME') || text.includes('BIODIESEL')) return 'biodiesel'
  if (text.includes('GLYCERIN') || text.includes('FATTY MATTER') || has(text, 'CG') || has(text, 'FM')) return 'glycerin'
  if (/METHANOL|CAUSTIC|NAOH|SODIUM|HCL|CITRIC/.test(text) || has(text, 'SM')) return 'chemical'
  // POME and RPOME are palm oil mill effluent oil, not palm oil. They must be checked before RPO.
  if (/PFAD|PKFAD|POME|SLUDGE|LIMBAH/.test(text)) return 'byproduct'
  if (has(text, 'CPO') || has(text, 'CPKO') || text.includes('CRUDE')) return 'crude'
  if (
    /RBDPO|RBDPL|RBDPS|RBDPKO|RPOL|OLEIN|STEARIN|PMF|TOOL/.test(text) ||
    has(text, 'RPO') ||
    has(text, 'RPL') ||
    has(text, 'RPS') ||
    /IV ?64/.test(text)
  ) {
    return 'refined'
  }
  return 'other'
}
