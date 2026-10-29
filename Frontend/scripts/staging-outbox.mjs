import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export const outboxRoot = path.resolve(here, '../../Docs/exports/staging-outbox')

export const stagingScripts = [
  'ingest-sounding-day.js',
  'ingest-oil-movement-day.js',
  'ingest-production-day.js',
  'upsert-qco-day.js',
  'upsert-refinery-quality.mjs',
  'ingest-utility-day.js',
]

const fileName = /^\d{8}T\d{9}Z-[a-f0-9]{12}\.json$/

function stamp(date = new Date()) {
  const iso = date.toISOString()
  return `${iso.slice(0, 10).replace(/-/g, '')}T${iso.slice(11, 23).replace(/[:.]/g, '')}Z`
}

export function queueStaging(scriptName, payload) {
  if (!stagingScripts.includes(scriptName)) throw new Error(`Unknown staging script ${scriptName}`)
  const body = JSON.stringify(payload)
  const hash = crypto.createHash('sha256').update(body).digest('hex').slice(0, 12)
  const dir = path.join(outboxRoot, scriptName)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${stamp()}-${hash}.json`)
  fs.writeFileSync(file, body)
  return file
}

export function pendingFiles() {
  const pending = []
  for (const script of stagingScripts) {
    const dir = path.join(outboxRoot, script)
    if (!fs.existsSync(dir)) continue
    for (const name of fs.readdirSync(dir).sort()) {
      if (!fileName.test(name)) continue
      pending.push({ script, name, file: path.join(dir, name) })
    }
  }
  return pending
}

export function markSent(script, name) {
  if (!stagingScripts.includes(script) || !fileName.test(name)) {
    throw new Error(`Refusing to archive ${script}/${name}`)
  }
  const from = path.join(outboxRoot, script, name)
  if (!fs.existsSync(from)) return null
  const dir = path.join(outboxRoot, 'sent', script)
  fs.mkdirSync(dir, { recursive: true })
  const dest = path.join(dir, name)
  fs.renameSync(from, dest)
  return dest
}
