/**
 * Move every row that belongs to one plant over to another plant of the same site.
 *
 *   node scripts/move-plant-data.js --from priscolin-proj-bekasi --to prc-palm-lauric-bekasi          (dry run)
 *   node scripts/move-plant-data.js --from priscolin-proj-bekasi --to prc-palm-lauric-bekasi --apply
 *
 * The plant rows themselves stay. Only rows in tables with a plant_id column move, in one
 * transaction. Several tables link to each other on both the item and the plant, so row by row
 * checks would fail midway. Foreign key triggers are paused for the transaction (this needs a
 * database superuser), then every foreign key in the schema is re-checked before the commit.
 * The move is refused when the plants differ in site, or when moving a table's
 * rows would collide with rows the target plant already has.
 */
import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config()

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : null
}

const from = arg('from')
const to = arg('to')
const apply = process.argv.includes('--apply')

if (!from || !to || from === to) {
  console.error('Usage: node scripts/move-plant-data.js --from <plantId> --to <plantId> [--apply]')
  process.exit(1)
}

/** Count child rows with no matching parent, for every foreign key in the public schema. */
async function findOrphans(db) {
  const fks = await db.query(
    `SELECT con.conname AS name, con.conrelid::regclass::text AS child, con.confrelid::regclass::text AS parent,
            (SELECT string_agg(format('c.%I = p.%I', ca.attname, pa.attname), ' AND ')
               FROM unnest(con.conkey, con.confkey) AS k(ck, pk)
               JOIN pg_attribute ca ON ca.attrelid = con.conrelid AND ca.attnum = k.ck
               JOIN pg_attribute pa ON pa.attrelid = con.confrelid AND pa.attnum = k.pk) AS cond,
            (SELECT string_agg(format('c.%I IS NOT NULL', ca.attname), ' AND ')
               FROM unnest(con.conkey) AS k(ck)
               JOIN pg_attribute ca ON ca.attrelid = con.conrelid AND ca.attnum = k.ck) AS present
     FROM pg_constraint con
     WHERE con.contype = 'f' AND con.connamespace = 'public'::regnamespace`,
  )
  const bad = []
  for (const fk of fks.rows) {
    const r = await db.query(
      `SELECT count(*) FROM ${fk.child} c WHERE ${fk.present} AND NOT EXISTS (SELECT 1 FROM ${fk.parent} p WHERE ${fk.cond})`,
    )
    const count = Number(r.rows[0].count)
    if (count) bad.push({ name: fk.name, count })
  }
  return bad
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const client = await pool.connect()

try {
  const plants = await client.query('SELECT id, site_id, name, hub_code FROM plants WHERE id = ANY($1)', [[from, to]])
  const source = plants.rows.find((row) => row.id === from)
  const target = plants.rows.find((row) => row.id === to)
  if (!source || !target) throw new Error('Both plants must exist.')
  if (source.site_id !== target.site_id) {
    throw new Error(`Plants are in different sites (${source.site_id} and ${target.site_id}). Refusing to move.`)
  }
  console.log(`From: ${source.id} (${source.hub_code ?? 'no hub code'}) ${source.name}`)
  console.log(`To:   ${target.id} (${target.hub_code ?? 'no hub code'}) ${target.name}`)

  const tables = await client.query(
    `SELECT c.table_name
     FROM information_schema.columns c
     JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = 'public' AND c.column_name = 'plant_id' AND t.table_type = 'BASE TABLE'
     ORDER BY c.table_name`,
  )

  const plan = []
  for (const { table_name: table } of tables.rows) {
    const moving = Number((await client.query(`SELECT count(*) FROM "${table}" WHERE plant_id = $1`, [from])).rows[0].count)
    const already = Number((await client.query(`SELECT count(*) FROM "${table}" WHERE plant_id = $1`, [to])).rows[0].count)
    plan.push({ table, moving, already })
  }
  console.table(plan.filter((row) => row.moving > 0 || row.already > 0))

  const clash = plan.filter((row) => row.moving > 0 && row.already > 0)
  if (clash.length) {
    throw new Error(`Target plant already has rows in: ${clash.map((row) => row.table).join(', ')}. Refusing to merge.`)
  }

  const total = plan.reduce((sum, row) => sum + row.moving, 0)
  if (!apply) {
    console.log(`Dry run: ${total} rows would move. Add --apply to do it.`)
  } else {
    await client.query('BEGIN')
    await client.query("SET LOCAL session_replication_role = 'replica'")
    for (const row of plan.filter((r) => r.moving > 0)) {
      const result = await client.query(`UPDATE "${row.table}" SET plant_id = $2 WHERE plant_id = $1`, [from, to])
      if (result.rowCount !== row.moving) throw new Error(`${row.table}: expected ${row.moving} rows, moved ${result.rowCount}`)
    }
    for (const { table_name: table } of tables.rows) {
      const left = Number((await client.query(`SELECT count(*) FROM "${table}" WHERE plant_id = $1`, [from])).rows[0].count)
      if (left !== 0) throw new Error(`${table}: ${left} rows still on the old plant`)
    }
    const orphans = await findOrphans(client)
    if (orphans.length) {
      const lines = orphans.map((o) => `  ${o.name}: ${o.count} row(s)`)
      throw new Error(['Foreign key check failed, nothing was moved:', ...lines].join('\n'))
    }
    await client.query('COMMIT')
    console.log(`Moved ${total} rows from ${from} to ${to}.`)
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => {})
  console.error(error.message)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
