import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRefineryWorkbook } from './map-refinery-quality.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const frontend = path.resolve(here, '..')
const exportDir = path.resolve(here, '../../Docs/exports/daily-quality-refinery')
const reportId = () => process.env.LOGSHEET_QCO002_ID || '54c4be2f-6076-4f6e-b897-90f12622d142'
const dateFilter = () => process.env.LOGSHEET_QCO002_DATE_FILTER || 'f5a319ef-984d-4114-9744-908c6c41fd0c'
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
    .map((name) => name.match(/^F-QCO-002_(\d{4}-\d{2}-\d{2})\.xlsx$/i)?.[1])
    .filter(Boolean)
    .sort()
    .at(-1) ?? null
}

function dayQuery(day) {
  const params = new URLSearchParams()
  params.set(`filters[${dateFilter()}]`, day)
  return params.toString()
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
  const url = `${baseUrl()}/report/index/${reportId()}?${dayQuery(day)}`
  const response = await request(jar, url)
  const html = await response.text()
  if (response.url.includes('/login')) throw new Error('The logsheet session expired before the ticket check')
  if (/no data available/i.test(html) && totalTicket(html) == null) return 0
  return totalTicket(html)
}

async function downloadExcel(jar, day) {
  const url = `${baseUrl()}/report/logsheet/${reportId()}/export-excel?${dayQuery(day)}`
  const response = await request(jar, url)
  const bytes = Buffer.from(await response.arrayBuffer())
  const zip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
  if (!zip) throw new Error(`Excel export for ${day} was not a workbook (${response.status})`)
  return bytes
}

function existingWorkbook(day) {
  const file = path.join(exportDir, `F-QCO-002_${day}.xlsx`)
  if (!fs.existsSync(file)) return null
  return fs.readFileSync(file)
}

function insertDay(day) {
  const script = path.resolve(here, '../../Backend/scripts/upsert-refinery-quality.mjs')
  const result = spawnSync(process.execPath, [script], {
    input: JSON.stringify(day),
    encoding: 'utf8',
    cwd: path.resolve(here, '../../Backend'),
  })
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'database insert failed').trim())
  }
  return JSON.parse(result.stdout)
}

function stamp(date) {
  const text = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
  return `${text} Asia/Jakarta`
}

function verifyRange(from, to) {
  const script = path.resolve(here, '../../Backend/scripts/upsert-refinery-quality.mjs')
  const result = spawnSync(process.execPath, [script, '--verify', '--from', from, '--to', to], {
    encoding: 'utf8',
    cwd: path.resolve(here, '../../Backend'),
  })
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'database check failed').trim())
  }
  return JSON.parse(result.stdout).days
}

function reportText(report) {
  const ok = report.failed.length === 0 && !report.stopped
  const span = report.from && report.to ? daysFrom(report.from, report.to).length : 0
  const seconds = Math.max(1, Math.round((report.finishedAt - report.startedAt) / 1000))
  const lines = [
    `Status: ${ok ? 'OK' : 'FAILED'}`,
    `Finished: ${stamp(report.finishedAt)}`,
    `Duration: ${seconds}s`,
    'Form: F/QCO-002 Daily Quality Refinery',
    report.from && report.to ? `Range: ${report.from} through ${report.to} (${span} days)` : 'Range: not started',
    `Source: ${baseUrl()}/report/index/${reportId()}`,
    '',
    'Result',
    `- Inserted: ${report.inserted.length} days`,
    `- Skipped (no data): ${report.skipped.length} days`,
    `- Failed: ${report.failed.length} days`,
    '',
  ]
  if (report.stopped) {
    lines.push('Stopped', report.stopped, '')
  }
  if (report.inserted.length > 0) {
    lines.push('Inserted', 'Date         Unit          Readings  Database')
    for (const item of report.inserted) {
      lines.push(`${item.day}   ${String(item.processUnit).padEnd(12)}  ${String(item.readings).padEnd(8)}  ${item.database}`)
    }
    lines.push('')
  }
  if (report.skipped.length > 0) {
    lines.push('Skipped because there was no data')
    for (const item of report.skipped) lines.push(`${item.day}   ${item.reason}`)
    lines.push('')
  }
  if (report.failed.length > 0) {
    lines.push('Failed')
    for (const item of report.failed) lines.push(`${item.day}   ${item.reason}`)
    lines.push('')
  }
  if (ok) lines.push('The sync finished and the inserted days match the database.', '')
  return `${lines.join('\n').trimEnd()}\n`
}

function writeReport(report) {
  const text = reportText(report)
  fs.mkdirSync(exportDir, { recursive: true })
  fs.writeFileSync(path.join(exportDir, 'export-summary.txt'), text)
  fs.appendFileSync(path.join(exportDir, 'sync-log.txt'), `${text}\n`)
  fs.writeFileSync(path.join(exportDir, 'last-sync.json'), JSON.stringify({
    ranAt: report.finishedAt.toISOString(),
    status: report.failed.length === 0 && !report.stopped ? 'OK' : 'FAILED',
    from: report.from,
    to: report.to,
    inserted: report.inserted,
    skipped: report.skipped,
    failed: report.failed,
    stopped: report.stopped,
  }, null, 2))
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
      reportId: reportId(),
    }))
    return
  }

  const startedAt = new Date()
  let from = null
  let to = null
  let stopped = null
  const inserted = []
  const skipped = []
  const failed = []
  try {
    const today = plantToday()
    const newest = newestSavedDay()
    from = arg('--from') || (newest && newest < today ? addDays(newest, 1) : today)
    to = arg('--to') || today
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
      throw new Error(`Invalid range ${from} to ${to}`)
    }

    let jar = null
    for (const day of daysFrom(from, to)) {
      try {
        const stored = existingWorkbook(day)
        let bytes = stored
        let tickets = null
        if (!bytes) {
          if (!jar) {
            jar = new CookieJar()
            await login(jar)
          }
          tickets = await ticketCount(jar, day)
          if (tickets == null) {
            failed.push({ day, reason: 'Total Ticket was not on the page' })
            continue
          }
          if (tickets <= 0) {
            skipped.push({ day, tickets, reason: 'no tickets' })
            continue
          }
          bytes = await downloadExcel(jar, day)
        }
        const parsed = parseRefineryWorkbook(bytes, day)
        if (parsed.skipped) {
          skipped.push({ day, tickets, reason: parsed.reason })
          continue
        }
        const saved = insertDay(parsed)
        inserted.push({
          day,
          tickets,
          processUnit: saved.processUnit,
          readings: saved.readings,
          source: stored ? 'file' : 'download',
          database: 'not checked',
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (/logsheet login failed|session expired/i.test(message)) {
          stopped = message
          break
        }
        failed.push({ day, reason: message })
      }
    }
    if (!stopped && inserted.length > 0) {
      const storedDays = verifyRange(from, to)
      for (const item of inserted) {
        const row = storedDays.find((stored) => stored.day === item.day && stored.unit === item.processUnit)
        if (!row) {
          item.database = 'missing'
          failed.push({ day: item.day, reason: 'inserted day is not in the database' })
        } else if (Number(row.readings) !== item.readings) {
          item.database = `${row.readings} readings`
          failed.push({ day: item.day, reason: `database has ${row.readings} readings, the insert reported ${item.readings}` })
        } else {
          item.database = 'match'
        }
      }
    }
  } catch (error) {
    stopped = error instanceof Error ? error.message : String(error)
  }
  const text = writeReport({
    from,
    to,
    inserted,
    skipped,
    failed,
    stopped,
    startedAt,
    finishedAt: new Date(),
  })
  console.log(text)
  if (failed.length > 0 || stopped) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
