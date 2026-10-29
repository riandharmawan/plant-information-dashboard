import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { notifyRun } from './notify-run.mjs'
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
  const mail = await notifyRun(report, push)
  if (report.status !== 'OK' || push.status !== 'OK' || mail.status === 'FAILED') process.exitCode = 1
}
