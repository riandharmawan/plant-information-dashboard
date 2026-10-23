export function appPublicOrigin() {
  return (process.env.APP_PUBLIC_ORIGIN || 'http://localhost:5176').replace(/\/$/, '')
}

export function redirectToSsoError(res, code) {
  const safeCode = encodeURIComponent(String(code || 'unknown'))
  return res.redirect(302, `${appPublicOrigin()}/sso-error?code=${safeCode}`)
}
