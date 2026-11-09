/**
 * Company, Site and Plant sync: plan, stage, apply.
 *
 * Pull the hub snapshot, compare it with the local rows, stage the differences
 * as a run, let a user approve or reject each item, then apply the approved ones.
 * Sync order matters: companies, then sites, then plants. A site or plant whose
 * parent is not linked yet fails its own item and can be retried after the
 * parent has been applied.
 *
 * Local-only columns are never touched by a sync: sites.timezone and companies.code
 * on existing rows.
 */
import { fetchEntityRecords } from './client.js'

export const ENTITY_TYPES = ['company', 'site', 'plant']

const DEFAULT_TIMEZONE = 'Asia/Jakarta'

export const ENTITIES = {
  company: {
    table: 'companies',
    columns: ['name', 'short_name', 'company_code_sap', 'country', 'is_active'],
    parent: null,
    label: 'Company',
  },
  site: {
    table: 'sites',
    columns: ['name', 'address', 'is_active'],
    parent: { entity: 'company', column: 'company_id' },
    label: 'Site',
  },
  plant: {
    table: 'plants',
    columns: ['name', 'is_active'],
    parent: { entity: 'site', column: 'site_id' },
    label: 'Plant',
  },
}

function key(value) {
  return String(value ?? '').trim().toUpperCase()
}

function norm(column, value) {
  if (column === 'is_active') return value == null ? null : Boolean(value)
  if (value == null || value === '') return null
  return String(value).trim()
}

export function diffFields(columns, local, hubValues) {
  const diff = {}
  for (const column of columns) {
    const from = norm(column, local?.[column])
    const to = norm(column, hubValues?.[column])
    if (from !== to) diff[column] = { from, to }
  }
  return diff
}

export function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Index parent rows by hub record id and hub code, so a reference of either kind resolves. */
export function buildParentIndex(parentRows) {
  const index = new Map()
  for (const row of parentRows ?? []) {
    if (row.hub_record_id) index.set(key(row.hub_record_id), row.id)
    if (row.hub_code) index.set(key(row.hub_code), row.id)
  }
  return index
}

/**
 * Pure. Compare hub records with local rows.
 * @param {'company'|'site'|'plant'} entity
 * @param {Array} hubRecords normalized hub records
 * @param {Array} localRows rows of the entity table
 * @param {Array} parentRows rows of the parent table (id, hub_code, hub_record_id)
 */
export function buildPlan(entity, hubRecords, localRows, parentRows = []) {
  const def = ENTITIES[entity]
  const parentIndex = buildParentIndex(parentRows)
  const byCode = new Map()
  const byRecord = new Map()
  const byName = new Map()
  const nameKey = (row) =>
    def.parent ? `${row[def.parent.column]}|${key(row.name)}` : key(row.name)

  for (const row of localRows ?? []) {
    if (row.hub_code) byCode.set(key(row.hub_code), row)
    if (row.hub_record_id) byRecord.set(key(row.hub_record_id), row)
    if (!row.hub_code) byName.set(nameKey(row), row)
  }

  const items = []
  let skippedDeleted = 0

  for (const hub of hubRecords ?? []) {
    const parentLocalId = def.parent && hub.parentRef ? parentIndex.get(key(hub.parentRef)) ?? null : null
    const linked =
      (hub.hubCode ? byCode.get(key(hub.hubCode)) : null) ??
      (hub.hubRecordId ? byRecord.get(key(hub.hubRecordId)) : null) ??
      null

    let local = linked
    if (!local) {
      if (hub.isDeleted) {
        skippedDeleted += 1
        continue
      }
      const candidate = def.parent
        ? parentLocalId != null
          ? byName.get(`${parentLocalId}|${key(hub.values.name)}`)
          : null
        : byName.get(key(hub.values.name))
      local = candidate ?? null
    }

    // A hub deletion is a tombstone: keep the local row, mark it inactive.
    const values = hub.isDeleted ? { ...hub.values, is_active: false } : hub.values

    const base = {
      hubCode: hub.hubCode,
      hubRecordId: hub.hubRecordId,
      hubVersion: hub.hubVersion,
      hubUpdatedAt: hub.hubUpdatedAt,
      label: values.name,
      values,
      parentRef: hub.parentRef ?? null,
      parentLocalId,
      parentMissing: Boolean(def.parent && hub.parentRef && parentLocalId == null),
    }

    if (!local) {
      items.push({ ...base, localId: null, diffKind: 'new', fieldDiff: diffFields(def.columns, {}, values) })
      continue
    }

    const fieldDiff = diffFields(def.columns, local, values)
    if (def.parent && parentLocalId != null && String(local[def.parent.column]) !== String(parentLocalId)) {
      fieldDiff.parent = { from: local[def.parent.column], to: parentLocalId }
    }
    const linkChanged = Boolean(hub.hubCode) && key(local.hub_code) !== key(hub.hubCode)
    const changed = Object.keys(fieldDiff).length > 0 || linkChanged
    items.push({
      ...base,
      hubCode: hub.hubCode ?? local.hub_code ?? null,
      localId: local.id,
      diffKind: changed ? 'changed' : 'unchanged',
      fieldDiff,
    })
  }

  const count = (kind) => items.filter((item) => item.diffKind === kind).length
  return {
    items,
    summary: {
      hubRecordCount: (hubRecords ?? []).length,
      newCount: count('new'),
      changedCount: count('changed'),
      unchangedCount: count('unchanged'),
      skippedDeleted,
    },
  }
}

async function loadLocal(db, entity) {
  const def = ENTITIES[entity]
  const r = await db.query(`SELECT * FROM ${def.table}`)
  return r.rows
}

async function loadParents(db, entity) {
  const parent = ENTITIES[entity].parent
  if (!parent) return []
  const r = await db.query(`SELECT id, hub_code, hub_record_id FROM ${ENTITIES[parent.entity].table}`)
  return r.rows
}

/** Pull from DataHub and stage the differences. Returns runId null when nothing needs doing. */
export async function pullAndStage(db, cfg, entity, opts = {}) {
  if (!ENTITIES[entity]) throw new Error(`Unsupported entity type: ${entity}`)
  const hubRecords = await (opts.fetchRecords ?? fetchEntityRecords)(cfg, entity)
  const plan = buildPlan(entity, hubRecords, await loadLocal(db, entity), await loadParents(db, entity))
  const actionable = plan.items.filter((item) => item.diffKind !== 'unchanged')
  if (actionable.length === 0) return { runId: null, summary: plan.summary, items: [] }

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const run = await client.query(
      `INSERT INTO datahub_sync_runs
         (entity_type, hub_record_count, new_count, changed_count, unchanged_count, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [
        entity,
        plan.summary.hubRecordCount,
        plan.summary.newCount,
        plan.summary.changedCount,
        plan.summary.unchangedCount,
        opts.createdBy ?? null,
      ],
    )
    const runId = Number(run.rows[0].id)
    for (const item of actionable) {
      await client.query(
        `INSERT INTO datahub_sync_items
           (run_id, local_id, hub_code, label, diff_kind, decision, field_diff, payload)
         VALUES ($1,$2,$3,$4,$5,'approved',$6,$7)`,
        [runId, item.localId, item.hubCode, item.label, item.diffKind, item.fieldDiff, item],
      )
    }
    await client.query('COMMIT')
    return { runId, summary: plan.summary, items: actionable }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function resolveParent(db, entity, payload) {
  const def = ENTITIES[entity]
  if (!def.parent) return null
  if (payload.parentLocalId != null) return payload.parentLocalId
  if (!payload.parentRef) return null
  const parentTable = ENTITIES[def.parent.entity].table
  const r = await db.query(
    `SELECT id FROM ${parentTable} WHERE UPPER(hub_record_id) = UPPER($1) OR UPPER(hub_code) = UPPER($1) LIMIT 1`,
    [payload.parentRef],
  )
  return r.rows[0]?.id ?? null
}

async function uniqueId(db, table, base) {
  let id = base || 'item'
  for (let n = 2; ; n += 1) {
    const r = await db.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id])
    if (r.rows.length === 0) return id
    id = `${base}-${n}`
  }
}

async function findTarget(db, def, item, parentId) {
  const payload = item.payload
  if (item.local_id != null) {
    const r = await db.query(`SELECT id FROM ${def.table} WHERE id = $1`, [item.local_id])
    if (r.rows[0]) return r.rows[0].id
  }
  if (payload.hubCode) {
    const r = await db.query(`SELECT id FROM ${def.table} WHERE UPPER(hub_code) = UPPER($1)`, [payload.hubCode])
    if (r.rows[0]) return r.rows[0].id
  }
  return null
}

/** Apply one staged item. Throws on a conflict so the caller can record it. */
export async function applyItem(db, entity, item, actorId, opts = {}) {
  const def = ENTITIES[entity]
  const payload = item.payload || {}
  const values = payload.values || {}
  const name = String(values.name ?? '').trim()
  if (!name) throw new Error(`${def.label} name is required`)

  const parentId = await resolveParent(db, entity, payload)
  if (def.parent && parentId == null) {
    throw new Error(`${ENTITIES[def.parent.entity].label} ${payload.parentRef ?? ''} is not synced yet. Apply the ${def.parent.entity} sync first.`.replace('  ', ' '))
  }

  const link = [
    payload.hubCode ?? null,
    payload.hubRecordId ?? null,
    payload.hubVersion ?? null,
    payload.hubUpdatedAt ?? null,
    opts.source ?? 'manual_sync',
    opts.runId != null ? Number(opts.runId) : null,
    actorId == null ? null : String(actorId),
  ]
  const isActive = values.is_active !== false
  const targetId = await findTarget(db, def, item, parentId)

  if (entity === 'company') {
    const shortName = values.short_name ?? null
    const sap = values.company_code_sap ?? null
    const country = values.country ?? null
    if (targetId == null) {
      const id = await uniqueId(db, 'companies', slugify(name))
      let code = key(shortName || payload.hubCode || id)
      const taken = await db.query('SELECT 1 FROM companies WHERE code = $1', [code])
      if (taken.rows.length) code = key(`${code}-${payload.hubCode ?? id}`)
      await db.query(
        `INSERT INTO companies
           (id, code, name, short_name, company_code_sap, country, is_active,
            hub_code, hub_record_id, hub_version, hub_updated_at,
            datahub_last_apply_source, datahub_last_apply_run_id, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [id, code, name, shortName, sap, country, isActive, ...link],
      )
      return { action: 'created', id }
    }
    await db.query(
      `UPDATE companies SET name=$1, short_name=$2, company_code_sap=$3, country=$4, is_active=$5,
         hub_code=COALESCE($6,hub_code), hub_record_id=COALESCE($7,hub_record_id),
         hub_version=COALESCE($8,hub_version), hub_updated_at=COALESCE($9::timestamptz,hub_updated_at),
         datahub_last_apply_source=$10, datahub_last_apply_run_id=$11, updated_by=$12, updated_at=NOW()
       WHERE id=$13`,
      [name, shortName, sap, country, isActive, ...link, targetId],
    )
    return { action: 'updated', id: targetId }
  }

  if (entity === 'site') {
    const address = values.address ?? null
    if (targetId == null) {
      const id = await uniqueId(db, 'sites', slugify(name))
      await db.query(
        `INSERT INTO sites
           (id, company_id, name, timezone, address, is_active,
            hub_code, hub_record_id, hub_version, hub_updated_at,
            datahub_last_apply_source, datahub_last_apply_run_id, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [id, parentId, name, DEFAULT_TIMEZONE, address, isActive, ...link],
      )
      return { action: 'created', id }
    }
    await db.query(
      `UPDATE sites SET company_id=$1, name=$2, address=$3, is_active=$4,
         hub_code=COALESCE($5,hub_code), hub_record_id=COALESCE($6,hub_record_id),
         hub_version=COALESCE($7,hub_version), hub_updated_at=COALESCE($8::timestamptz,hub_updated_at),
         datahub_last_apply_source=$9, datahub_last_apply_run_id=$10, updated_by=$11, updated_at=NOW()
       WHERE id=$12`,
      [parentId, name, address, isActive, ...link, targetId],
    )
    return { action: 'updated', id: targetId }
  }

  // plant
  if (targetId == null) {
    const id = await uniqueId(db, 'plants', slugify(name))
    await db.query(
      `INSERT INTO plants
         (id, site_id, name, is_active,
          hub_code, hub_record_id, hub_version, hub_updated_at,
          datahub_last_apply_source, datahub_last_apply_run_id, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, parentId, name, isActive, ...link],
    )
    return { action: 'created', id }
  }
  await db.query(
    `UPDATE plants SET site_id=$1, name=$2, is_active=$3,
       hub_code=COALESCE($4,hub_code), hub_record_id=COALESCE($5,hub_record_id),
       hub_version=COALESCE($6,hub_version), hub_updated_at=COALESCE($7::timestamptz,hub_updated_at),
       datahub_last_apply_source=$8, datahub_last_apply_run_id=$9, updated_by=$10, updated_at=NOW()
     WHERE id=$11`,
    [parentId, name, isActive, ...link, targetId],
  )
  return { action: 'updated', id: targetId }
}

/** Apply every approved item of a staged run. A failing item is recorded and does not stop the rest. */
export async function applyRun(pool, runId, actorId = null) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const run = await client.query('SELECT * FROM datahub_sync_runs WHERE id = $1 FOR UPDATE', [runId])
    if (run.rows.length === 0) {
      await client.query('ROLLBACK')
      return { notFound: true }
    }
    if (run.rows[0].status !== 'staged') {
      await client.query('ROLLBACK')
      return { conflict: run.rows[0].status }
    }
    const entity = run.rows[0].entity_type
    const items = await client.query(
      `SELECT * FROM datahub_sync_items
       WHERE run_id = $1 AND decision = 'approved' AND applied_at IS NULL
       ORDER BY id`,
      [runId],
    )
    let created = 0
    let updated = 0
    let failed = 0
    for (const item of items.rows) {
      await client.query('SAVEPOINT item')
      try {
        const result = await applyItem(client, entity, item, actorId, { source: 'manual_sync', runId })
        await client.query('RELEASE SAVEPOINT item')
        await client.query('UPDATE datahub_sync_items SET applied_at = NOW(), apply_error = NULL WHERE id = $1', [item.id])
        if (result.action === 'created') created += 1
        else updated += 1
      } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT item')
        await client.query('UPDATE datahub_sync_items SET apply_error = $2 WHERE id = $1', [
          item.id,
          String(error?.message || 'apply failed').slice(0, 1000),
        ])
        failed += 1
      }
    }
    const applied = created + updated
    await client.query(
      `UPDATE datahub_sync_runs
       SET status = $2, applied_count = $3, applied_at = NOW(), error = $4
       WHERE id = $1`,
      [runId, applied === 0 && failed > 0 ? 'failed' : 'applied', applied, failed ? `${failed} item(s) failed` : null],
    )
    await client.query('COMMIT')
    return { created, updated, failed }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/** Link a local row to a hub code by hand, for rows whose names differ from the hub. */
export async function linkLocalRow(db, entity, localId, hubCode) {
  const def = ENTITIES[entity]
  const code = String(hubCode ?? '').trim()
  if (!def || !code || !localId) {
    const err = new Error('entity, localId and hubCode are required')
    err.status = 400
    throw err
  }
  const taken = await db.query(`SELECT id FROM ${def.table} WHERE UPPER(hub_code) = UPPER($1) AND id <> $2`, [code, localId])
  if (taken.rows.length) {
    const err = new Error(`Hub code ${code} is already linked to ${taken.rows[0].id}`)
    err.status = 409
    throw err
  }
  const r = await db.query(`UPDATE ${def.table} SET hub_code = $1, updated_at = NOW() WHERE id = $2 RETURNING id`, [code, localId])
  if (r.rows.length === 0) {
    const err = new Error('Record not found')
    err.status = 404
    throw err
  }
  return { id: r.rows[0].id, hubCode: code }
}
