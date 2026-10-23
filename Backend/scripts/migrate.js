import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config()

const here = path.dirname(fileURLToPath(import.meta.url))
const dir = path.join(here, '../migrations')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

await pool.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`)

const applied = await pool.query('SELECT id FROM schema_migrations')
const have = new Set(applied.rows.map((row) => row.id))
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()

for (const file of files) {
  if (have.has(file)) {
    console.log(`skip ${file}`)
    continue
  }
  const sql = fs.readFileSync(path.join(dir, file), 'utf8')
  await pool.query(sql)
  await pool.query('INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING', [file])
  console.log(`applied ${file}`)
}

await pool.end()
