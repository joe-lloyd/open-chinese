import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import { seedHsk } from './lib/seed.ts'
import { requireAuth } from './middleware/requireAuth.ts'
import authRoutes from './routes/auth.ts'
import importRoutes from './routes/import.ts'
import sessionRoutes from './routes/session.ts'
import pronounceRoutes from './routes/pronounce.ts'
import dashboardRoutes from './routes/dashboard.ts'
import wordsRoutes from './routes/words.ts'
import dictionaryRoutes from './routes/dictionary.ts'
import decksRoutes from './routes/decks.ts'

const ORIGINS = [
  process.env.APP_URL ?? 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: [...new Set(ORIGINS)],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
)

// Public routes
app.route('/auth', authRoutes)
app.get('/api/health', (c) => c.json({ ok: true }))

// Auth check endpoint (protected)
app.get('/api/auth/me', requireAuth, (c) => c.json(c.get('user')))

// Protected API routes
app.use('/api/*', requireAuth)
app.route('/api/import', importRoutes)
app.route('/api/session', sessionRoutes)
app.route('/api/pronounce', pronounceRoutes)
app.route('/api/dashboard', dashboardRoutes)
app.route('/api/words', wordsRoutes)
app.route('/api/dictionary', dictionaryRoutes)
app.route('/api/decks', decksRoutes)

const port = parseInt(process.env.PORT ?? '3001')

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on http://localhost:${port}`)
  const authMode = process.env.GOOGLE_CLIENT_ID ? 'Google OAuth' : 'dev (no auth)'
  console.log(`Auth mode: ${authMode}`)
  seedHsk().catch(console.error)
})
