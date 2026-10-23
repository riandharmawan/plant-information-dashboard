function asBool(value, fallback) {
  if (value == null || value === '') return fallback
  return String(value).toLowerCase() === 'true'
}

function trim(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function getOidcConfig() {
  const issuer = trim(process.env.OIDC_ISSUER).replace(/\/$/, '')
  const discoveryUrl = trim(process.env.OIDC_DISCOVERY_URL) || (issuer ? `${issuer}/api/sso/.well-known/openid-configuration` : '')
  return {
    enabled: asBool(process.env.SSO_OIDC_ENABLED, false),
    legacyBridgeEnabled: asBool(process.env.SSO_LEGACY_BRIDGE_ENABLED, true),
    issuer,
    discoveryUrl,
    clientId: trim(process.env.OIDC_CLIENT_ID),
    redirectUri: trim(process.env.OIDC_REDIRECT_URI),
    scopes: trim(process.env.OIDC_SCOPES) || 'openid profile email',
  }
}

export function oidcConfigError(config) {
  if (!config.enabled) return null
  const missing = []
  if (!config.issuer) missing.push('OIDC_ISSUER')
  if (!config.clientId) missing.push('OIDC_CLIENT_ID')
  if (!config.redirectUri) missing.push('OIDC_REDIRECT_URI')
  if (!config.discoveryUrl) missing.push('OIDC_DISCOVERY_URL')
  return missing.length ? missing.join(', ') : null
}
