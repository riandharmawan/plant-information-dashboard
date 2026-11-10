/**
 * One poll of every enabled gauge source, then the daily rounds. Schedule it with cron.
 *
 *   node scripts/run-tank-gauging-poll.js [--siteId=bontang] [--no-rounds]
 *
 * Prints a JSON summary. Exit code 1 when a source failed, so a scheduler can alert on it.
 */
import dotenv from 'dotenv'
import pg from 'pg'
import { runTankGaugingPoll } from '../src/tankgauging/poll.js'

dotenv.config()

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

try {
  const result = await runTankGaugingPoll(pool, { siteId: arg('siteId') ?? undefined, rounds: !process.argv.includes('--no-rounds') })
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = result.skipped ? 0 : result.ok ? 0 : 1
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await pool.end()
}
