import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pushStaging } from './push-staging.mjs'
import { jobs, runAll } from './sync-all.mjs'

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
