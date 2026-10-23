import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const frontend = path.resolve(here, '..')
const reportDir = path.resolve(here, '../../Docs/exports/logsheet-sync')

export const jobs = [
  { name: 'sounding', script: 'sync-sounding.mjs' },
  { name: 'tnf004', script: 'sync-tnf004.mjs' },
  { name: 'rfa004a', script: 'sync-rfa004a.mjs' },
  { name: 'rfa004b', script: 'sync-rfa004b.mjs' },
  { name: 'analytical', script: 'sync-analytical.mjs' },
  { name: 'refinery-quality', script: 'sync-refinery-quality.mjs' },
  { name: 'utility', script: 'sync-utility.mjs' },
]

function flagValue(argv, name) {
  const index = argv.indexOf(name)
  if (index < 0) return null
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) return null
  return value
}

export function forwardedArgs(argv) {
  const args = []
  for (const name of ['--from', '--to']) {
    const value = flagValue(argv, name)
    if (value) args.push(name, value)
  }
  return args
}

function plantStamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')} WIB`
}

function seconds(durationMs) {
  return Math.max(0, Math.round(durationMs / 1000))
}

export function reportText(report) {
  const lines = [
    `Status: ${report.status}`,
    `Finished: ${report.ranAt}`,
    `Duration: ${seconds(report.durationMs)}s`,
    '',
    'Jobs',
  ]
  for (const job of report.jobs) {
    const exit = job.exitCode == null ? 'n/a' : String(job.exitCode)
    lines.push(`${job.name.padEnd(18)}  ${job.status.padEnd(6)}  exit ${exit.padEnd(4)}  ${seconds(job.durationMs)}s`)
    if (job.error) lines.push(`  ${job.error}`)
  }
  lines.push('')
  return `${lines.join('\n')}\n`
}

export function writeSummary(report, dir = reportDir) {
  const text = reportText(report)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'sync-report.txt'), text)
  fs.appendFileSync(path.join(dir, 'sync.log'), `${text}---\n`)
  fs.writeFileSync(path.join(dir, 'last-sync.json'), JSON.stringify({
    ranAt: report.ranAt,
    status: report.status,
    durationMs: report.durationMs,
    jobs: report.jobs.map((job) => ({
      name: job.name,
      exitCode: job.exitCode,
      durationMs: job.durationMs,
      status: job.status,
      ...(job.error ? { error: job.error } : {}),
    })),
  }, null, 2))
  return text
}

export function runJob(job, extraArgs) {
  const script = path.isAbsolute(job.script) ? job.script : path.join(here, job.script)
  const started = Date.now()
  console.log(`\n--- ${job.name} ---\n`)
  const result = spawnSync(process.execPath, [script, ...extraArgs], {
    cwd: frontend,
    stdio: 'inherit',
  })
  const durationMs = Date.now() - started
  const exitCode = result.status
  const error = result.error ? result.error.message : null
  const status = exitCode === 0 ? 'OK' : 'FAILED'
  return { name: job.name, exitCode, durationMs, status, ...(error ? { error } : {}) }
}

export function runAll(jobList, argv, dir = reportDir) {
  const started = Date.now()
  const extraArgs = forwardedArgs(argv)
  const results = []
  for (const job of jobList) {
    results.push(runJob(job, extraArgs))
  }
  const report = {
    ranAt: plantStamp(),
    status: results.some((job) => job.status !== 'OK') ? 'FAILED' : 'OK',
    durationMs: Date.now() - started,
    jobs: results,
  }
  const text = writeSummary(report, dir)
  console.log(text)
  console.log(`Report: ${path.join(dir, 'sync-report.txt')}`)
  console.log(`Log: ${path.join(dir, 'sync.log')}`)
  return report
}

function isDirectRun() {
  const entry = process.argv[1]
  if (!entry) return false
  return path.resolve(entry).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()
}

if (isDirectRun()) {
  const report = runAll(jobs, process.argv)
  if (report.status !== 'OK') process.exitCode = 1
}
