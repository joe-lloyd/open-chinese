import assert from 'node:assert/strict'
import test from 'node:test'
import { createCheckoutHandler } from './checkout'
import { isStaleSubscriptionEvent } from './_lib/firebase'
import type { EntitlementUpdate, PaymentProvider, WebhookEvent } from './_lib/types'
import { createPortalHandler } from './portal'
import { createWebhookHandler } from './webhook'

const ready = { status: 'ready', providerId: 'stripe', issues: [] } as const

function provider(overrides: Partial<PaymentProvider> = {}): PaymentProvider {
  return {
    id: 'stripe',
    createCheckoutSession: async () => ({ url: 'https://checkout.stripe.test/session' }),
    createPortalSession: async () => ({ url: 'https://billing.stripe.test/session' }),
    verifyWebhook: () => null,
    toEntitlementUpdate: () => null,
    ...overrides,
  }
}

test('checkout binds verified uid, validates SKU, and constructs app return URLs', async () => {
  let input: Parameters<PaymentProvider['createCheckoutSession']>[0] | null = null
  const handler = createCheckoutHandler({
    inspectConfiguration: () => ready,
    provider: () =>
      provider({
        createCheckoutSession: async (value) => {
          input = value
          return { url: 'https://checkout.stripe.test/session' }
        },
      }),
    verifyUser: async () => ({ uid: 'verified-user', email: 'reader@example.com' }),
    applicationUrl: () => 'https://openchinese.app/app',
  })
  const response = await handler(
    new Request('https://openchinese.app/.netlify/functions/checkout', {
      method: 'POST',
      body: JSON.stringify({ sku: 'pro-yearly', uid: 'attacker-controlled' }),
    })
  )

  assert.equal(response.status, 200)
  assert.ok(input)
  const captured = input as unknown as Parameters<PaymentProvider['createCheckoutSession']>[0]
  assert.equal(captured.uid, 'verified-user')
  assert.equal(
    captured.successUrl,
    'https://openchinese.app/app/billing/return?sku=pro-yearly'
  )
  assert.equal(captured.cancelUrl, 'https://openchinese.app/app/pricing')
})

test('checkout rejects unknown SKUs before calling the provider', async () => {
  let calls = 0
  const handler = createCheckoutHandler({
    inspectConfiguration: () => ready,
    provider: () =>
      provider({
        createCheckoutSession: async () => {
          calls += 1
          return { url: 'never' }
        },
      }),
    verifyUser: async () => ({ uid: 'u1', email: null }),
    applicationUrl: () => 'https://openchinese.app/app',
  })
  const response = await handler(
    new Request('https://openchinese.app/.netlify/functions/checkout', {
      method: 'POST',
      body: JSON.stringify({ sku: 'unknown' }),
    })
  )
  assert.equal(response.status, 400)
  assert.equal(calls, 0)
})

test('configuration and provider failures return stable sanitized responses', async () => {
  const unavailable = createCheckoutHandler({
    inspectConfiguration: () => ({
      status: 'invalid',
      providerId: 'stripe',
      issues: [{ code: 'missing_setting', setting: 'STRIPE_SECRET_KEY' }],
    }),
  })
  const response = await unavailable(
    new Request('https://openchinese.app/.netlify/functions/checkout', { method: 'POST' })
  )
  const body = await response.text()
  assert.equal(response.status, 503)
  assert.equal(body.includes('STRIPE_SECRET_KEY'), false)
  assert.deepEqual(JSON.parse(body), { error: 'payments_unavailable', retryable: true })

  const failing = createCheckoutHandler({
    inspectConfiguration: () => ready,
    provider: () =>
      provider({
        createCheckoutSession: async () => {
          throw new Error('secret provider payload')
        },
      }),
    verifyUser: async () => ({ uid: 'u1', email: null }),
    applicationUrl: () => 'https://openchinese.app/app',
  })
  const failed = await failing(
    new Request('https://openchinese.app/.netlify/functions/checkout', {
      method: 'POST',
      body: JSON.stringify({ sku: 'pro-yearly' }),
    })
  )
  assert.equal((await failed.text()).includes('secret provider payload'), false)
  assert.equal(failed.status, 502)
})

test('portal resolves the authenticated user customer and app return URL', async () => {
  let lookup: [string, string] | null = null
  let portalInput: { customerId: string; returnUrl: string } | null = null
  const handler = createPortalHandler({
    inspectConfiguration: () => ready,
    provider: () =>
      provider({
        createPortalSession: async (input) => {
          portalInput = input
          return { url: 'https://billing.stripe.test/session' }
        },
      }),
    verifyUser: async () => ({ uid: 'verified-user', email: null }),
    customerId: async (uid, providerId) => {
      lookup = [uid, providerId]
      return 'cus_owned'
    },
    applicationUrl: () => 'https://openchinese.app/app',
  })
  const response = await handler(
    new Request('https://openchinese.app/.netlify/functions/portal', { method: 'POST' })
  )
  assert.equal(response.status, 200)
  assert.deepEqual(lookup, ['verified-user', 'stripe'])
  assert.deepEqual(portalInput, {
    customerId: 'cus_owned',
    returnUrl: 'https://openchinese.app/app/pricing',
  })
})

function webhookProvider(update: EntitlementUpdate | null): PaymentProvider {
  const event: WebhookEvent = {
    id: 'evt_1',
    type: update ? 'customer.subscription.updated' : 'unhandled.event',
    createdAt: new Date(10_000),
    payload: {},
  }
  return provider({
    verifyWebhook: () => event,
    toEntitlementUpdate: () => update,
  })
}

test('webhook ignores unhandled events and deduplicates deliveries', async () => {
  const ignored = createWebhookHandler({
    inspectConfiguration: () => ready,
    provider: () => webhookProvider(null),
  })
  const ignoredResponse = await ignored(
    new Request('https://openchinese.app/.netlify/functions/webhook', {
      method: 'POST',
      body: 'raw',
    })
  )
  assert.deepEqual(await ignoredResponse.json(), { ok: true, ignored: 'unhandled.event' })

  let applied = false
  const duplicate = createWebhookHandler({
    inspectConfiguration: () => ready,
    provider: () => webhookProvider({ uid: 'u1', provider: 'stripe', plan: 'pro' }),
    claim: async () => 'duplicate',
    apply: async () => {
      applied = true
    },
  })
  const duplicateResponse = await duplicate(
    new Request('https://openchinese.app/.netlify/functions/webhook', {
      method: 'POST',
      body: 'raw',
    })
  )
  assert.deepEqual(await duplicateResponse.json(), { ok: true, duplicate: true })
  assert.equal(applied, false)
})

test('webhook keeps a concurrent in-progress delivery retryable', async () => {
  const handler = createWebhookHandler({
    inspectConfiguration: () => ready,
    provider: () => webhookProvider({ uid: 'u1', provider: 'stripe', plan: 'pro' }),
    claim: async () => 'in_progress',
  })
  const response = await handler(
    new Request('https://openchinese.app/.netlify/functions/webhook', {
      method: 'POST',
      body: 'raw',
    })
  )
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { error: 'event_in_progress', retryable: true })
})

test('interrupted webhook delivery releases its claim for provider retry', async () => {
  let released = ''
  let completed = false
  const handler = createWebhookHandler({
    inspectConfiguration: () => ready,
    provider: () => webhookProvider({ uid: 'u1', provider: 'stripe', plan: 'pro' }),
    claim: async () => 'claimed',
    apply: async () => {
      throw new Error('interrupted')
    },
    release: async (id) => {
      released = id
    },
    complete: async () => {
      completed = true
    },
  })
  const response = await handler(
    new Request('https://openchinese.app/.netlify/functions/webhook', {
      method: 'POST',
      body: 'raw',
    })
  )
  assert.equal(response.status, 500)
  assert.equal(released, 'evt_1')
  assert.equal(completed, false)
})

test('completion failure releases the claim after an idempotent write', async () => {
  let released = ''
  const handler = createWebhookHandler({
    inspectConfiguration: () => ready,
    provider: () => webhookProvider({ uid: 'u1', provider: 'stripe', plan: 'pro' }),
    claim: async () => 'claimed',
    apply: async () => {},
    complete: async () => {
      throw new Error('interrupted after write')
    },
    release: async (id) => {
      released = id
    },
  })
  const response = await handler(
    new Request('https://openchinese.app/.netlify/functions/webhook', {
      method: 'POST',
      body: 'raw',
    })
  )
  assert.equal(response.status, 500)
  assert.equal(released, 'evt_1')
})

test('stale subscription snapshots cannot overwrite newer state', () => {
  assert.equal(isStaleSubscriptionEvent(20_000, new Date(10_000)), true)
  assert.equal(isStaleSubscriptionEvent(10_000, new Date(20_000)), false)
  assert.equal(isStaleSubscriptionEvent(10_000, new Date(10_000)), false)
  assert.equal(isStaleSubscriptionEvent(null, new Date(10_000)), false)
})
