/**
 * Lab results as the tank screens read them. A certificate stores each test under a canonical code such
 * as lab.color_r. The screens look values up by the short upper-case code below, which is also what the
 * quality variance table uses, so a colour reading only shows up when the two agree.
 */
export const LAB_LABEL = {
  'lab.ffa': ['FFA', 'FFA', '%'],
  'lab.moisture': ['MI', 'M&I', '%'],
  'lab.color_r': ['COLOR_R', 'R', ''],
  'lab.color_y': ['COLOR_Y', 'Y', ''],
  'lab.iv': ['IV', 'IV', ''],
  'lab.pv': ['PV', 'PV', ''],
  'lab.dobi': ['DOBI', 'DOBI', ''],
  'lab.totox': ['Totox', 'Totox', ''],
}

const num = (value) => {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** The numeric tests of one certificate, as { code, label, value, unit }. Tests we do not show are left out. */
export function labParameters(tests) {
  return (tests ?? []).flatMap((test) => {
    const label = LAB_LABEL[test.canonical_code]
    const value = num(test.numeric_value)
    if (!label || value == null) return []
    return [{ code: label[0], label: label[1], value, unit: label[2] }]
  })
}
