/**
 * Poll the gauge systems every few minutes from this PC, for development.
 * On a server the schedule is cron (see Docs/Guide/TANK-GAUGING-POLLER-CRON.md). This is the same poll in a loop.
 *
 *   npm run poll:loop                 every 15 minutes until stopped (Ctrl+C)
 *   npm run poll:loop -- --every=5    every 5 minutes
 *   npm run poll:loop -- --siteId=bontang
 *
 * Reads DATABASE_URL and JWT_SECRET from Backend/.env or the environment. When they are missing it
 * reads the repo's .env.dev and points at the dev database published on 127.0.0.1:5437.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'
import { runTankGaugingPoll } from '../src/tankgauging/poll.js'

dotenv.config()

const here = path.dirname(fileURLToPath(import.meta.url))
const devFile = path.resolve(here, '../../.env.dev')
if ((!process.env.DATABASE_URL || !process.env.JWT_SECRET) && fs.existsSync(devFile)) {
  const dev = dotenv.parse(fs.readFileSync(devFile))
  process.env.JWT_SECRET ||= dev.JWT_SECRET
  process.env.DATABASE_URL ||=
    `postgresql://${dev.POSTGRES_USER || 'pid_user'}:${encodeURIComponent(dev.POSTGRES_PASSWORD || '')}@127.0.0.1:5437/${dev.POSTGRES_DB || 'pid_db'}`
}
if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  console.error('Set DATABASE_URL and JWT_SECRET, or run from a checkout that has .env.dev.')
  process.exit(1)
}

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null
const everyMinutes = Math.max(1, Number(arg('every') ?? 15) || 15)
const siteId = arg('siteId') ?? undefined
const once = process.argv.includes('--once')

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
let stopping = false
let timer = null

function stamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

async function runOnce() {
  try {
    const result = await runTankGaugingPoll(pool, { siteId })
    if (result.skipped) {
      console.log(`${stamp()}  skipped: ${result.reason}`)
      return
    }
    const failed = result.sources.filter((s) => !s.ok)
    const rounds = result.rounds.reduce((n, r) => n + (r.written ?? 0), 0)
    console.log(
      `${stamp()}  ${result.ok ? 'ok' : 'PROBLEM'}  sources=${result.sourceCount}  readings=${result.stored}  rounds=${rounds}` +
        (failed.length ? `  failed: ${failed.map((s) => `${s.sourceBaseUrl} (${s.error})`).join('; ')}` : ''),
    )
  } catch (error) {
    console.error(`${stamp()}  error: ${error?.message || error}`)
  }
}

async function loop() {
  await runOnce()
  if (once || stopping) return shutdown()
  timer = setTimeout(loop, everyMinutes * 60000)
}

async function shutdown() {
  stopping = true
  if (timer) clearTimeout(timer)
  await pool.end().catch(() => {})
}

process.on('SIGINT', () => {
  console.log(`${stamp()}  stopping`)
  void shutdown()
})

console.log(`${stamp()}  polling ${siteId ?? 'every site'} every ${everyMinutes} min. Ctrl+C to stop.`)
void loop()
