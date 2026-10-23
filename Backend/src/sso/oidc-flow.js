import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'

export const OIDC_FLOW_COOKIE = 'pid_oidc_flow'

function cookieFlags() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
  }
}

function b64url(input) {
  return input.toString('base64url')
}

export function createPkcePair() {
  const verifier = b64url(crypto.randomBytes(32))
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest())
  return { verifier, challenge, method: 'S256' }
}

export function createSignedState(verifier) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is required')
  return jwt.sign(
    { type: 'oidc_state', nonce: b64url(crypto.randomBytes(24)), verifier, mode: 'login' },
    secret,
    { algorithm: 'HS256', expiresIn: '10m' },
  )
}

export function readSignedState(stateToken) {
  const secret = process.env.JWT_SECRET
  if (!secret || !stateToken) return null
  try {
    const decoded = jwt.verify(stateToken, secret, { algorithms: ['HS256'] })
    if (decoded?.type !== 'oidc_state') return null
    if (typeof decoded.verifier !== 'string' || !decoded.verifier) return null
    return decoded
  } catch {
    return null
  }
}

export function setOidcFlowCookie(res, payload) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is required')
  const token = jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '10m' })
  res.cookie(OIDC_FLOW_COOKIE, token, { ...cookieFlags(), maxAge: 10 * 60 * 1000 })
}

export function readOidcFlowCookie(req) {
  const secret = process.env.JWT_SECRET
  const token = req.cookies?.[OIDC_FLOW_COOKIE]
  if (!secret || !token) return null
  try {
    return jwt.verify(token, secret, { algorithms: ['HS256'] })
  } catch {
    return null
  }
}

export function clearOidcFlowCookie(res) {
  res.clearCookie(OIDC_FLOW_COOKIE, cookieFlags())
}
