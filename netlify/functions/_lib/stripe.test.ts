import assert from 'node:assert/strict'
import test from 'node:test'
import type Stripe from 'stripe'
import { createStripeProvider, type StripeSdk } from './stripe'
import type { WebhookEvent } from './types'

function sdk(overrides: Partial<StripeSdk> = {}): StripeSdk {
  return {
    checkout: {
      sessions: { create: async () => ({ url: 'https://checkout.stripe.test/session' }) },
    },
    billingPortal: {
      sessions: { create: async () => ({ url: 'https://billing.stripe.test/session' }) },
    },
    webhooks: {
      constructEvent: () => {
        throw new Error('not configured')
      },
    },
    ...overrides,
  }
}

const checkoutInput = {
  sku: 'pro-yearly' as const,
  uid: 'verified-user',
  email: 'reader@example.com',
  successUrl: 'https://openchinese.app/app/billing/return?sku=pro-yearly',
  cancelUrl: 'https://openchinese.app/app/pricing',
}

test('creates hosted subscription Checkout with provider-managed payment methods', async () => {
  let params: Stripe.Checkout.SessionCreateParams | null = null
  const provider = createStripeProvider(
    () =>
      sdk({
        checkout: {
          sessions: {
            create: async (input) => {
              params = input
              return { url: 'https://checkout.stripe.test/session' }
            },
          },
        },
      }),
    () =>
      ({
        STRIPE_PRICE_PRO_YEARLY: 'price_yearly',
        STRIPE_WEBHOOK_SECRET: 'whsec_test',
      }) as NodeJS.ProcessEnv
  )

  assert.deepEqual(await provider.createCheckoutSession(checkoutInput), {
    url: 'https://checkout.stripe.test/session',
  })
  assert.ok(params)
  const captured = params as unknown as Stripe.Checkout.SessionCreateParams
  assert.equal(captured.mode, 'subscription')
  assert.deepEqual(captured.line_items, [{ price: 'price_yearly', quantity: 1 }])
  assert.equal(captured.client_reference_id, 'verified-user')
  assert.deepEqual(captured.metadata, { uid: 'verified-user', sku: 'pro-yearly' })
  assert.deepEqual(captured.subscription_data?.metadata, {
    uid: 'verified-user',
    sku: 'pro-yearly',
  })
  assert.equal(Object.hasOwn(captured, 'payment_method_types'), false)
})

test('verifies the exact raw webhook body and rejects bad signatures', () => {
  let observed: [string, string, string] | null = null
  const provider = createStripeProvider(
    () =>
      sdk({
        webhooks: {
          constructEvent: (body, signature, secret) => {
            observed = [body, signature, secret]
            if (signature === 'bad') throw new Error('bad signature')
            return {
              id: 'evt_1',
              type: 'customer.subscription.updated',
              created: 42,
              data: { object: { metadata: { uid: 'u1' }, status: 'active' } },
            } as unknown as Stripe.Event
          },
        },
      }),
    () => ({ STRIPE_WEBHOOK_SECRET: 'whsec_test' }) as NodeJS.ProcessEnv
  )

  const raw = '{"spacing":  "must stay"}'
  const event = provider.verifyWebhook(raw, new Headers({ 'stripe-signature': 'good' }))
  assert.deepEqual(observed, [raw, 'good', 'whsec_test'])
  assert.equal(event?.id, 'evt_1')
  assert.equal(
    provider.verifyWebhook(raw, new Headers({ 'stripe-signature': 'bad' })),
    null
  )
})

test('maps subscription activation, past-due, cancellation, expiry, and packs', () => {
  const provider = createStripeProvider(() => sdk())
  const event = (type: string, payload: unknown): WebhookEvent => ({
    id: `evt_${type}`,
    type,
    createdAt: new Date(),
    payload,
  })

  assert.deepEqual(
    provider.toEntitlementUpdate(
      event('customer.subscription.updated', {
        metadata: { uid: 'u1' },
        status: 'active',
        customer: 'cus_1',
        current_period_end: 100,
      })
    ),
    {
      uid: 'u1',
      provider: 'stripe',
      plan: 'pro',
      planSource: 'subscription',
      status: 'active',
      currentPeriodEnd: new Date(100_000),
      customerId: 'cus_1',
    }
  )
  assert.equal(
    provider.toEntitlementUpdate(
      event('customer.subscription.updated', {
        metadata: { uid: 'u1' },
        status: 'past_due',
      })
    )?.plan,
    'pro'
  )
  assert.deepEqual(
    provider.toEntitlementUpdate(
      event('customer.subscription.deleted', {
        metadata: { uid: 'u1' },
        customer: 'cus_1',
      })
    )?.status,
    'canceled'
  )
  assert.deepEqual(
    provider.toEntitlementUpdate(
      event('customer.subscription.updated', {
        metadata: { uid: 'u1' },
        status: 'unpaid',
      })
    )?.plan,
    'free'
  )
  assert.deepEqual(
    provider.toEntitlementUpdate(
      event('checkout.session.completed', {
        mode: 'payment',
        metadata: { uid: 'u1', sku: 'hsk-1' },
      })
    )?.addPacks,
    ['hsk-1']
  )
  assert.equal(
    provider.toEntitlementUpdate(
      event('checkout.session.completed', {
        mode: 'payment',
        metadata: { uid: 'u1', sku: 'invented' },
      })
    ),
    null
  )
})
