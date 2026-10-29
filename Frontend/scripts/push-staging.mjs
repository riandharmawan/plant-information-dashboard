import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { markSent, outboxRoot, pendingFiles } from './staging-outbox.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const frontend = path.resolve(here, '..')
const envFile = path.join(frontend, '.env.staging-push')
const reportFile = path.join(outboxRoot, 'push-report.txt')
const logFile = path.join(outboxRoot, 'push-log.txt')
const sshOpts = ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new']

function loadEnvFile(file, into) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    into[key] = value
  }
}

function applyEnv() {
  const fromFile = {}
  loadEnvFile(envFile, fromFile)
  for (const [key, value] of Object.entries(fromFile)) {
    if (!process.env[key]) process.env[key] = value
  }
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

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

function remotePath(repo, ...parts) {
  return [String(repo).replace(/\/$/, ''), ...parts].join('/')
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true })
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error ? result.error.message : null,
  }
}

function commandFailure(result, label) {
  if (result.error) return `${label} could not start. ${result.error}`
  const detail = (result.stderr || result.stdout || '').trim()
  return detail ? `${label} failed. ${detail}` : `${label} failed.`
}

function parseApplyResult(stdout) {
  const lines = stdout.trim().split(/\r?\n/).filter(Boolean)
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (!lines[index].startsWith('{')) continue
    try {
      const parsed = JSON.parse(lines[index])
      if (Array.isArray(parsed.applied) && Array.isArray(parsed.failed)) return parsed
    } catch {
      // Keep looking. Docker noise can share the stream.
    }
  }
  return null
}

function reportText(report) {
  const lines = [
    `Status: ${report.status}`,
    `Finished: ${report.ranAt}`,
    `Sent: ${report.sent.length}`,
    `Failed: ${report.failed.length}`,
    `Left in outbox: ${report.remaining}`,
    '',
  ]
  if (report.note) lines.push(report.note, '')
  if (report.sent.length > 0) {
    lines.push('Sent')
    for (const item of report.sent) lines.push(item)
    lines.push('')
  }
  if (report.failed.length > 0) {
    lines.push('Failed')
    for (const item of report.failed) lines.push(`${item.file}   ${item.reason}`)
    lines.push('')
  }
  lines.push('A file still in Docs/exports/staging-outbox has not been applied on staging.')
  lines.push('Applied files are under Docs/exports/staging-outbox/sent.')
  lines.push('')
  return `${lines.join('\n')}\n`
}

function writeReport(report) {
  const text = reportText(report)
  fs.mkdirSync(outboxRoot, { recursive: true })
  fs.writeFileSync(reportFile, text)
  fs.appendFileSync(logFile, `${text}---\n`)
  console.log(text)
  console.log(`Report: ${reportFile}`)
  return text
}

export function pushStaging() {
  applyEnv()
  const user = process.env.STAGING_SSH_USER
  const host = process.env.STAGING_SSH_HOST
  const repo = process.env.STAGING_REPO
  const pending = pendingFiles()
  const sent = []
  const failed = []

  function finish(status, note) {
    const report = {
      status,
      ranAt: plantStamp(),
      sent,
      failed,
      remaining: pendingFiles().length,
      note: note || null,
    }
    writeReport(report)
    return report
  }

  if (!user || !host || !repo) {
    failed.push({
      file: '-',
      reason: 'Set STAGING_SSH_USER, STAGING_SSH_HOST, and STAGING_REPO in Frontend/.env.staging-push.',
    })
    return finish('FAILED', 'Copy Frontend/.env.staging-push.example to Frontend/.env.staging-push.')
  }
  if (pending.length === 0) {
    return finish('OK', 'Nothing new to send.')
  }

  const target = `${user}@${host}`
  const inbox = remotePath(repo, 'staging-inbox')
  const dirs = [...new Set(pending.map((item) => remotePath(inbox, item.script)))]
  const mkdir = run('ssh', [
    ...sshOpts,
    target,
    `mkdir -p ${dirs.map(shQuote).join(' ')} ${shQuote(remotePath(inbox, 'applied'))}`,
  ])
  if (mkdir.status !== 0) {
    failed.push({ file: '-', reason: commandFailure(mkdir, 'SSH') })
    return finish('FAILED')
  }

  const copied = []
  for (const item of pending) {
    const destination = `${target}:${remotePath(inbox, item.script)}/`
    const copy = run('scp', [...sshOpts, item.file, destination])
    if (copy.status !== 0) {
      failed.push({ file: `${item.script}/${item.name}`, reason: commandFailure(copy, 'Copy') })
      continue
    }
    copied.push(item)
  }
  if (copied.length === 0) return finish('FAILED')

  const apply = run('ssh', [
    ...sshOpts,
    target,
    `bash ${shQuote(remotePath(repo, 'Backend/scripts/apply-staging-inbox.sh'))} ${shQuote(repo)}`,
  ])
  const result = parseApplyResult(apply.stdout)
  if (!result) {
    failed.push({ file: '-', reason: commandFailure(apply, 'Staging load') })
    return finish('FAILED')
  }
  const applied = new Set(result.applied)
  for (const item of copied) {
    const key = `${item.script}/${item.name}`
    if (!applied.has(key)) continue
    markSent(item.script, item.name)
    sent.push(key)
  }
  for (const item of result.failed) {
    failed.push({ file: item.file, reason: item.reason || 'Staging load failed.' })
  }
  if (apply.status !== 0 && result.failed.length === 0) {
    failed.push({ file: '-', reason: commandFailure(apply, 'Staging load') })
  }
  return finish(failed.length === 0 ? 'OK' : 'FAILED')
}

function isDirectRun() {
  const entry = process.argv[1]
  if (!entry) return false
  return path.resolve(entry).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()
}

if (isDirectRun()) {
  const report = pushStaging()
  if (report.status !== 'OK') process.exitCode = 1
}
