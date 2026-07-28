/**
 * Stripe adapter — the reference implementation of `PaymentProvider`.
 *
 * Deliberately not the launch recommendation (see design.md D5: Polar is
 * recommended for its merchant-of-record VAT handling). Stripe is the reference
 * because its test mode needs no application, so the whole funnel can be
 * exercised before committing to a merchant relationship, and because Polar and
 * Paddle both imitate this Checkout-Session-plus-signed-webhook shape.
 *
 * Everything Stripe-specific stops at this file.
 */

import Stripe from 'stripe'
import { SERVER_CATALOG } from './types'
import type {
  CheckoutInput,
  EntitlementUpdate,
  PaymentProvider,
  SubscriptionStatus,
  WebhookEvent,
} from './types'

let client: Stripe | null = null

function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
    client = new Stripe(key)
  }
  return client
}

/** SKU `hsk-1` maps to `STRIPE_PRICE_HSK_1`. Price ids never live in the repo. */
function priceIdFor(sku: string): string {
  const envVar = `STRIPE_PRICE_${sku.toUpperCase().replace(/-/g, '_')}`
  const priceId = process.env[envVar]
  if (!priceId) throw new Error(`${envVar} is not set`)
  return priceId
}

/**
 * Stripe's own status vocabulary, narrowed to ours. Anything unrecognised maps
 * to `expired` so an unfamiliar state removes access rather than granting it.
 */
function mapStatus(status: string): SubscriptionStatus {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'canceled':
      return 'canceled'
    default:
      return 'expired'
  }
}

/**
 * Subscription payloads are read defensively rather than through Stripe's
 * version-pinned types: `current_period_end` sits on the subscription in older
 * API versions and on the subscription item in newer ones, and a reference
 * implementation should survive whichever version the owner's account is on.
 */
interface RawSubscription {
  status?: string
  customer?: unknown
  current_period_end?: number
  metadata?: Record<string, string>
  items?: { data?: Array<{ current_period_end?: number }> }
}

function periodEnd(sub: RawSubscription): Date | null {
  const seconds = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end
  return typeof seconds === 'number' ? new Date(seconds * 1000) : null
}

function customerId(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id
  }
  return null
}

export const stripeProvider: PaymentProvider = {
  id: 'stripe',

  async createCheckoutSession(input: CheckoutInput): Promise<{ url: string }> {
    const recurring = SERVER_CATALOG[input.sku].recurring
    const metadata = { uid: input.uid, sku: input.sku }

    const session = await stripe().checkout.sessions.create({
      mode: recurring ? 'subscription' : 'payment',
      line_items: [{ price: priceIdFor(input.sku), quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.uid,
      ...(input.email ? { customer_email: input.email } : {}),
      metadata,
      // Session metadata is NOT copied onto the subscription, so later
      // `customer.subscription.*` events would arrive with no uid to attribute
      // them to. Stamping it here is what makes renewals and cancellations
      // attributable.
      ...(recurring ? { subscription_data: { metadata } } : {}),
    })

    if (!session.url) throw new Error('Stripe returned a session with no URL')
    return { url: session.url }
  },

  async createPortalSession(input): Promise<{ url: string }> {
    const session = await stripe().billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
    })
    return { url: session.url }
  },

  verifyWebhook(rawBody: string, headers: Headers): WebhookEvent | null {
    const signature = headers.get('stripe-signature')
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!signature || !secret) return null
    try {
      // Verifies the HMAC over the raw bytes and rejects stale timestamps.
      const event = stripe().webhooks.constructEvent(rawBody, signature, secret)
      return { id: event.id, type: event.type, payload: event.data.object }
    } catch (e) {
      console.error('[stripe] webhook signature rejected', e)
      return null
    }
  },

  toEntitlementUpdate(event: WebhookEvent): EntitlementUpdate | null {
    switch (event.type) {
      // One-off pack purchases. Subscriptions are handled through the
      // subscription events instead, because only those carry a period end.
      case 'checkout.session.completed': {
        const session = event.payload as {
          mode?: string
          metadata?: Record<string, string>
          customer?: unknown
        }
        if (session.mode !== 'payment') return null
        const uid = session.metadata?.uid
        const sku = session.metadata?.sku
        if (!uid || !sku) return null
        return {
          uid,
          provider: 'stripe',
          addPacks: [sku],
          customerId: customerId(session.customer),
        }
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.payload as RawSubscription
        const uid = sub.metadata?.uid
        if (!uid) return null
        const status = mapStatus(sub.status ?? '')
        return {
          uid,
          provider: 'stripe',
          plan: status === 'active' || status === 'past_due' ? 'pro' : 'free',
          planSource: 'subscription',
          status,
          currentPeriodEnd: periodEnd(sub),
          customerId: customerId(sub.customer),
        }
      }

      // Fires at the end of the paid period for a cancel-at-period-end, or
      // immediately for an instant cancellation — so access ends exactly when
      // Stripe says it does, with no date arithmetic here.
      case 'customer.subscription.deleted': {
        const sub = event.payload as RawSubscription
        const uid = sub.metadata?.uid
        if (!uid) return null
        return {
          uid,
          provider: 'stripe',
          plan: 'free',
          planSource: 'subscription',
          status: 'canceled',
          currentPeriodEnd: periodEnd(sub),
          customerId: customerId(sub.customer),
        }
      }

      default:
        return null
    }
  },
}
