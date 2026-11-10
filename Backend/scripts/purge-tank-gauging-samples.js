/**
 * Archive old gauge samples, then delete archived ones past the grace period. Schedule it daily.
 *
 *   node scripts/purge-tank-gauging-samples.js
 *
 * TANK_GAUGING_SAMPLE_ACTIVE_DAYS (default 30) and TANK_GAUGING_SAMPLE_ARCHIVE_DAYS (default 7).
 */
import dotenv from 'dotenv'
import pg from 'pg'
import { purgeSamples } from '../src/tankgauging/purge.js'

dotenv.config()

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
try {
  console.log(JSON.stringify(await purgeSamples(pool), null, 2))
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await pool.end()
}
