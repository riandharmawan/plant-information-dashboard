import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(here, '../.env') })
dotenv.config({ path: path.resolve(here, '../../.env.dev') })

if (!process.env.DATABASE_URL) {
  const user = process.env.POSTGRES_USER
  const password = process.env.POSTGRES_PASSWORD
  const database = process.env.POSTGRES_DB || 'pid_db'
  if (user && password) {
    process.env.DATABASE_URL = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:5437/${database}`
  }
}

const { pool } = await import('../src/db.js')
const { ingestUtilityDays } = await import('../src/ingestUtility.js')

const chunks = []
for await (const chunk of process.stdin) chunks.push(chunk)
const raw = Buffer.concat(chunks).toString('utf8').trim()
if (!raw) throw new Error('Utility ingest expected a JSON payload on stdin')

try {
  const detail = await ingestUtilityDays(JSON.parse(raw))
  console.log(JSON.stringify(detail))
} finally {
  await pool.end()
}
