import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { sign } from 'hono/jwt'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

function cfg() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3001/auth/google/callback',
    secret: process.env.SESSION_SECRET ?? 'dev-secret-change-me',
    appUrl: process.env.APP_URL ?? 'http://localhost:5173',
    allowedEmail: process.env.ALLOWED_EMAIL ?? '',
  }
}

const app = new Hono()

app.get('/google', (c) => {
  const { clientId, redirectUri } = cfg()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'email profile',
    access_type: 'offline',
    prompt: 'select_account',
  })
  return c.redirect(`${GOOGLE_AUTH_URL}?${params}`)
})

app.get('/google/callback', async (c) => {
  const { clientId, clientSecret, redirectUri, secret, appUrl, allowedEmail } = cfg()
  const code = c.req.query('code')
  if (!code) return c.redirect(`${appUrl}/login?error=no_code`)

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const tokens = (await tokenRes.json()) as { access_token?: string }
  if (!tokens.access_token) return c.redirect(`${appUrl}/login?error=token_exchange`)

  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const user = (await userRes.json()) as { email?: string; name?: string; picture?: string }
  if (!user.email) return c.redirect(`${appUrl}/login?error=no_email`)

  if (allowedEmail && user.email !== allowedEmail) {
    return c.redirect(`${appUrl}/login?error=unauthorized`)
  }

  const payload = {
    email: user.email,
    name: user.name ?? user.email,
    picture: user.picture ?? '',
    exp: Math.floor(Date.now() / 1000) + 86400 * 30,
  }
  const token = await sign(payload, secret)

  setCookie(c, 'session', token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 86400 * 30,
    secure: process.env.NODE_ENV === 'production',
  })

  return c.redirect(appUrl)
})

app.post('/logout', (c) => {
  deleteCookie(c, 'session', { path: '/' })
  return c.json({ ok: true })
})

export default app
