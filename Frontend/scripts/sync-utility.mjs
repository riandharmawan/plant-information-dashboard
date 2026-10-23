import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { formForId, parseUtilityFile, utilityForms } from './parse-utility.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const frontend = path.resolve(here, '..')
const exportDir = path.resolve(here, '../../Docs/exports/utility-logsheets')
const baseUrl = () => (process.env.LOGSHEET_BASE || 'https://logsheet-builder.gamasap.com').replace(/\/$/, '')

const reports = [
  '2877806f-02dc-4332-8a18-1d515c531001',
  'f9db0b0c-6518-4ca7-80dc-f5763521857f',
  '3538d238-442b-4add-9f9d-ce14aae06ba8',
  '0a1b0c28-1780-43d9-8c79-46b9ce2a82b1',
  '232ca732-aae1-49e9-937e-80d3d0f156bd',
  'cc2e0682-4681-4ef9-a13d-3a51dd786c86',
  '1d5bb87a-74f1-41a5-b692-ad210107a0d6',
  '8faf8a0f-7938-405b-8caf-c6cb3763c247',
  'f49949cb-4e6d-4958-a7df-9c40e89b90fd',
  '834ce78e-3eed-4f3b-bef4-af84dc50728e',
  '767e5297-f861-4a65-ab27-cbb0d07f8253',
  '305c8641-93d0-4c55-9d71-28ee9d7eeee3',
  '0826ff96-b12d-42db-ad59-93bea313e4da',
]

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

function idPrefix(id) {
  return id.slice(0, 8)
}

function folderName(title) {
  const clean = String(title ?? '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
  return clean.slice(0, 80) || 'utility-report'
}

function decodeText(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function reportTitle(html) {
  const heads = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
  for (const match of heads) {
    const value = decodeText(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    if (!value || /^(approval information|leader|sect\.?\s*head)$/i.test(value)) continue
    return value
  }
  return null
}

function catalogPath() {
  return path.join(exportDir, 'catalog.json')
}

function loadCatalog() {
  if (!fs.existsSync(catalogPath())) return {}
  return JSON.parse(fs.readFileSync(catalogPath(), 'utf8'))
}

function saveCatalog(catalog) {
  fs.mkdirSync(exportDir, { recursive: true })
  fs.writeFileSync(catalogPath(), JSON.stringify(catalog, null, 2))
}

function newestSavedDay(dir, prefix) {
  if (!fs.existsSync(dir)) return null
  return fs.readdirSync(dir)
    .map((name) => name.match(new RegExp(`^UTILITY_${prefix}_(\\d{4}-\\d{2}-\\d{2})\\.xlsx$`, 'i'))?.[1])
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

async function reportPage(jar, id, day) {
  const url = `${baseUrl()}/report/index/${id}?start_date=${day}&end_date=${day}`
  const response = await request(jar, url)
  const html = await response.text()
  if (response.url.includes('/login')) throw new Error('The logsheet session expired before the ticket check')
  return html
}

async function downloadExcel(jar, id, day) {
  const url = `${baseUrl()}/report/logsheet/${id}/export-excel?start_date=${day}&end_date=${day}`
  const response = await request(jar, url)
  const bytes = Buffer.from(await response.arrayBuffer())
  const zip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
  if (!zip) throw new Error(`Excel export for ${day} was not a workbook (${response.status})`)
  return bytes
}

function saveWorkbook(dir, id, day, bytes) {
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `UTILITY_${idPrefix(id)}_${day}.xlsx`)
  fs.writeFileSync(file, bytes)
  return file
}

function ingestUtility(payload) {
  const backend = path.resolve(here, '../../Backend')
  const result = spawnSync(process.execPath, [path.join(backend, 'scripts/ingest-utility-day.js')], {
    cwd: backend,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'utility ingest failed').trim())
  }
  const line = result.stdout.trim().split(/\r?\n/).at(-1)
  return line ? JSON.parse(line) : null
}

function parseSavedFile(file) {
  const recordedOn = path.basename(file).match(/_(\d{4}-\d{2}-\d{2})\.xlsx$/i)?.[1]
  if (!recordedOn) throw new Error(`No date in ${path.basename(file)}`)
  return parseUtilityFile(file, recordedOn).day
}

function savedFiles(id) {
  const catalog = loadCatalog()
  const folder = catalog[id]?.folder
  if (!folder) return []
  const dir = path.join(exportDir, folder)
  if (!fs.existsSync(dir)) return []
  const prefix = idPrefix(id)
  return fs.readdirSync(dir)
    .filter((name) => new RegExp(`^UTILITY_${prefix}_\\d{4}-\\d{2}-\\d{2}\\.xlsx$`, 'i').test(name))
    .sort()
    .map((name) => path.join(dir, name))
}

function storeForm(form, files, downloadedCount, skippedCount) {
  const days = []
  const failed = []
  for (const file of files) {
    try {
      days.push(parseSavedFile(file))
    } catch (error) {
      const day = path.basename(file).match(/_(\d{4}-\d{2}-\d{2})\.xlsx$/i)?.[1] ?? path.basename(file)
      failed.push({ day, reason: error instanceof Error ? error.message : String(error) })
    }
  }
  const dates = days.map((day) => day.recordedOn).sort()
  let ingested = null
  try {
    ingested = ingestUtility({
      formCode: form.formCode,
      externalId: form.id,
      name: form.name,
      from: dates[0] ?? null,
      to: dates.at(-1) ?? null,
      downloaded: downloadedCount,
      skipped: skippedCount,
      days,
    })
  } catch (error) {
    failed.push({ day: dates.length ? `${dates[0]}..${dates.at(-1)}` : '-', reason: error instanceof Error ? error.message : String(error) })
  }
  return { ingested, failed }
}

function writeSyncLog(report) {
  const forms = report.forms ?? []
  const failedCount = forms.reduce((sum, form) => sum + (form.failed?.length ?? 0), 0)
    + (report.failed?.length ?? 0)
  const downloadedCount = forms.reduce((sum, form) => sum + (form.downloaded?.length ?? 0), 0)
  const skippedCount = forms.reduce((sum, form) => sum + (form.skipped?.length ?? 0), 0)
  const status = failedCount === 0 ? 'OK' : 'FAILED'
  const lines = [
    'Utility Log Sheet reports',
    `Status: ${status}`,
    `Ran at: ${report.ranAt}`,
    report.from && report.to
      ? `Range: ${report.from} through ${report.to} (${countLabel(daysFrom(report.from, report.to).length, 'day')})`
      : 'Range: the job stopped before a date range was chosen',
    '',
    status === 'OK'
      ? 'The sync finished. Days with tickets were saved and written to utility days.'
      : 'The sync did not finish cleanly. The failed reports below were not fully stored.',
    '',
    'Result',
    `- Reports: ${forms.length || reports.length}`,
    `- Downloaded: ${countLabel(downloadedCount, 'day')}`,
    `- Skipped (no tickets): ${countLabel(skippedCount, 'day')}`,
    `- Failed: ${countLabel(failedCount, 'day')}`,
    `- Utility days written: ${forms.reduce((sum, form) => sum + (form.ingested?.days ?? 0), 0)}`,
    `- Readings: ${forms.reduce((sum, form) => sum + (form.ingested?.readings ?? 0), 0)}`,
    `- Material uses: ${forms.reduce((sum, form) => sum + (form.ingested?.materials ?? 0), 0)}`,
    `- Loader runs: ${forms.reduce((sum, form) => sum + (form.ingested?.loaderRuns ?? 0), 0)}`,
    `- Checks: ${forms.reduce((sum, form) => sum + (form.ingested?.checks ?? 0), 0)}`,
    `- Jobs: ${forms.reduce((sum, form) => sum + (form.ingested?.jobs ?? 0), 0)}`,
    '',
    'A day is downloaded when Total Ticket is greater than 0.',
    'Each saved workbook replaces that form’s utility day. Steam on these sheets is not the production-report steam total.',
    '',
  ]
  for (const form of forms) {
    lines.push(form.title || form.id)
    lines.push(form.id)
    lines.push(`Downloaded ${countLabel(form.downloaded.length, 'day')}, skipped ${countLabel(form.skipped.length, 'day')}, failed ${countLabel(form.failed.length, 'day')}`)
    if (form.downloaded.length > 0) {
      for (const item of form.downloaded) lines.push(`  ${item.day}   tickets ${item.tickets}   ${path.basename(item.file)}`)
    }
    if (form.skipped.length > 0) {
      lines.push(`  Skipped: ${form.skipped.map((item) => item.day).join(', ')}`)
    }
    if (form.failed.length > 0) {
      for (const item of form.failed) lines.push(`  Failed ${item.day}   ${item.reason}`)
    }
    lines.push('')
  }
  for (const item of report.failed ?? []) {
    lines.push(`Failed ${item.day}   ${item.reason}`, '')
  }
  const text = `${lines.join('\n')}\n`
  fs.mkdirSync(exportDir, { recursive: true })
  fs.writeFileSync(path.join(exportDir, 'sync-report.txt'), text)
  fs.appendFileSync(path.join(exportDir, 'sync.log'), `${text}---\n`)
  return text
}

async function syncReport(jar, id, fromArg, toArg, catalog) {
  const prefix = idPrefix(id)
  const known = catalog[id]
  let title = known?.title ?? null
  let dir = known?.folder ? path.join(exportDir, known.folder) : null
  const today = plantToday()
  const newest = dir ? newestSavedDay(dir, prefix) : null
  const from = fromArg || (newest && newest < today ? addDays(newest, 1) : today)
  const to = toArg || today
  const result = { id, title: title ?? id, folder: known?.folder ?? null, downloaded: [], skipped: [], failed: [] }
  for (const day of daysFrom(from, to)) {
    try {
      const html = await reportPage(jar, id, day)
      const tickets = totalTicket(html)
      if (!title) {
        title = reportTitle(html) || id
        const name = folderName(title)
        result.title = title
        result.folder = name
        dir = path.join(exportDir, name)
        catalog[id] = { title, folder: name }
        saveCatalog(catalog)
      }
      if (tickets == null) {
        result.failed.push({ day, reason: 'Total Ticket was not on the page. This report may use a different date filter.' })
        break
      }
      if (tickets <= 0) {
        result.skipped.push({ day, tickets })
        continue
      }
      const bytes = await downloadExcel(jar, id, day)
      const file = saveWorkbook(dir, id, day, bytes)
      result.downloaded.push({ day, tickets, bytes: bytes.length, file })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      result.failed.push({ day, reason })
      if (/logsheet login failed|session expired/i.test(reason)) throw error
    }
  }
  return result
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
      reports: reports.length,
    }))
    return
  }

  const fromArg = arg('--from')
  const toArg = arg('--to')
  if ((fromArg && !/^\d{4}-\d{2}-\d{2}$/.test(fromArg)) || (toArg && !/^\d{4}-\d{2}-\d{2}$/.test(toArg)) || (fromArg && toArg && fromArg > toArg)) {
    throw new Error(`Invalid range ${fromArg || ''} to ${toArg || ''}`)
  }

  const loadSaved = process.argv.includes('--ingest-saved')
  const forms = []
  if (loadSaved) {
    for (const form of utilityForms) {
      const files = savedFiles(form.id)
      const stored = storeForm(form, files, files.length, 0)
      forms.push({
        id: form.id,
        title: form.name,
        folder: loadCatalog()[form.id]?.folder ?? null,
        downloaded: files.map((file) => ({ day: path.basename(file).match(/_(\d{4}-\d{2}-\d{2})/)?.[1], tickets: null, file })),
        skipped: [],
        failed: stored.failed,
        ingested: stored.ingested,
      })
      console.error(`${form.name}: stored ${stored.ingested?.days ?? 0} days`)
    }
  } else {
    const jar = new CookieJar()
    await login(jar)
    const catalog = loadCatalog()
    for (const id of reports) {
      const result = await syncReport(jar, id, fromArg, toArg, catalog)
      const form = formForId(id)
      const stored = storeForm(form, result.downloaded.map((item) => item.file), result.downloaded.length, result.skipped.length)
      result.failed.push(...stored.failed)
      result.ingested = stored.ingested
      forms.push(result)
      console.error(`${result.title}: downloaded ${result.downloaded.length}, stored ${stored.ingested?.days ?? 0}`)
    }
  }
  const report = {
    ranAt: plantStamp(),
    from: fromArg,
    to: toArg,
    forms,
  }
  const failed = forms.some((form) => form.failed.length > 0)
  fs.mkdirSync(exportDir, { recursive: true })
  fs.writeFileSync(path.join(exportDir, 'last-sync.json'), JSON.stringify({ ...report, status: failed ? 'FAILED' : 'OK' }, null, 2))
  const text = writeSyncLog(report)
  console.log(text)
  console.log(`Report: ${path.join(exportDir, 'sync-report.txt')}`)
  console.log(`Log: ${path.join(exportDir, 'sync.log')}`)
  if (failed) process.exitCode = 1
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  try {
    const text = writeSyncLog({
      ranAt: plantStamp(),
      forms: [],
      failed: [{ day: '-', reason: message }],
    })
    console.log(text)
  } catch {
    console.error(message)
  }
  process.exitCode = 1
})
