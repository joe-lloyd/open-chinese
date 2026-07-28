/**
 * Provider registry. The active provider is a server-side environment variable,
 * so switching from the Stripe reference implementation to Polar, Paddle or a
 * crypto processor is a config change plus one adapter file.
 *
 * Unset means payments are not configured — every endpoint answers 503 rather
 * than half-working.
 */

import { coinbaseCommerceProvider } from './crypto'
import { stripeProvider } from './stripe'
import type { PaymentProvider } from './types'

const PROVIDERS: Record<string, PaymentProvider> = {
  [stripeProvider.id]: stripeProvider,
  [coinbaseCommerceProvider.id]: coinbaseCommerceProvider,
}

export function getProvider(): PaymentProvider | null {
  const id = process.env.PAYMENT_PROVIDER
  if (!id) return null
  return PROVIDERS[id] ?? null
}

/** Absolute origin of the deployment. The marketing site is served from here. */
export function siteUrl(): string {
  const url = process.env.PUBLIC_SITE_URL ?? process.env.URL
  if (!url) throw new Error('PUBLIC_SITE_URL is not set')
  return url.replace(/\/$/, '')
}

/**
 * Absolute base of the app, which lives under /app — the origin root is the
 * marketing site.
 *
 * Every checkout and portal return URL must be built from this, not from
 * `siteUrl()`. A payment redirect landing on the origin root would drop a
 * customer who has just paid onto a marketing page, or onto a 404: the Netlify
 * SPA fallback is scoped to `/app/*`, so no route outside it resolves to the
 * app at all.
 */
export function appUrl(): string {
  return `${siteUrl()}/app`
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
