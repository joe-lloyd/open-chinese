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

/** Absolute origin for building checkout return URLs. */
export function siteUrl(): string {
  const url = process.env.PUBLIC_SITE_URL ?? process.env.URL
  if (!url) throw new Error('PUBLIC_SITE_URL is not set')
  return url.replace(/\/$/, '')
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
