/**
 * HTTP client for Endress+Hauser Tankvision / NXA GWTHandler.esp endpoints.
 * Ported from Jetty Planning System (tankvision-client.js). The surface is undocumented
 * and was worked out from live units, so treat it as brittle.
 *
 * Parameter ids seen on live NXA820 units:
 *   622 Product Level (mm)
 *   625 Product Temperature (deg C)
 *   628 Observed Density (kg/m3)
 *   717 Total Observed Volume (litres as displayed)
 *   724 Total Mass Flow Rate (tonnes per hour)
 *   730 Total Mass (tonnes)
 * Id 624 answers 204 on some units, so it is left out.
 *
 * Differences from the Jetty Planning System client, found by probing live units:
 * - The session cookie from index.esp is kept and sent on every call.
 * - A tank is addressed by unit name and tank number. A controller such as an NXA821 can hold
 *   several units that each number their tanks from 1.
 * - Tank names are read with or without the space and dash: "TK 5201", "TK5101", "TK-5702".
 */

export const DEFAULT_TANK_PARAM_IDS = '622|625|628|717|724|730'

export function trimBaseUrl(raw) {
  return String(raw || '').trim().replace(/\/+$/, '')
}

export function buildAuthHeaders(baseUrl, auth, cookie = '') {
  const headers = {
    Accept: '*/*',
    'User-Agent': 'PID-TankGaugingPoller/1.0',
    Referer: `${trimBaseUrl(baseUrl)}/`,
  }
  const cookies = []
  if (auth?.type === 'cookie' && auth.secret) cookies.push(auth.secret)
  if (cookie) cookies.push(cookie)
  if (cookies.length) headers.Cookie = cookies.join('; ')
  if (auth?.type === 'basic' && auth.user) {
    headers.Authorization = `Basic ${Buffer.from(`${auth.user}:${auth.secret ?? ''}`, 'utf8').toString('base64')}`
  }
  return headers
}

function timeoutMs(opts) {
  const n = Number(opts?.timeoutMs ?? process.env.TANK_GAUGING_TIMEOUT_MS ?? 15000)
  return Number.isFinite(n) && n > 0 ? n : 15000
}

/**
 * Open a session the way the web page does and return its cookie. Failure is not fatal.
 * A poll opens one and passes it to every call, so a unit is not asked to open fifteen.
 */
export async function openSession(baseUrl, opts = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch
  try {
    const res = await fetchImpl(`${baseUrl}/index.esp`, {
      headers: buildAuthHeaders(baseUrl, opts.auth),
      redirect: 'follow',
      signal: AbortSignal.timeout(Math.min(timeoutMs(opts), 8000)),
    })
    const set = typeof res.headers?.getSetCookie === 'function' ? res.headers.getSetCookie() : []
    return set.map((c) => c.split(';')[0]).join('; ')
  } catch {
    return ''
  }
}

async function gwtGet(searchParams, opts = {}) {
  const baseUrl = trimBaseUrl(opts.baseUrl)
  if (!baseUrl) throw new Error('baseUrl is required')
  const fetchImpl = opts.fetchImpl ?? fetch
  const url = new URL(`${baseUrl}/GWTHandler.esp`)
  for (const [key, value] of Object.entries(searchParams)) url.searchParams.set(key, String(value))

  const cookie = opts.cookie ?? (await openSession(baseUrl, opts))
  const attempt = async () => {
    const res = await fetchImpl(url, {
      headers: buildAuthHeaders(baseUrl, opts.auth, cookie),
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs(opts)),
    })
    return { res, text: await res.text() }
  }

  let { res, text } = await attempt()
  // The unit answers 204 when the session is not ready yet. One short wait and one retry.
  if (res.status === 204 || (!text && res.ok)) {
    await new Promise((resolve) => setTimeout(resolve, opts.retryDelayMs ?? 600))
    ;({ res, text } = await attempt())
  }
  return { ok: res.ok && Boolean(text), status: res.status, text, url: url.toString() }
}

/** DATATYPE=23: the unit and tank tree, with the product groups. */
export function fetchTankMeta(opts = {}) {
  return gwtGet({ DATATYPE: '23' }, opts)
}

/** DATATYPE=47: live parameter values for a list of tank numbers. */
export function fetchTankParameters(opts = {}) {
  return gwtGet(
    {
      DATATYPE: '47',
      TANKLIST: opts.tankList || '1|2|3|4|5|6|7|8|9|10|11|12|13|14|15',
      PARAMIDLIST: opts.paramIdList || process.env.TANK_GAUGING_PARAMIDLIST || DEFAULT_TANK_PARAM_IDS,
      TYPE: 'DATA',
    },
    opts,
  )
}

/**
 * DATATYPE=31: what the unit says about one tank itself, from its tank detail page. Includes the
 * Max Tank Capacity, which the live values do not carry.
 */
export function fetchTankInfo(opts = {}) {
  return gwtGet({ DATATYPE: '31', TANKID: opts.tankId }, opts)
}

/**
 * A number with a unit as the unit prints it, such as "+5'696'217 L" or "+19'800 mm".
 * @returns {{ value: number, unit: string } | null}
 */
export function parseQuantity(raw) {
  if (raw == null) return null
  const match = /^\s*([+-]?[\d',.\s]*\d)\s*([A-Za-z][A-Za-z0-9³²/%]*)?\s*$/.exec(String(raw))
  if (!match) return null
  const value = parseTankNumber(match[1].replace(/\s/g, ''))
  return value == null ? null : { value, unit: match[2] ?? '' }
}

/** Litres from a printed volume. Cubic metres and kilolitres are converted. Anything else is not guessed. */
export function litresOf(raw) {
  const quantity = parseQuantity(raw)
  if (!quantity) return null
  const unit = quantity.unit.toLowerCase().replace('³', '3')
  if (unit === 'l' || unit === 'lt' || unit === 'ltr' || unit === '') return quantity.value
  if (unit === 'kl' || unit === 'm3') return quantity.value * 1000
  return null
}

/** The tank detail reply: capacity in litres, height in millimetres, and where the tank stands. */
export function parseTankInfoResponse(text) {
  const raw = String(text ?? '').trim()
  if (!raw.startsWith('{')) return null
  try {
    const header = JSON.parse(raw)?.tankInfoHeader
    if (!header || typeof header !== 'object') return null
    const height = parseQuantity(header.tankHeight)
    const clean = (value) => {
      const text = String(value ?? '').trim()
      return text && text !== 'N/A' ? text : null
    }
    return {
      maxCapacityLitre: litresOf(header.maxTankCap),
      tankHeightMm: height && /^mm$/i.test(height.unit) ? height.value : null,
      tankLocation: clean(header.tankLocation),
      tankState: clean(header.tankStatus),
      roofStatus: clean(header.roofStatus),
    }
  } catch {
    return null
  }
}

/**
 * A product as a stock group code. The gauge spells some products oddly ("FAME_", "COUSTIC SODA"),
 * so the code is tidied. An empty or placeholder product gives null.
 */
const PRODUCT_FIXES = { 'COUSTIC SODA': 'CAUSTIC SODA' }
export function productToGroupCode(name) {
  const text = String(name ?? '').replace(/_+$/g, '').replace(/\s+/g, ' ').trim().toUpperCase()
  if (!text || text === '-' || text === 'N/A') return null
  return PRODUCT_FIXES[text] ?? text
}

/**
 * Tank code from a display name. Bontang names are "TK 5201", Tanjung Pura names are "TK5101"
 * and "TK-5702". All three give the number alone, so both sites read the same.
 */
export function tankvisionNameToCode(name) {
  const text = String(name || '').trim()
  if (!text) return null
  const sodium = text.match(/^TK\s+Sodium\s+(.+)$/i)
  if (sodium) return sodium[1].trim()
  const tank = text.match(/^TK[\s-]*(.+)$/i)
  if (tank) return tank[1].trim()
  return text
}

/** A tank is looked up by unit name and number, so the key carries both. */
export function unitTankKey(unitName, externalTankId) {
  return `${String(unitName ?? '').trim()}\u0000${Number(externalTankId)}`
}

/**
 * Product per tank from the Products groups of DATATYPE=23.
 * Keyed by unit name and tank number. A group lists its tanks as { unitName, tankName, id }.
 * @returns {Map<string, string>}
 */
export function productMapFromMetaData(data) {
  const map = new Map()
  const groupTypes = data?.leftTree?.groupTypes || data?.groupTypes || []
  for (const groupType of groupTypes) {
    if (String(groupType.name || '').trim().toLowerCase() !== 'products') continue
    for (const group of groupType.groups || []) {
      const product = String(group.name || '').trim()
      if (!product) continue
      for (const tank of group.tanks || []) {
        const id = Number.parseInt(tank.id, 10)
        if (!Number.isFinite(id)) continue
        const key = unitTankKey(tank.unitName, id)
        if (!map.has(key)) map.set(key, product)
      }
    }
  }
  return map
}

/**
 * Parse DATATYPE=23 into units, each with its tanks.
 * @returns {{ units: Array<{ id: number|null, name: string, ipAddress: string|null, tanks: Array<{ externalTankId: number, name: string, code: string|null, status: number|null }> }>, controllerName: string|null, productByUnitTank: Map<string,string>, parseMode: string }}
 */
export function parseTankMetaResponse(text) {
  const raw = String(text ?? '').trim()
  const empty = { units: [], controllerName: null, productByUnitTank: new Map(), parseMode: 'empty' }
  if (!raw) return empty
  try {
    const data = JSON.parse(raw)
    const tree = data?.leftTree || data
    const controllerName = tree?.localUnitInfo?.[0]?.unitName ?? null
    const units = []
    for (const unit of tree?.units || []) {
      const tanks = []
      for (const tank of unit.tanks || []) {
        const externalTankId = Number.parseInt(tank.id, 10)
        const name = String(tank.name || '').trim()
        if (!Number.isFinite(externalTankId) || !name) continue
        tanks.push({
          externalTankId,
          name,
          code: tankvisionNameToCode(name),
          status: tank.status != null ? Number(tank.status) : null,
        })
      }
      units.push({
        id: Number.isFinite(Number(unit.id)) ? Number(unit.id) : null,
        // A single-unit host may leave the unit name out, so fall back to the controller name.
        name: String(unit.name || controllerName || '').trim(),
        ipAddress: unit.ipAddress ?? null,
        tanks,
      })
    }
    return {
      units,
      controllerName: controllerName ? String(controllerName) : null,
      productByUnitTank: productMapFromMetaData(data),
      parseMode: 'leftTree',
    }
  } catch {
    return { ...empty, parseMode: 'unrecognized' }
  }
}

/** Numbers come with apostrophe thousands separators, such as 6'277. */
export function parseTankNumber(raw) {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  const text = String(raw).trim().replace(/'/g, '').replace(/,/g, '').replace(/^\+/, '')
  if (!text || text === '-' || /^n\/?a$/i.test(text)) return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

const paramById = (list, id) => (list || []).find((p) => Number(p.id) === id) || null

const STATUS_RANK = {
  NODATA: 100,
  FAIL: 90,
  INVALIDDATA: 80,
  INIT: 70,
  MANUAL: 60,
  LASTVALIDVALUE: 50,
  OK: 10,
}

const statusKey = (s) => String(s || '').trim().toUpperCase().replace(/\s+/g, '')

/** The most severe status across the polled parameters. */
export function pickWorstStatusString(statuses) {
  let worst = null
  let worstRank = -1
  for (const raw of statuses) {
    if (!raw) continue
    const rank = STATUS_RANK[statusKey(raw)] ?? 40
    if (rank > worstRank) {
      worstRank = rank
      worst = String(raw).trim()
    }
  }
  return worst
}

function tankInfoMap(data) {
  const out = new Map()
  for (const info of data?.multiTankTgvData?.multiTankInfoData || []) {
    const id = Number.parseInt(info.tankId, 10)
    if (!Number.isFinite(id)) continue
    const comment = String(info.tankComment ?? '').trim()
    out.set(id, {
      tankComment: comment && comment !== '-' ? comment : null,
      tankStatusCode: info.tankStatus != null ? Number(info.tankStatus) : null,
      levelMovement: info.levelMovement != null ? Number(info.levelMovement) : null,
      gaugeRefHeightMm: parseTankNumber(info.gaugeRefHeight),
      tankName: info.tankName ? String(info.tankName).trim() : null,
    })
  }
  return out
}

function readingFromTank(tank, infoById, product) {
  const list = tank.parameterlist || []
  const id = Number.parseInt(tank.tankId, 10)
  const level = paramById(list, 622)
  const temp = paramById(list, 625)
  const density = paramById(list, 628)
  const volume = paramById(list, 717)
  const flow = paramById(list, 724)
  const mass = paramById(list, 730)
  const stamp = Number(
    level?.timestamp || temp?.timestamp || density?.timestamp || volume?.timestamp || flow?.timestamp || mass?.timestamp || 0,
  )
  const info = infoById.get(id) || {}
  return {
    externalTankId: Number.isFinite(id) ? id : null,
    productName: product ?? null,
    tankComment: info.tankComment ?? null,
    tankStatusCode: info.tankStatusCode ?? null,
    levelMovement: info.levelMovement ?? null,
    gaugeRefHeightMm: info.gaugeRefHeightMm ?? null,
    levelMm: parseTankNumber(level?.value ?? level?.valueString),
    temperatureC: parseTankNumber(temp?.value ?? temp?.valueString),
    observedDensityKgM3: parseTankNumber(density?.value ?? density?.valueString),
    totalObservedVolume: parseTankNumber(volume?.value ?? volume?.valueString),
    flowRateTph: parseTankNumber(flow?.value ?? flow?.valueString),
    totalMass: parseTankNumber(mass?.value ?? mass?.valueString),
    statusText: pickWorstStatusString([level, temp, density, volume, flow, mass].map((p) => p?.statusString)),
    recordedAt: stamp > 0 ? new Date(stamp * 1000).toISOString() : null,
    parameterlist: list,
  }
}

/**
 * Parse DATATYPE=47 into one reading per tank.
 * @param {string} text
 * @param {Map<number,string>} [productByTankId] product per tank number, for the unit being read
 */
export function parseTankParameterResponse(text, productByTankId = new Map()) {
  const raw = String(text ?? '').trim()
  if (!raw) return { readings: [], parseMode: 'empty' }
  if (!raw.startsWith('{') && !raw.startsWith('[')) return { readings: [], parseMode: 'unrecognized' }
  try {
    const data = JSON.parse(raw)
    const infoById = tankInfoMap(data)
    const bulk = data?.multiTankTgvData?.multiTankBulkRealTimeData
    if (!Array.isArray(bulk)) return { readings: [], parseMode: 'unrecognized' }
    const readings = bulk
      .map((tank) => readingFromTank(tank, infoById, productByTankId.get(Number.parseInt(tank.tankId, 10))))
      .filter((reading) => reading.externalTankId != null)
    return { readings, parseMode: 'multiTankBulkRealTimeData' }
  } catch {
    return { readings: [], parseMode: 'unrecognized' }
  }
}

/** A reading in a form that is safe to store as JSON. */
export function readingToRawPayload(reading) {
  const { parameterlist, ...rest } = reading
  return { ...rest, parameterlist: parameterlist ?? null }
}
