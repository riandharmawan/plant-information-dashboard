import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'
import { queueStaging } from './staging-outbox.mjs'
import { bridgeMode } from './bridge-mode.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const frontend = path.resolve(here, '..')
const backend = path.resolve(here, '../../Backend')
const upsertScript = path.join(backend, 'scripts', 'upsert-qco-day.js')
const logDir = path.resolve(here, '../../Docs/exports/daily-storage-tank-analytical')
const syncLog = path.join(logDir, 'sync-log.txt')
const lastSync = path.join(logDir, 'last-sync.json')
const reportId = () => process.env.LOGSHEET_QCO_ID || '9e1e978f-18c0-42dc-a558-e28e65bdf5ce'
const dateFilter = () => process.env.LOGSHEET_QCO_DATE_FILTER || '4d4bdf79-f183-4837-8207-8bb73481910e'
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

function cellText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function parseNumber(value) {
  if (value == null || value === '') return null
  let raw = cellText(value)
  if (!raw || raw === '-' || raw === '—' || raw === '✓' || raw === '√') return null
  raw = raw.replace(/\s/g, '').replace(/\.$/, '')
  const commas = (raw.match(/,/g) || []).length
  const dots = (raw.match(/\./g) || []).length
  if (commas === 1 && dots >= 1) raw = raw.replace(/\./g, '').replace(',', '.')
  else if (commas === 1) raw = raw.replace(',', '.')
  else if (dots > 1) raw = raw.replace(/\./g, '')
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function labNumber(value) {
  const parsed = parseNumber(value)
  if (parsed != null) return parsed
  const composite = cellText(value).match(/comp\s*=\s*([0-9]+(?:[.,][0-9]+)?)/i)
  return composite ? parseNumber(composite[1]) : null
}

function blankToNull(value) {
  const raw = cellText(value)
  if (!raw || raw === '-' || raw === '—') return null
  return raw
}

function canonicalTank(value) {
  const numbered = cellText(value).match(/^t\.?\s*0*(\d+)\b/i)
  if (!numbered) return ''
  return `T${numbered[1].padStart(2, '0')}`
}

const LAB_CODES = [
  ['ffa', 'ffa'],
  ['moisture', 'moisture'],
  ['lovibond color r', 'colorR'],
  ['lovibond color y', 'colorY'],
  ['^iv$', 'iv'],
  ['^pv$', 'pv'],
  ['slip', 'smp'],
  ['cloud', 'cloudPoint'],
  ['anv', 'anv'],
  ['caroten', 'carotene'],
  ['^p$', 'phosphorus'],
  ['dobi', 'dobi'],
  ['totox', 'totox'],
]

function columnField(label) {
  const name = cellText(label).toLowerCase()
  if (!name || name === 'odor') return null
  const match = LAB_CODES.find(([pattern]) => new RegExp(pattern, 'i').test(name))
  return match ? match[1] : null
}

function sheetTanks(bytes) {
  const workbook = XLSX.read(bytes, { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: false, defval: '' })
  const headerAt = rows.findIndex((row) => row.some((cell) => /tank no/i.test(cellText(cell))))
  if (headerAt < 0) return []
  const header = rows[headerAt] ?? []
  const sub = rows[headerAt + 1] ?? []
  const columnAt = (row, pattern) => row.findIndex((cell) => pattern.test(cellText(cell)))
  const oilAt = columnAt(header, /oil type/i)
  const dateAt = columnAt(header, /analysis date/i)
  const capacityAt = columnAt(header, /kapasitas/i)
  const quantityAt = columnAt(header, /quantity/i)
  const emptyAt = columnAt(header, /empty space/i)
  const tempAt = columnAt(header, /suhu/i)
  const remarkAt = columnAt(header, /remark/i)
  const odorAt = columnAt(sub, /^odor$/i)
  const parameters = sub.map((cell, index) => ({ index, field: columnField(cell) })).filter((column) => column.field)
  const tanks = []
  for (const row of rows.slice(headerAt + 2)) {
    const tankId = canonicalTank(row[0])
    if (!tankId) continue
    const tank = {
      tankId,
      oil: cellText(row[oilAt]),
      analysisDate: /^\d{4}-\d{2}-\d{2}$/.test(cellText(row[dateAt])) ? cellText(row[dateAt]) : null,
      capacity: capacityAt >= 0 ? parseNumber(row[capacityAt]) : null,
      quantity: quantityAt >= 0 ? parseNumber(row[quantityAt]) : null,
      emptySpace: emptyAt >= 0 ? parseNumber(row[emptyAt]) : null,
      temperatureC: tempAt >= 0 ? parseNumber(row[tempAt]) : null,
      odor: odorAt >= 0 ? blankToNull(row[odorAt]) : null,
      remark: remarkAt >= 0 ? blankToNull(row[remarkAt]) : null,
    }
    for (const field of ['ffa', 'moisture', 'colorR', 'colorY', 'iv', 'pv', 'smp', 'cloudPoint', 'anv', 'carotene', 'phosphorus', 'dobi', 'totox']) {
      tank[field] = null
    }
    for (const column of parameters) tank[column.field] = labNumber(row[column.index])
    tanks.push(tank)
  }
  return tanks
}

function database(args, payload) {
  const result = spawnSync(process.execPath, [upsertScript, ...args], {
    cwd: backend,
    encoding: 'utf8',
    input: payload == null ? undefined : JSON.stringify(payload),
  })
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'database write failed').trim())
  }
  return result.stdout.trim() ? JSON.parse(result.stdout) : null
}

function localCursor() {
  if (!fs.existsSync(lastSync)) return null
  try {
    const data = JSON.parse(fs.readFileSync(lastSync, 'utf8'))
    return data.to ?? null
  } catch {
    return null
  }
}

function newestSnapshot() {
  // A bridge PC has no local database to ask. It uses the `to` date from its own
  // last run instead, which is written below regardless of where the data lands.
  if (bridgeMode()) return localCursor()
  return database(['--cursor']).snapshotOn ?? null
}

function ranAtLabel() {
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date())
  return `${clock} Asia/Jakarta`
}

function listOrNone(lines) {
  return lines.length > 0 ? lines.join('\n') : 'None.'
}

function writeSyncLog(report) {
  const failed = report.failed ?? []
  const downloaded = report.downloaded ?? []
  const skipped = report.skipped ?? []
  const result = report.error ? 'FAILED' : failed.length > 0 ? 'COMPLETED WITH FAILURES' : 'OK'
  const stored = downloaded.map((row) => {
    const tanks = (row.tanks ?? []).join(', ') || 'none'
    return `${row.day}   tickets ${row.tickets}   analysed ${tanks}   certificates ${row.certificates ?? 0}`
  })
  const skippedLines = skipped.map((row) => `${row.day}   tickets ${row.tickets ?? '-'}   ${row.reason}`)
  const failedLines = failed.map((row) => `${row.day}   ${row.reason}`)
  const text = [
    'Daily Storage Tank Analytical Result (F/QCO-001)',
    `Ran: ${report.ranAt}`,
    `Range: ${report.from} through ${report.to}`,
    `Result: ${result}`,
    '',
    'Stored in the database',
    listOrNone(stored),
    '',
    'Skipped',
    listOrNone(skippedLines),
    '',
    'Failed',
    listOrNone(report.error ? [report.error] : failedLines),
    '',
  ].join('\n')
  fs.mkdirSync(logDir, { recursive: true })
  fs.appendFileSync(syncLog, `${text}${'—'.repeat(40)}\n`)
  fs.writeFileSync(lastSync, JSON.stringify({
    ranAt: new Date().toISOString(),
    result,
    from: report.from,
    to: report.to,
    downloaded,
    skipped,
    failed,
    error: report.error ?? null,
  }, null, 2))
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
  const newest = arg('--from') ? null : newestSnapshot()
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
  for (const day of daysFrom(from, to)) {
    try {
      const tickets = await ticketCount(jar, day)
      if (tickets == null) {
        failed.push({ day, reason: 'Total Ticket was not on the page' })
        continue
      }
      if (tickets <= 0) {
        skipped.push({ day, tickets, reason: 'no tickets' })
        continue
      }
      const bytes = await downloadExcel(jar, day)
      const tanks = sheetTanks(bytes)
      const analysed = tanks.filter((tank) => tank.analysisDate === day).map((tank) => tank.tankId)
      if (analysed.length === 0) {
        skipped.push({ day, tickets, reason: 'no analysis dated that day' })
        continue
      }
      const payload = { snapshotOn: day, revision: 1, tanks }
      const stored = bridgeMode() ? { certificates: analysed.length, history: false } : database([], payload)
      queueStaging('upsert-qco-day.js', payload)
      downloaded.push({ day, tickets, tanks: analysed, certificates: stored.certificates, history: stored.history })
    } catch (error) {
      failed.push({ day, reason: error instanceof Error ? error.message : String(error) })
    }
  }
  const report = { ranAt: ranAtLabel(), from, to, downloaded, skipped, failed }
  writeSyncLog(report)
  console.log(JSON.stringify(report, null, 2))
  if (!bridgeMode()) {
    try {
      database(['--record-run'], report)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      writeSyncLog({ ...report, ranAt: ranAtLabel(), error: `Database run record failed. ${reason}` })
      throw error
    }
  }
  if (failed.length > 0) process.exitCode = 1
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : String(error)
  console.error(reason)
  if (!fs.existsSync(lastSync) || !fs.readFileSync(lastSync, 'utf8').includes(reason)) {
    writeSyncLog({
      ranAt: ranAtLabel(),
      from: null,
      to: null,
      downloaded: [],
      skipped: [],
      failed: [],
      error: reason,
    })
  }
  process.exitCode = 1
})
