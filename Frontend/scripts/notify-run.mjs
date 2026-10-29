import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nodemailer from 'nodemailer'
import { reportText } from './sync-all.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const frontend = path.resolve(here, '..')
const envFile = path.join(frontend, '.env')
const notifyLog = path.resolve(here, '../../Docs/exports/logsheet-sync/notify.log')

function loadEnvFile(file) {
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

function recipients(value) {
  return String(value ?? '')
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function mailSettings() {
  loadEnvFile(envFile)
  const port = Number(process.env.SMTP_PORT || 587)
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : port === 465
  return {
    host: process.env.SMTP_HOST || '',
    port: Number.isFinite(port) ? port : 587,
    secure,
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || '',
    to: recipients(process.env.SMTP_TO),
  }
}

function pushText(push) {
  const lines = [
    `Status: ${push.status}`,
    `Finished: ${push.ranAt}`,
    `Sent: ${push.sent?.length ?? 0}`,
    `Failed: ${push.failed?.length ?? 0}`,
    `Left in outbox: ${push.remaining ?? 0}`,
    '',
  ]
  if (push.note) lines.push(push.note, '')
  if (push.failed?.length) {
    lines.push('Failed')
    for (const item of push.failed) lines.push(`${item.file}   ${item.reason}`)
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

function messageBody(download, push) {
  return [
    'Download',
    reportText(download).trimEnd(),
    '',
    'Send to staging',
    pushText(push).trimEnd(),
    '',
    'Reports on this PC',
    'Docs/exports/logsheet-sync/sync-report.txt',
    'Docs/exports/staging-outbox/push-report.txt',
    '',
  ].join('\n')
}

function remember(line) {
  fs.mkdirSync(path.dirname(notifyLog), { recursive: true })
  fs.appendFileSync(notifyLog, `${plantStamp()}  ${line}\n`)
  console.log(line)
}

export async function notifyRun(download, push) {
  const settings = mailSettings()
  const overall = download.status === 'OK' && push.status === 'OK' ? 'OK' : 'FAILED'
  if (!settings.host || !settings.from || settings.to.length === 0) {
    const reason = 'Mail skipped. Set SMTP_HOST, SMTP_FROM, and SMTP_TO in Frontend/.env.'
    remember(reason)
    return { status: 'SKIPPED', error: reason }
  }

  const transport = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: settings.user ? { user: settings.user, pass: settings.password } : undefined,
  })
  try {
    await transport.sendMail({
      from: settings.from,
      to: settings.to,
      subject: `Plant logsheet sync ${overall}`,
      text: messageBody(download, push),
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    remember(`Mail failed. ${reason}`)
    return { status: 'FAILED', error: reason }
  }
  remember(`Mail sent to ${settings.to.join(', ')}`)
  return { status: 'OK' }
}
