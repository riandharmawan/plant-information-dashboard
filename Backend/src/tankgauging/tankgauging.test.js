import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fetchTankMeta,
  parseTankMetaResponse,
  parseTankNumber,
  parseTankParameterResponse,
  pickWorstStatusString,
  tankvisionNameToCode,
  unitTankKey,
} from './client.js'
import { remoteFor, tankListFor } from './poll.js'
import { hasEvidence, localDate, parseRoundTimes, roundStatus, roundValues, zonedTimeToUtc } from './rounds.js'
import { normalizeSourceUrl } from './sources.js'
import { stockFromGauge } from '../domain/stock.js'

// Shapes taken from live units, with made-up names and numbers.
const singleUnitMeta = JSON.stringify({
  leftTree: {
    localUnitInfo: [{ unitName: 'NXA820_X_1' }],
    units: [{ id: 1, name: 'NXA820_X_1', tanks: [{ id: 1, name: 'TK 5201', status: 649 }, { id: 2, name: 'TK 5202', status: 649 }] }],
    groupTypes: [{ name: 'Products', groups: [{ name: 'CPO', tanks: [{ unitName: 'NXA820_X_1', tankName: 'TK 5201', id: 1 }] }] }],
  },
})

const multiUnitMeta = JSON.stringify({
  leftTree: {
    localUnitInfo: [{ unitName: 'TC-01' }],
    units: [
      { id: 0, name: 'TS-01', tanks: [{ id: 1, name: 'TK5101' }, { id: 2, name: 'TK-5702' }] },
      { id: 1, name: 'TS-02', tanks: [{ id: 1, name: 'TK311' }] },
    ],
    groupTypes: [{
      name: 'Products',
      groups: [
        { name: 'CPO', tanks: [{ unitName: 'TS-01', tankName: 'TK5101', id: 1 }] },
        { name: 'POME', tanks: [{ unitName: 'TS-02', tankName: 'TK311', id: 1 }] },
      ],
    }],
  },
})

const values = JSON.stringify({
  multiTankTgvData: {
    multiTankBulkRealTimeData: [{
      tankId: 1,
      parameterlist: [
        { id: 622, value: 17781, valueString: "+17'781", timestamp: 1794272513, statusString: 'Ok' },
        { id: 625, value: 32, valueString: '+32.0', timestamp: 1794272513, statusString: 'Manual' },
        { id: 628, value: 902.2, valueString: '+902.2', timestamp: 1794272514, statusString: 'INIT' },
        { id: 717, value: 5289146, valueString: "+5'289'146", timestamp: 1794272514, statusString: 'Ok' },
        { id: 730, value: 4772.1, valueString: "+4'772.1", timestamp: 1794272514, statusString: 'Ok' },
      ],
    }],
    multiTankInfoData: [{ tankId: 1, tankName: 'TK 5201', tankComment: 'IDLE', tankStatus: 649, levelMovement: 0, gaugeRefHeight: 19800 }],
  },
})

test('tank names from both sites give the same kind of code', () => {
  assert.equal(tankvisionNameToCode('TK 5201'), '5201')
  assert.equal(tankvisionNameToCode('TK5101'), '5101')
  assert.equal(tankvisionNameToCode('TK-5702'), '5702')
  assert.equal(tankvisionNameToCode('TK Sodium 12'), '12')
  assert.equal(tankvisionNameToCode('Tank 101'), 'Tank 101')
  assert.equal(tankvisionNameToCode('Daily Tank Methanol 1'), 'Daily Tank Methanol 1')
  assert.equal(tankvisionNameToCode('  '), null)
})

test('numbers with apostrophe separators and placeholders', () => {
  assert.equal(parseTankNumber("+15'648"), 15648)
  assert.equal(parseTankNumber('+38.3'), 38.3)
  assert.equal(parseTankNumber('n/a'), null)
  assert.equal(parseTankNumber('-'), null)
  assert.equal(parseTankNumber(undefined), null)
})

test('a single-unit host lists one unit with its products', () => {
  const meta = parseTankMetaResponse(singleUnitMeta)
  assert.equal(meta.units.length, 1)
  assert.equal(meta.units[0].name, 'NXA820_X_1')
  assert.deepEqual(meta.units[0].tanks.map((t) => t.code), ['5201', '5202'])
  assert.equal(meta.productByUnitTank.get(unitTankKey('NXA820_X_1', 1)), 'CPO')
})

test('a controller with several units keeps tank numbers apart', () => {
  const meta = parseTankMetaResponse(multiUnitMeta)
  assert.deepEqual(meta.units.map((u) => u.name), ['TS-01', 'TS-02'])
  assert.equal(meta.controllerName, 'TC-01')
  // Tank 1 exists in both units, with different products.
  assert.equal(meta.productByUnitTank.get(unitTankKey('TS-01', 1)), 'CPO')
  assert.equal(meta.productByUnitTank.get(unitTankKey('TS-02', 1)), 'POME')
  assert.deepEqual(meta.units[0].tanks.map((t) => t.code), ['5101', '5702'])
})

test('a host with several units is read one unit at a time, each by name', () => {
  const meta = parseTankMetaResponse(multiUnitMeta)
  assert.equal(tankListFor(meta.units, meta.units[0]), '1|2')
  assert.equal(remoteFor(meta.units, meta.units[1]), 'TS-02')
  const one = parseTankMetaResponse(singleUnitMeta)
  assert.equal(tankListFor(one.units, one.units[0]), '1|2')
  assert.equal(remoteFor(one.units, one.units[0]), undefined, 'a single unit is read without naming it')
})

test('one unit of several answers with ttvData, and reads like the single-unit reply', () => {
  const reply = JSON.stringify({
    ttvData: {
      multiTankBulkRealTimeData: [
        { tankId: 1, parameterlist: [{ id: 622, value: 53, timestamp: 1794279953, statusString: 'Ok' }, { id: 717, value: 52306, timestamp: 1794279953, statusString: 'Ok' }] },
      ],
      multiTankInfoData: [{ tankId: 1, tankName: 'TK3104', tankComment: '-', tankStatus: 649, levelMovement: 0 }],
    },
  })
  const { readings } = parseTankParameterResponse(reply, new Map([[1, 'FAME']]))
  assert.equal(readings.length, 1)
  assert.equal(readings[0].levelMm, 53)
  assert.equal(readings[0].totalObservedVolume, 52306)
  assert.equal(readings[0].productName, 'FAME')
})

test('readings carry values, product, comment and the worst status', () => {
  const { readings, parseMode } = parseTankParameterResponse(values, new Map([[1, 'CPO']]))
  assert.equal(parseMode, 'multiTankBulkRealTimeData')
  const r = readings[0]
  assert.equal(r.externalTankId, 1)
  assert.equal(r.levelMm, 17781)
  assert.equal(r.temperatureC, 32)
  assert.equal(r.observedDensityKgM3, 902.2)
  assert.equal(r.totalMass, 4772.1)
  assert.equal(r.productName, 'CPO')
  assert.equal(r.tankComment, 'IDLE')
  assert.equal(r.gaugeRefHeightMm, 19800)
  assert.equal(r.statusText, 'INIT', 'INIT is worse than Manual and Ok')
  assert.equal(r.recordedAt, new Date(1794272513 * 1000).toISOString())
  assert.equal(parseTankParameterResponse('', new Map()).readings.length, 0)
  assert.equal(parseTankParameterResponse('-12', new Map()).readings.length, 0, 'an error code is not a reading')
})

test('worst status ranking', () => {
  assert.equal(pickWorstStatusString(['Ok', 'Manual', 'FAIL']), 'FAIL')
  assert.equal(pickWorstStatusString([null, undefined]), null)
})

test('a 204 from the unit is retried once, with the session cookie', async () => {
  const calls = []
  let gwt = 0
  const fetchImpl = async (url, init = {}) => {
    const u = String(url)
    calls.push({ u, cookie: init.headers?.Cookie ?? null })
    if (u.endsWith('/index.esp')) {
      return { ok: true, status: 200, text: async () => '', headers: { getSetCookie: () => ['SESSIONID=abc; Path=/'] } }
    }
    gwt += 1
    if (gwt === 1) return { ok: true, status: 204, text: async () => '', headers: { getSetCookie: () => [] } }
    return { ok: true, status: 200, text: async () => singleUnitMeta, headers: { getSetCookie: () => [] } }
  }
  const res = await fetchTankMeta({ baseUrl: 'http://unit.test/', fetchImpl, retryDelayMs: 1 })
  assert.equal(res.ok, true)
  const gwtCalls = calls.filter((c) => c.u.includes('GWTHandler.esp'))
  assert.equal(gwtCalls.length, 2)
  assert.ok(gwtCalls.every((c) => c.cookie === 'SESSIONID=abc'))
  assert.ok(gwtCalls[0].u.includes('DATATYPE=23'))
})

test('source urls are cleaned and checked', () => {
  assert.equal(normalizeSourceUrl('http://172.16.250.15/'), 'http://172.16.250.15')
  assert.equal(normalizeSourceUrl('http://atg-pura.kpndomain.com/index.esp'), 'http://atg-pura.kpndomain.com')
  assert.throws(() => normalizeSourceUrl('ftp://x'), /http or https/)
  assert.throws(() => normalizeSourceUrl('not a url'), /valid URL/)
  assert.throws(() => normalizeSourceUrl(''), /required/)
})

test('round times are validated and sorted', () => {
  assert.deepEqual(parseRoundTimes('14:30, 6:30 ,06:30'), ['06:30', '14:30'])
  assert.deepEqual(parseRoundTimes('25:00,abc'), [])
})

test('a round time becomes the right instant in the site timezone', () => {
  assert.equal(zonedTimeToUtc('2026-11-10', '06:30', 'Asia/Makassar').toISOString(), '2026-11-09T22:30:00.000Z')
  assert.equal(zonedTimeToUtc('2026-11-10', '14:30', 'Asia/Jakarta').toISOString(), '2026-11-10T07:30:00.000Z')
  // Just after midnight UTC is already the next day in Makassar.
  assert.equal(localDate(new Date('2026-11-09T17:00:00Z'), 'Asia/Makassar'), '2026-11-10')
  assert.equal(localDate(new Date('2026-11-09T17:00:00Z'), 'Asia/Jakarta'), '2026-11-10')
  assert.equal(localDate(new Date('2026-11-09T16:59:00Z'), 'Asia/Makassar'), '2026-11-10')
  assert.equal(localDate(new Date('2026-11-09T15:59:00Z'), 'Asia/Makassar'), '2026-11-09')
})

test('a round is Empty only when the gauge reads empty', () => {
  assert.equal(roundStatus({ levelMm: 17781, massTon: 4772 }), 'ATG')
  assert.equal(roundStatus({ levelMm: 0, massTon: 0 }), 'Empty')
  assert.equal(roundStatus({ levelMm: 275, massTon: null }), 'ATG')
})

test('a lone level of zero is not evidence of an empty tank', () => {
  assert.equal(hasEvidence({ levelMm: 0, massTon: null, temperatureC: null }), false)
  assert.equal(hasEvidence({ levelMm: null, massTon: null, temperatureC: 30 }), false)
  assert.equal(hasEvidence({ levelMm: 0, massTon: 26, temperatureC: null }), true, 'residual mass at the measuring floor is real')
  assert.equal(hasEvidence({ levelMm: 0, massTon: null, temperatureC: 31 }), true)
  assert.equal(hasEvidence({ levelMm: 5000, massTon: null, temperatureC: null }), true)
})

const param = (id, value, statusString) => ({ id, value, statusString })

test('a round keeps INIT and Manual values but drops no-data and failed ones', () => {
  const good = roundValues({
    level_mm: 17781, temperature_c: 32, total_mass: 4770.9, observed_density_kg_m3: 902.2, total_observed_volume: 5289146,
    raw_payload: { parameterlist: [param(622, 17781, 'Ok'), param(625, 32, 'Manual'), param(628, 902.2, 'INIT'), param(717, 5289146, 'Ok'), param(730, 4770.9, 'INIT')] },
  })
  assert.deepEqual(good, { levelMm: 17781, temperatureC: 32, massTon: 4770.9, densityKgM3: 902.2, volumeLitre: 5289146 })

  // A unit that has lost a tank still sends numbers: level 0, density -1, mass -0.044.
  const dead = roundValues({
    level_mm: 0, temperature_c: 0, total_mass: -0.044, observed_density_kg_m3: -1, total_observed_volume: 0,
    raw_payload: { parameterlist: [param(622, 0, 'NODATA'), param(625, 0, 'NODATA'), param(628, -1, 'NODATA'), param(717, 0, 'NODATA'), param(730, -0.044, 'NODATA')] },
  })
  assert.deepEqual(dead, { levelMm: null, temperatureC: null, massTon: null, densityKgM3: null, volumeLitre: null })

  // Level fine, mass failed: the round keeps the level only.
  const half = roundValues({
    level_mm: 5000, total_mass: 12, raw_payload: { parameterlist: [param(622, 5000, 'Ok'), param(730, 12, 'Fail')] },
  })
  assert.equal(half.levelMm, 5000); assert.equal(half.massTon, null)

  // Without a parameter list the stored columns are trusted, but a negative mass or density never is.
  const bare = roundValues({ level_mm: 100, total_mass: -3, observed_density_kg_m3: 0 })
  assert.equal(bare.levelMm, 100); assert.equal(bare.massTon, null); assert.equal(bare.densityKgM3, null)
})

test('stock from a gauge uses its mass, and needs a capacity for free space', () => {
  const none = stockFromGauge(4772000, undefined)
  assert.equal(none.quantityKg, 4772000)
  assert.equal(none.capacityKg, null)
  assert.equal(none.emptySpaceKg, null)
  assert.equal(none.levelRatio, null)
  const full = stockFromGauge(4772000, { capacityKg: 6000000, bottomStockKg: 100000 })
  assert.equal(full.emptySpaceKg, 1228000)
  assert.equal(full.loadableKg, 4672000)
  assert.ok(Math.abs(full.levelRatio - 0.7953333) < 1e-6)
})
