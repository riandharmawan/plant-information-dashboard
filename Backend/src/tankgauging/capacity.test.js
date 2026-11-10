import test from 'node:test'
import assert from 'node:assert/strict'
import { litresOf, parseQuantity, parseTankInfoResponse, productToGroupCode } from './client.js'
import { stockFromGauge } from '../domain/stock.js'
import { withReferenceDensity } from './live.js'
import { oilFamilyOf } from '../domain/present.js'

// The shape the unit returns for DATATYPE=31, with made-up numbers.
const detail = JSON.stringify({
  tankInfoHeader: {
    tankStatus: 'In Operation',
    roofStatus: 'No Floating Roof',
    tankLocation: 'Terminal-1',
    tankHeight: "+19'800 mm",
    maxTankCap: "+5'696'217 L",
    legStatus: 'N/A',
    wmSeal: 'Unsealed',
  },
})

test('a printed quantity splits into a number and its unit', () => {
  assert.deepEqual(parseQuantity("+19'800 mm"), { value: 19800, unit: 'mm' })
  assert.deepEqual(parseQuantity('+38.3 °C'.replace('°C', 'C')), { value: 38.3, unit: 'C' })
  assert.deepEqual(parseQuantity('5000'), { value: 5000, unit: '' })
  assert.equal(parseQuantity('N/A'), null)
  assert.equal(parseQuantity(undefined), null)
})

test('capacity is read in litres and other volume units are converted, never guessed', () => {
  assert.equal(litresOf("+5'696'217 L"), 5696217)
  assert.equal(litresOf('+0 L'), 0)
  assert.equal(litresOf('+5.7 m3'), 5700)
  assert.equal(litresOf('+5.7 m³'), 5700)
  assert.equal(litresOf('+3 kL'), 3000)
  assert.equal(litresOf('+12 bbl'), null)
  assert.equal(litresOf('junk'), null)
})

test('the tank detail reply gives capacity, height, state and location', () => {
  assert.deepEqual(parseTankInfoResponse(detail), {
    maxCapacityLitre: 5696217,
    tankHeightMm: 19800,
    tankLocation: 'Terminal-1',
    tankState: 'In Operation',
    roofStatus: 'No Floating Roof',
  })
  const spare = parseTankInfoResponse(JSON.stringify({ tankInfoHeader: { tankStatus: 'In Maintenance', tankHeight: "+13'500 mm", maxTankCap: '+0 L', tankLocation: 'N/A' } }))
  assert.equal(spare.maxCapacityLitre, 0)
  assert.equal(spare.tankState, 'In Maintenance')
  assert.equal(spare.tankLocation, null, 'N/A is not a location')
  assert.equal(parseTankInfoResponse('-12'), null, 'an error code is not a detail page')
  assert.equal(parseTankInfoResponse('{"other":1}'), null)
})

test('gauge products become stock group codes', () => {
  assert.equal(productToGroupCode('RBDPO'), 'RBDPO')
  assert.equal(productToGroupCode('FAME_'), 'FAME')
  assert.equal(productToGroupCode('COUSTIC SODA'), 'CAUSTIC SODA')
  assert.equal(productToGroupCode('  Methanol   3 '), 'METHANOL 3')
  assert.equal(productToGroupCode('Sweet Water'), 'SWEET WATER', 'lower-case letters are kept, not stripped')
  assert.equal(productToGroupCode('-'), null)
  assert.equal(productToGroupCode(''), null)
  assert.equal(productToGroupCode(null), null)
})

test('stock from a gauge: capacity is litres times density, and the level is volume over capacity', () => {
  // 5,296,217 L observed in a 5,696,217 L tank. Mass 4,770,865 kg at 902.2 kg/m3.
  const s = stockFromGauge(4770865, undefined, { capacityLitre: 5696217, volumeLitre: 5289146, densityKgM3: 902.2 })
  assert.ok(Math.abs(s.capacityKg - (5696217 * 902.2) / 1000) < 1e-6)
  assert.ok(Math.abs(s.levelRatio - 5289146 / 5696217) < 1e-9, 'the level does not depend on density')
  assert.ok(Math.abs(s.emptySpaceKg - (s.capacityKg - 4770865)) < 1e-6)
  assert.equal(s.loadableKg, null, 'a gauge gives no bottom stock')
})

test('stock from a gauge keeps working without a density, a volume, or a capacity', () => {
  const noDensity = stockFromGauge(1000, undefined, { capacityLitre: 5000, volumeLitre: 2500 })
  assert.equal(noDensity.capacityKg, null)
  assert.equal(noDensity.emptySpaceKg, null)
  assert.equal(noDensity.levelRatio, 0.5, 'volume over capacity needs no density')
  const noCapacity = stockFromGauge(1000, undefined, { volumeLitre: 2500, densityKgM3: 900 })
  assert.deepEqual([noCapacity.capacityKg, noCapacity.levelRatio, noCapacity.emptySpaceKg], [null, null, null])
  const notInUse = stockFromGauge(0, undefined, { capacityLitre: 0, densityKgM3: 900, volumeLitre: 0 })
  assert.equal(notInUse.capacityKg, null, 'a capacity of 0 means the slot is not in use')
  assert.equal(notInUse.levelRatio, null)
})

test('a capacity saved in the master beats the gauge, and a bottom stock gives loadable stock', () => {
  const s = stockFromGauge(600000, { capacityKg: 1000000, bottomStockKg: 50000 }, { capacityLitre: 5000000, volumeLitre: 1, densityKgM3: 900 })
  assert.equal(s.capacityKg, 1000000)
  assert.equal(s.levelRatio, 0.6)
  assert.equal(s.emptySpaceKg, 400000)
  assert.equal(s.loadableKg, 550000)
})

test('Bontang products land in a sensible family, and Bekasi products keep theirs', () => {
  const expected = {
    RBDPO: 'RPO', RBDPL: 'RPL', CPO: 'CPO', PFAD: 'PFAD', RPOME: 'UNKNOWN', POME: 'UNKNOWN',
    CPKO: 'UNKNOWN', RBDPKO: 'UNKNOWN', PKFAD: 'UNKNOWN', METHANOL: 'UNKNOWN',
    OLEIN: 'OLEIN', 'IV 64': 'OLEIN', RPO: 'RPO', RPL: 'RPL', SLUDGE: 'SLUDGE', RPS: 'RPS', PMF: 'PMF',
  }
  for (const [product, family] of Object.entries(expected)) assert.equal(oilFamilyOf(product), family, product)
})

test('a faulty gauge borrows its last good density, or the average of its group', () => {
  const rows = withReferenceDensity([
    { code: 'A', stock_group: 'CPO', ref_density_kg_m3: 890 },
    { code: 'B', stock_group: 'CPO', ref_density_kg_m3: 900 },
    { code: 'C', stock_group: 'CPO', ref_density_kg_m3: null },
    { code: 'D', stock_group: null, ref_density_kg_m3: null },
    { code: 'E', stock_group: 'FAME', ref_density_kg_m3: null },
  ])
  const d = Object.fromEntries(rows.map((r) => [r.code, r.ref_density_kg_m3]))
  assert.deepEqual([d.A, d.B, d.C, d.D, d.E], [890, 900, 895, null, null])
})
