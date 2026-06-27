import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'

export interface AuthUser {
  email: string
  name: string
  picture: string
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser
  }
}

export async function requireAuth(c: Context, next: Next) {
  // Auth disabled if no Google credentials configured (dev mode)
  if (!process.env.GOOGLE_CLIENT_ID) {
    c.set('user', { email: 'dev@localhost', name: 'Dev User', picture: '' })
    await next()
    return
  }

  const token = getCookie(c, 'session')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const secret = process.env.SESSION_SECRET ?? 'dev-secret-change-me'
    const payload = await verify(token, secret)
    c.set('user', payload as AuthUser)
    await next()
  } catch {
    return c.json({ error: 'Session expired' }, 401)
  }
}
