/**
 * Coinbase Commerce adapter — cryptocurrency payments.
 *
 * Ships as a working shape behind the same interface but is OFF unless
 * `PAYMENT_PROVIDER=coinbase-commerce` and the credentials are set. No merchant
 * of record offers crypto (see design.md D5), so the normal deployment is a card
 * provider for subscriptions plus this one for crypto — which is what the
 * provider registry allows.
 *
 * Two things to know before turning it on: crypto has no recurring billing, so
 * `pro-yearly` bought this way is a prepaid, non-renewing year; and crypto
 * payments are effectively irreversible, which removes chargeback risk and
 * removes easy refunds along with it.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { SERVER_CATALOG } from './types'
import type { CheckoutInput, EntitlementUpdate, PaymentProvider, WebhookEvent } from './types'

const API = 'https://api.commerce.coinbase.com'
const YEAR_MS = 365 * 24 * 60 * 60 * 1000

function apiKey(): string {
  const key = process.env.COINBASE_COMMERCE_API_KEY
  if (!key) throw new Error('COINBASE_COMMERCE_API_KEY is not set')
  return key
}

/** SKU `hsk-1` maps to `CRYPTO_PRICE_HSK_1`, a decimal euro amount. */
function priceFor(sku: string): string {
  const envVar = `CRYPTO_PRICE_${sku.toUpperCase().replace(/-/g, '_')}`
  const price = process.env[envVar]
  if (!price) throw new Error(`${envVar} is not set`)
  return price
}

export const coinbaseCommerceProvider: PaymentProvider = {
  id: 'coinbase-commerce',

  async createCheckoutSession(input: CheckoutInput): Promise<{ url: string }> {
    const res = await fetch(`${API}/charges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CC-Api-Key': apiKey(),
        'X-CC-Version': '2018-03-22',
      },
      body: JSON.stringify({
        name: input.sku,
        description: `OpenChinese — ${input.sku}`,
        pricing_type: 'fixed_price',
        local_price: { amount: priceFor(input.sku), currency: 'EUR' },
        // The uid is echoed back on the webhook; it originates from a verified
        // ID token, never from the browser.
        metadata: { uid: input.uid, sku: input.sku },
        redirect_url: input.successUrl,
        cancel_url: input.cancelUrl,
      }),
    })

    if (!res.ok) throw new Error(`Coinbase Commerce charge failed: ${res.status}`)
    const body = (await res.json()) as { data?: { hosted_url?: string } }
    const url = body.data?.hosted_url
    if (!url) throw new Error('Coinbase Commerce returned no hosted_url')
    return { url }
  },

  async createPortalSession(): Promise<{ url: string }> {
    // Crypto charges are one-off; there is no subscription to manage.
    throw new Error('Coinbase Commerce has no billing portal')
  },

  /**
   * Unlike Stripe's scheme, the Coinbase Commerce signature covers only the body
   * — there is no timestamp in the signed material, so a captured payload stays
   * replayable forever. Replay protection therefore rests *entirely* on the
   * `webhookEvents` ledger being permanent.
   *
   * If a TTL policy is ever added to `webhookEvents`, a freshness check on
   * `created_at` must be added here first, or expiring a ledger entry re-opens
   * the replay window for that event.
   */
  verifyWebhook(rawBody: string, headers: Headers): WebhookEvent | null {
    const signature = headers.get('x-cc-webhook-signature')
    const secret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET
    if (!signature || !secret) return null

    const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
    const received = Buffer.from(signature, 'utf8')
    const computed = Buffer.from(expected, 'utf8')
    // Length check first: timingSafeEqual throws on a mismatch.
    if (received.length !== computed.length || !timingSafeEqual(received, computed)) {
      console.error('[coinbase] webhook signature rejected')
      return null
    }

    try {
      const parsed = JSON.parse(rawBody) as {
        event?: { id?: string; type?: string; created_at?: string; data?: unknown }
      }
      const { id, type, created_at, data } = parsed.event ?? {}
      if (!id || !type) return null
      const createdAt = created_at ? new Date(created_at) : null
      return {
        id,
        type,
        createdAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null,
        payload: data,
      }
    } catch {
      return null
    }
  },

  toEntitlementUpdate(event: WebhookEvent): EntitlementUpdate | null {
    // `charge:confirmed` means the payment has enough on-chain confirmations.
    // `charge:pending` deliberately grants nothing — an unconfirmed transaction
    // can still fail.
    if (event.type !== 'charge:confirmed') return null

    const charge = event.payload as { metadata?: Record<string, string> }
    const uid = charge.metadata?.uid
    const sku = charge.metadata?.sku
    if (!uid || !sku || !(sku in SERVER_CATALOG)) return null

    if (!SERVER_CATALOG[sku as keyof typeof SERVER_CATALOG].recurring) {
      return { uid, provider: 'coinbase-commerce', addPacks: [sku] }
    }

    return {
      uid,
      provider: 'coinbase-commerce',
      plan: 'pro',
      planSource: 'subscription',
      status: 'active',
      // Prepaid year. Nothing renews it, so it lapses on this date by design.
      currentPeriodEnd: new Date(Date.now() + YEAR_MS),
    }
  },
}
