import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clearTokenCache,
  fetchEntityRecords,
  normalizeCompany,
  normalizePlant,
  normalizeSite,
  parseExpiresInSeconds,
  referenceOf,
} from './client.js'
import { buildPlan, diffFields, slugify } from './sync.js'

const record = (data, extra = {}) => ({ id: `uuid-${data.code}`, version: 1, updatedAt: '2026-10-15T00:00:00Z', data, ...extra })

test('normalizers read the hub field names', () => {
  const company = normalizeCompany(record({ code: 'ORG-0007', name: 'PT Priscolin', short_name: 'PRC', company_code_sap: 'PS', country: 'Indonesia' }))
  assert.equal(company.hubCode, 'ORG-0007')
  assert.deepEqual(company.values, { name: 'PT Priscolin', short_name: 'PRC', company_code_sap: 'PS', country: 'Indonesia', is_active: true })

  const site = normalizeSite(record({ code: 'SITE-0026', name: 'BEKASI', organization_id: 'ORG-0007', address: 'Bekasi' }))
  assert.equal(site.parentRef, 'ORG-0007')
  assert.equal(site.values.address, 'Bekasi')

  const plant = normalizePlant(record({ code: 'PLT-0001', name: 'RFI PROJ', site_id: { id: 'uuid-site' }, is_active: false }))
  assert.equal(plant.parentRef, 'uuid-site')
  assert.equal(plant.values.is_active, false)
  assert.equal(normalizeCompany(record({ code: 'X' })), null)
})

test('referenceOf accepts a string or an object', () => {
  assert.equal(referenceOf(' ORG-1 '), 'ORG-1')
  assert.equal(referenceOf({ code: 'ORG-1' }), 'ORG-1')
  assert.equal(referenceOf(null), null)
})

test('parseExpiresInSeconds understands durations', () => {
  assert.equal(parseExpiresInSeconds('8h'), 28800)
  assert.equal(parseExpiresInSeconds(120), 120)
  assert.equal(parseExpiresInSeconds('nonsense'), 3600)
})

test('slugify makes stable text ids', () => {
  assert.equal(slugify('PRC PALM & LAURIC BEKASI'), 'prc-palm-and-lauric-bekasi')
})

test('diffFields ignores blanks and whitespace', () => {
  assert.deepEqual(diffFields(['name', 'country'], { name: 'A ', country: '' }, { name: 'A', country: null }), {})
  assert.deepEqual(diffFields(['name'], { name: 'A' }, { name: 'B' }), { name: { from: 'A', to: 'B' } })
})

test('company plan: link by hub code, then by name, else new', () => {
  const hub = [
    normalizeCompany(record({ code: 'ORG-0001', name: 'Linked Co', country: 'ID' })),
    normalizeCompany(record({ code: 'ORG-0002', name: 'Name Match' })),
    normalizeCompany(record({ code: 'ORG-0003', name: 'Brand New' })),
    normalizeCompany(record({ code: 'ORG-0004', name: 'Same' })),
  ]
  const local = [
    { id: 'linked', hub_code: 'ORG-0001', name: 'Linked Co', country: null, is_active: true },
    { id: 'byname', hub_code: null, name: 'name match', is_active: true },
    { id: 'same', hub_code: 'ORG-0004', name: 'Same', is_active: true },
  ]
  const { items, summary } = buildPlan('company', hub, local)
  const byCode = Object.fromEntries(items.map((i) => [i.hubCode, i]))
  assert.equal(byCode['ORG-0001'].diffKind, 'changed')
  assert.deepEqual(byCode['ORG-0001'].fieldDiff.country, { from: null, to: 'ID' })
  assert.equal(byCode['ORG-0002'].localId, 'byname')
  assert.equal(byCode['ORG-0002'].diffKind, 'changed')
  assert.equal(byCode['ORG-0003'].diffKind, 'new')
  assert.equal(byCode['ORG-0004'].diffKind, 'unchanged')
  assert.deepEqual([summary.newCount, summary.changedCount, summary.unchangedCount], [1, 2, 1])
})

test('site plan resolves the parent company and flags a missing one', () => {
  const companies = [{ id: 'prc', hub_code: 'ORG-0007', hub_record_id: 'uuid-ORG-0007' }]
  const hub = [
    normalizeSite(record({ code: 'SITE-0026', name: 'BEKASI', organization_id: 'ORG-0007' })),
    normalizeSite(record({ code: 'SITE-0099', name: 'ORPHAN', organization_id: 'ORG-9999' })),
  ]
  const local = [{ id: 'bekasi', company_id: 'old-co', name: 'Bekasi', hub_code: null, is_active: true, address: null }]
  const { items } = buildPlan('site', hub, local, companies)
  const bekasi = items.find((i) => i.hubCode === 'SITE-0026')
  assert.equal(bekasi.parentLocalId, 'prc')
  assert.equal(bekasi.parentMissing, false)
  assert.equal(bekasi.diffKind, 'new', 'name match needs the same company, so a moved site stays separate')
  const orphan = items.find((i) => i.hubCode === 'SITE-0099')
  assert.equal(orphan.parentMissing, true)
})

test('site plan matches by name inside the same company', () => {
  const companies = [{ id: 'prc', hub_code: 'ORG-0007', hub_record_id: null }]
  const hub = [normalizeSite(record({ code: 'SITE-0026', name: 'Bekasi', organization_id: 'ORG-0007' }))]
  const local = [{ id: 'bekasi', company_id: 'prc', name: 'BEKASI', hub_code: null, is_active: true, address: null }]
  const { items } = buildPlan('site', hub, local, companies)
  assert.equal(items[0].localId, 'bekasi')
  assert.equal(items[0].diffKind, 'changed')
})

test('a hub deletion deactivates a linked row and is ignored when unlinked', () => {
  const hub = [
    normalizePlant(record({ code: 'PLT-1', name: 'Old', site_id: 'SITE-1' }, { isDeleted: true })),
    normalizePlant(record({ code: 'PLT-2', name: 'Never Seen', site_id: 'SITE-1' }, { isDeleted: true })),
  ]
  const sites = [{ id: 'bekasi', hub_code: 'SITE-1', hub_record_id: null }]
  const local = [{ id: 'old', site_id: 'bekasi', name: 'Old', hub_code: 'PLT-1', is_active: true }]
  const { items, summary } = buildPlan('plant', hub, local, sites)
  assert.equal(items.length, 1)
  assert.equal(items[0].values.is_active, false)
  assert.equal(items[0].diffKind, 'changed')
  assert.equal(summary.skippedDeleted, 1)
})

test('fetchEntityRecords follows the cursor and uses the app token', async () => {
  clearTokenCache()
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, auth: init.headers.Authorization ?? null })
    const json = (body) => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), text: async () => JSON.stringify(body) })
    if (url.endsWith('/auth/token')) return json({ token: 'tok', expiresIn: '8h' })
    if (url.includes('cursor=')) return json({ records: [record({ code: 'ORG-2', name: 'Two' })], hasMore: false })
    return json({ records: [record({ code: 'ORG-1', name: 'One' })], hasMore: true, nextCursor: 'abc' })
  }
  const cfg = { baseUrl: 'http://hub.test', publicKey: 'pk', privateKey: 'sk' }
  const records = await fetchEntityRecords(cfg, 'company', fetchImpl)
  assert.deepEqual(records.map((r) => r.hubCode), ['ORG-1', 'ORG-2'])
  assert.equal(calls.filter((c) => c.url.endsWith('/auth/token')).length, 1)
  assert.equal(calls.at(-1).auth, 'Bearer tok')
  assert.ok(calls[1].url.includes('/v1/sync/company?limit=500'))
})

test('company falls back to the organization slug on 404', async () => {
  clearTokenCache()
  const seen = []
  const fetchImpl = async (url) => {
    seen.push(url)
    const reply = (status, body) => ({ ok: status < 400, status, headers: new Headers({ 'content-type': 'application/json' }), text: async () => JSON.stringify(body) })
    if (url.endsWith('/auth/token')) return reply(404, { error: 'not found' })
    if (url.includes('/v1/sync/company')) return reply(404, { error: 'unknown' })
    return reply(200, { records: [record({ code: 'ORG-1', name: 'One' })], hasMore: false })
  }
  const records = await fetchEntityRecords({ baseUrl: 'http://hub.test', publicKey: 'pk', privateKey: 'sk' }, 'company', fetchImpl)
  assert.equal(records.length, 1)
  assert.ok(seen.some((u) => u.includes('/v1/sync/organization')))
})
