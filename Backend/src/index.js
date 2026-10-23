import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import operations from './routes/operations.js'
import production from './routes/production.js'
import qc from './routes/qc.js'
import utility from './routes/utility.js'
import auth from './routes/auth.js'
import hubAuth from './routes/hub-auth.js'
import admin from './routes/admin.js'

const app = express()
const port = Number(process.env.PORT || 3010)
const origins = (process.env.CORS_ORIGIN || 'http://127.0.0.1:5173,http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(cors({ origin: origins, credentials: true }))
app.use(cookieParser())
app.use(express.json())

app.get('/api/v1/health', (_req, res) => {
  res.json({ ok: true, env: process.env.APP_ENV || process.env.NODE_ENV || 'dev' })
})

app.use('/auth', hubAuth)
app.use('/api/v1/auth', auth)
app.use('/api/v1/admin', admin)
app.use('/api/v1', operations)
app.use('/api/v1', production)
app.use('/api/v1/sites/:siteId/qc', qc)
app.use('/api/v1/sites/:siteId/utility', utility)

app.use((error, _req, res, _next) => {
  const message = process.env.APP_ENV === 'dev' || process.env.NODE_ENV !== 'production'
    ? error.message
    : 'Request failed'
  res.status(500).json({ error: message })
})

app.listen(port, () => {
  console.log(`pid-api listening on ${port}`)
})
