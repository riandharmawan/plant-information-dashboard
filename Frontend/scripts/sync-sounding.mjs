import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const frontend = path.resolve(here, '..')
const exportDir = path.resolve(here, '../../Docs/exports/storage-tank-sounding')
const reportId = () => process.env.LOGSHEET_ID || 'f80caa03-a6b0-4ad7-b823-459b2f828ce3'
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
    .map((name) => name.match(/^F-TNF-003_(\d{4}-\d{2}-\d{2})\.xlsx$/i)?.[1])
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
  const file = path.join(exportDir, `F-TNF-003_${day}.xlsx`)
  fs.writeFileSync(file, bytes)
  return file
}

function refreshDashboard() {
  const result = spawnSync(process.execPath, [path.join(here, 'parse-logsheets.mjs')], {
    cwd: frontend,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'parse-logsheets failed')
  }
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
  for (const day of daysFrom(from, to)) {
    try {
      const tickets = await ticketCount(jar, day)
      if (tickets == null) {
        failed.push({ day, reason: 'Total Ticket was not on the page' })
        continue
      }
      if (tickets <= 0) {
        skipped.push({ day, tickets })
        continue
      }
      const bytes = await downloadExcel(jar, day)
      const file = saveWorkbook(day, bytes)
      downloaded.push({ day, tickets, bytes: bytes.length, file })
    } catch (error) {
      failed.push({ day, reason: error instanceof Error ? error.message : String(error) })
    }
  }
  if (downloaded.length > 0) refreshDashboard()
  const report = { from, to, downloaded, skipped, failed }
  fs.mkdirSync(exportDir, { recursive: true })
  fs.writeFileSync(path.join(exportDir, 'last-sync.json'), JSON.stringify({ ranAt: new Date().toISOString(), ...report }, null, 2))
  console.log(JSON.stringify(report, null, 2))
  if (failed.length > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
