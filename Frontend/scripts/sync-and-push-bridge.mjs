// For a PC with no local database: download new logsheet days and send them
// straight to staging. Staging does the database write, not this PC.
// BRIDGE_MODE=1 is read by bridge-mode.mjs inside each sync-*.mjs job and makes
// it skip every local database read and write. The child jobs inherit this from
// process.env, since sync-all.mjs spawns them without overriding env.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pushStaging } from './push-staging.mjs'
import { jobs, runAll } from './sync-all.mjs'

process.env.BRIDGE_MODE = '1'

function isDirectRun() {
  const entry = process.argv[1]
  if (!entry) return false
  return path.resolve(entry).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()
}

if (isDirectRun()) {
  const report = runAll(jobs, process.argv)
  const push = pushStaging()
  if (report.status !== 'OK' || push.status !== 'OK') process.exitCode = 1
}
