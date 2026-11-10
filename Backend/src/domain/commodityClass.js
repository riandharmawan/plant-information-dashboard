/**
 * The few commodity classes management compares sites by. Every site names its products differently
 * (Bekasi has 7 stock groups, Bontang 18), so a tank is placed in a class from its product name, or
 * from the group the gauge assigns when it has no product.
 */
export const COMMODITY_CLASSES = ['cpo', 'refined', 'pfad', 'pome', 'pkfad', 'rpome', 'fame', 'glycerin', 'limbah', 'chemical', 'sludge', 'cpko', 'other']

const has = (text, token) => new RegExp(`(^|[^A-Z0-9])${token}([^A-Z0-9]|$)`).test(text)

export function commodityClassOf(...names) {
  const text = names
    .map((name) => String(name ?? '').toUpperCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((name) => name && name !== '-')
    .join(' | ')
  if (!text) return 'other'

  if (text.includes('FAME') || text.includes('BIODIESEL')) return 'fame'
  if (text.includes('GLYCERIN') || text.includes('FATTY MATTER') || has(text, 'CG') || has(text, 'FM')) return 'glycerin'
  if (/METHANOL|CAUSTIC|NAOH|SODIUM|HCL|CITRIC/.test(text) || has(text, 'SM')) return 'chemical'
  // POME and RPOME are palm oil mill effluent oil, not palm oil. RPOME contains POME, so it is checked first,
  // and both before RPO.
  if (/RPOME/.test(text)) return 'rpome'
  if (/POME/.test(text)) return 'pome'
  if (/PKFAD/.test(text)) return 'pkfad'
  if (/PFAD/.test(text)) return 'pfad'
  if (/LIMBAH/.test(text)) return 'limbah'
  if (/SLUDGE/.test(text)) return 'sludge'
  // CPKO is crude palm kernel oil, a different product from CPO.
  if (has(text, 'CPKO')) return 'cpko'
  if (has(text, 'CPO') || text.includes('CRUDE')) return 'cpo'
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
