import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseRfa004B } from './parse-rfa004.mjs'
import { queueStaging } from './staging-outbox.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const frontend = path.resolve(here, '..')
const exportDir = path.resolve(here, '../../Docs/exports/fractionation-daily-log')
const reportId = () => process.env.LOGSHEET_RFA004B_ID || '476fba4b-8ee8-4e3b-8fb1-627da45a47d3'
const baseUrl = () => (process.env.LOGSHEET_BASE || 'https://logsheet-builder.gamasap.com').replace(/\/$/, '')

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
  const fromFiles = {}
  loadEnvFile(path.join(frontend, '.env'), fromFiles)
  loadEnvFile(path.join(frontend, '.env.sync'), fromFiles)
  for (const [key, value] of Object.entries(fromFiles)) {
    if (!process.env[key]) process.env[key] = value
  }
}

function arg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

function plantToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function countLabel(count, singular) {
  return `${count} ${singular}${count === 1 ? '' : 's'}`
}

function plantStamp() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (type) => parts.find((part) => part.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')} WIB`
}

function addDays(iso, days) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, (day || 1) + days)
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0')
  const nextDay = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`
}

function daysFrom(start, end) {
  const days = []
  let cursor = start
  while (cursor <= end && days.length < 400) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return days
}

function newestSavedDay() {
  if (!fs.existsSync(exportDir)) return null
  return fs.readdirSync(exportDir)
    .map((name) => name.match(/^F-RFA-004B_(\d{4}-\d{2}-\d{2})\.xlsx$/i)?.[1])
    .filter(Boolean)
    .sort()
    .at(-1) ?? null
}

class CookieJar {
  constructor() {
    this.cookies = new Map()
  }

  store(response) {
    const raw = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
    for (const line of raw) {
      const pair = line.split(';')[0]
      const eq = pair.indexOf('=')
      if (eq < 1) continue
      const name = pair.slice(0, eq).trim()
      const value = pair.slice(eq + 1).trim()
      if (!value) this.cookies.delete(name)
      else this.cookies.set(name, value)
    }
  }

  header() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ')
  }
}

async function request(jar, url, options = {}, depth = 0) {
  if (depth > 8) throw new Error(`Too many redirects for ${url}`)
  const headers = new Headers(options.headers)
  const cookie = jar.header()
  if (cookie) headers.set('cookie', cookie)
  const response = await fetch(url, { ...options, headers, redirect: 'manual' })
  jar.store(response)
  if (![301, 302, 303, 307, 308].includes(response.status)) return response
  const location = response.headers.get('location')
  if (!location) return response
  const next = new URL(location, url)
  const method = [301, 302, 303].includes(response.status) ? 'GET' : (options.method || 'GET')
  return request(jar, next, { method }, depth + 1)
}

function hiddenToken(html) {
  const match = html.match(/name="_token"\s+value="([^"]+)"/) || html.match(/value="([^"]+)"\s+name="_token"/)
  return match?.[1] ?? null
}

function totalTicket(html) {
  const match = html.match(/Total Ticket<\/p>\s*<p[^>]*leading-tight[^>]*>\s*([\d,]+)/i)
  if (!match) return null
  const value = Number(match[1].replace(/,/g, ''))
  return Number.isFinite(value) ? value : null
}

async function login(jar) {
  const identifier = process.env.LOGSHEET_IDENTIFIER
  const password = process.env.LOGSHEET_PASSWORD
  if (!identifier || !password) {
    throw new Error('Set LOGSHEET_IDENTIFIER and LOGSHEET_PASSWORD in Frontend/.env.sync')
  }
  const page = await request(jar, `${baseUrl()}/login`)
  const html = await page.text()
  const token = hiddenToken(html)
  if (!token) throw new Error('The logsheet login page did not include a form token')
  const body = new URLSearchParams({ _token: token, identifier, password })
  const response = await request(jar, `${baseUrl()}/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: baseUrl(),
      referer: `${baseUrl()}/login`,
    },
    body,
  })
  const landed = await response.text()
  if (response.url.includes('/login') || /name="password"/i.test(landed)) {
    throw new Error('Logsheet login failed. Check the identifier and password in Frontend/.env.sync')
  }
}

async function ticketCount(jar, day) {
  const url = `${baseUrl()}/report/index/${reportId()}?start_date=${day}&end_date=${day}`
  const response = await request(jar, url)
  const html = await response.text()
  if (response.url.includes('/login')) throw new Error('The logsheet session expired before the ticket check')
  return totalTicket(html)
}

async function downloadExcel(jar, day) {
  const url = `${baseUrl()}/report/logsheet/${reportId()}/export-excel?start_date=${day}&end_date=${day}`
  const response = await request(jar, url)
  const bytes = Buffer.from(await response.arrayBuffer())
  const zip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
  if (!zip) throw new Error(`Excel export for ${day} was not a workbook (${response.status})`)
  return bytes
}

function saveWorkbook(day, bytes) {
  fs.mkdirSync(exportDir, { recursive: true })
  const file = path.join(exportDir, `F-RFA-004B_${day}.xlsx`)
  const existed = fs.existsSync(file)
  fs.writeFileSync(file, bytes)
  return { file, existed }
}

function ingestProduction(payload) {
  const backend = path.resolve(here, '../../Backend')
  const result = spawnSync(process.execPath, [path.join(backend, 'scripts/ingest-production-day.js')], {
    cwd: backend,
    input: JSON.stringify(payload),
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'production ingest failed').trim())
  }
  const line = result.stdout.trim().split(/\r?\n/).at(-1)
  return line ? JSON.parse(line) : null
}

function writeSyncLog(report) {
  const failed = report.failed ?? []
  const downloaded = report.downloaded ?? []
  const skipped = report.skipped ?? []
  const status = failed.length === 0 ? 'OK' : 'FAILED'
  const lines = [
    'Fractionation daily log (F/RFA-004(B))',
    `Status: ${status}`,
    `Ran at: ${report.ranAt}`,
    report.from && report.to
      ? `Range: ${report.from} through ${report.to} (${countLabel(daysFrom(report.from, report.to).length, 'day')})`
      : 'Range: the job stopped before a date range was chosen',
    `Source: ${baseUrl()}/report/index/${reportId()}`,
    '',
    status === 'OK' && downloaded.length > 0
      ? 'The sync finished. Days with tickets were saved and written to production days.'
      : status === 'OK'
        ? 'The sync finished. No sheet in this range had tickets, so nothing was saved.'
        : 'The sync did not finish cleanly. The failed days below were not stored.',
    '',
    'Result',
    `- Downloaded: ${countLabel(downloaded.length, 'day')}`,
    `- Skipped (no tickets): ${countLabel(skipped.length, 'day')}`,
    `- Failed: ${countLabel(failed.length, 'day')}`,
    `- Production days written: ${report.ingested?.days ?? 0}`,
    `- Flows: ${report.ingested?.flows ?? 0}`,
    `- Materials: ${report.ingested?.materials ?? 0}`,
    `- Utilities: ${report.ingested?.utilities ?? 0}`,
    `- Remarks: ${report.ingested?.remarks ?? 0}`,
    '',
    'A day is downloaded when Total Ticket is greater than 0.',
    'Each downloaded day replaces that process unit’s production day. This job does not rewrite the local dashboard JSON.',
    '',
  ]
  if (downloaded.length > 0) {
    lines.push('Downloaded', 'Date         Tickets  Unit          Workbook')
    for (const item of downloaded) {
      lines.push(`${item.day}   ${String(item.tickets).padEnd(7)}  ${String(item.processUnit ?? '').padEnd(12)}  ${path.basename(item.file)}`)
    }
    lines.push('')
  }
  if (skipped.length > 0) {
    lines.push('Skipped because Total Ticket was 0')
    for (const item of skipped) lines.push(`${item.day}   tickets ${item.tickets}`)
    lines.push('')
  }
  if (failed.length > 0) {
    lines.push('Failed')
    for (const item of failed) lines.push(`${item.day}   ${item.reason}`)
    lines.push('')
  }
  const text = `${lines.join('\n')}\n`
  fs.mkdirSync(exportDir, { recursive: true })
  fs.writeFileSync(path.join(exportDir, 'sync-report.txt'), text)
  fs.appendFileSync(path.join(exportDir, 'sync.log'), `${text}---\n`)
  return text
}

async function main() {
  applyEnv()
  if (process.argv.includes('--probe')) {
    const jar = new CookieJar()
    const page = await request(jar, `${baseUrl()}/login`)
    const html = await page.text()
    console.log(JSON.stringify({
      ok: page.status === 200 && Boolean(hiddenToken(html)),
      status: page.status,
      cookies: jar.cookies.size,
    }))
    return
  }

  const today = plantToday()
  const newest = newestSavedDay()
  const from = arg('--from') || (newest && newest < today ? addDays(newest, 1) : today)
  const to = arg('--to') || today
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    throw new Error(`Invalid range ${from} to ${to}`)
  }

  const jar = new CookieJar()
  await login(jar)
  const downloaded = []
  const skipped = []
  const failed = []
  const days = []
  const written = []
  for (const day of daysFrom(from, to)) {
    try {
      const tickets = await ticketCount(jar, day)
      if (tickets == null) {
        throw new Error('Total Ticket was not on the page. This report may use a different date filter than F/TNF-003.')
      }
      if (tickets <= 0) {
        skipped.push({ day, tickets })
        continue
      }
      const bytes = await downloadExcel(jar, day)
      const saved = saveWorkbook(day, bytes)
      let parsed
      try {
        parsed = parseRfa004B(saved.file, day)
      } catch (error) {
        if (!saved.existed) fs.unlinkSync(saved.file)
        throw error
      }
      written.push(saved)
      days.push(parsed)
      downloaded.push({ day, tickets, bytes: bytes.length, file: saved.file, processUnit: parsed.processUnit })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      failed.push({ day, reason })
      if (/Total Ticket was not on the page|logsheet login failed|session expired/i.test(reason)) break
    }
  }
  let ingested = null
  if (days.length > 0) {
    const payload = {
      formCode: 'F/RFA-004(B)',
      from: days[0].productionDate,
      to: days.at(-1).productionDate,
      downloaded: downloaded.length,
      skipped: skipped.length,
      days,
    }
    try {
      ingested = ingestProduction(payload)
      queueStaging('ingest-production-day.js', payload)
    } catch (error) {
      for (const saved of written) {
        if (!saved.existed) fs.unlinkSync(saved.file)
      }
      failed.push({
        day: `${days[0].productionDate}..${days.at(-1).productionDate}`,
        reason: error instanceof Error ? error.message : String(error),
      })
    }
  }
  const report = { ranAt: plantStamp(), from, to, downloaded, skipped, failed, ingested }
  fs.mkdirSync(exportDir, { recursive: true })
  fs.writeFileSync(path.join(exportDir, 'last-sync.json'), JSON.stringify({ ...report, status: failed.length === 0 ? 'OK' : 'FAILED' }, null, 2))
  const text = writeSyncLog(report)
  console.log(text)
  console.log(`Report: ${path.join(exportDir, 'sync-report.txt')}`)
  console.log(`Log: ${path.join(exportDir, 'sync.log')}`)
  if (failed.length > 0) process.exitCode = 1
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  try {
    const text = writeSyncLog({
      ranAt: plantStamp(),
      downloaded: [],
      skipped: [],
      failed: [{ day: '-', reason: message }],
    })
    console.log(text)
  } catch {
    console.error(message)
  }
  process.exitCode = 1
})
