import assert from 'node:assert/strict'
import test from 'node:test'
import {
  configurationSummary,
  inspectPaymentConfiguration,
  type PaymentEnvironment,
} from './payment-config'

function validStripe(overrides: PaymentEnvironment = {}): PaymentEnvironment {
  return {
    VITE_PAYMENTS_ENABLED: 'true',
    PAYMENT_PROVIDER: 'stripe',
    PUBLIC_SITE_URL: 'https://openchinese.app',
    STRIPE_SECRET_KEY: 'sk_test_secret',
    STRIPE_WEBHOOK_SECRET: 'whsec_secret',
    STRIPE_PRICE_PRO_YEARLY: 'price_yearly',
    ...overrides,
  }
}

test('accepts a complete Stripe launch configuration without network access', () => {
  assert.deepEqual(inspectPaymentConfiguration(validStripe()), {
    status: 'ready',
    providerId: 'stripe',
    issues: [],
  })
})

test('reports missing required settings but never includes their values', () => {
  const config = inspectPaymentConfiguration(
    validStripe({ STRIPE_WEBHOOK_SECRET: '', STRIPE_PRICE_PRO_YEARLY: '' })
  )
  assert.equal(config.status, 'invalid')
  assert.deepEqual(
    config.issues.map((issue) => issue.setting),
    ['STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_PRO_YEARLY']
  )
  assert.equal(configurationSummary(config).includes('sk_test_secret'), false)
})

test('does not require Price ids for hidden pack SKUs', () => {
  const config = inspectPaymentConfiguration(validStripe())
  assert.equal(config.status, 'ready')
})

test('rejects unknown providers with a stable issue', () => {
  const config = inspectPaymentConfiguration(validStripe({ PAYMENT_PROVIDER: 'mystery-pay' }))
  assert.equal(config.status, 'invalid')
  assert.deepEqual(config.issues, [{ code: 'unknown_provider' }])
})

test('disabled checkout is valid rollback state with no credentials', () => {
  assert.deepEqual(inspectPaymentConfiguration({}), {
    status: 'disabled',
    providerId: null,
    issues: [],
  })
})

test('webhooks remain available while checkout is disabled', () => {
  const config = inspectPaymentConfiguration(
    validStripe({
      VITE_PAYMENTS_ENABLED: 'false',
      PUBLIC_SITE_URL: undefined,
      STRIPE_PRICE_PRO_YEARLY: undefined,
    }),
    'webhook'
  )
  assert.equal(config.status, 'ready')
})

test('requires HTTPS except for local development', () => {
  assert.equal(
    inspectPaymentConfiguration(validStripe({ PUBLIC_SITE_URL: 'http://openchinese.app' })).status,
    'invalid'
  )
  assert.equal(
    inspectPaymentConfiguration(validStripe({ PUBLIC_SITE_URL: 'http://localhost:8888' })).status,
    'ready'
  )
})
