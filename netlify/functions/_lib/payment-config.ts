import { SERVER_CATALOG } from './types'

export type PaymentEnvironment = Readonly<Record<string, string | undefined>>
export type PaymentEndpoint = 'checkout' | 'portal' | 'webhook'

export interface PaymentConfigurationIssue {
  code: 'missing_setting' | 'invalid_site_url' | 'unknown_provider'
  setting?: string
}

export type PaymentConfiguration =
  | { status: 'disabled'; providerId: string | null; issues: readonly [] }
  | { status: 'invalid'; providerId: string | null; issues: readonly PaymentConfigurationIssue[] }
  | { status: 'ready'; providerId: string; issues: readonly [] }

export function providerPriceSetting(prefix: 'STRIPE_PRICE' | 'CRYPTO_PRICE', sku: string): string {
  return `${prefix}_${sku.toUpperCase().replace(/-/g, '_')}`
}

function missing(env: PaymentEnvironment, setting: string): PaymentConfigurationIssue[] {
  return env[setting]?.trim() ? [] : [{ code: 'missing_setting', setting }]
}

function siteUrlIssues(env: PaymentEnvironment): PaymentConfigurationIssue[] {
  const raw = env.PUBLIC_SITE_URL?.trim() || env.URL?.trim()
  if (!raw) return [{ code: 'missing_setting', setting: 'PUBLIC_SITE_URL' }]
  try {
    const parsed = new URL(raw)
    const localHttp = parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)
    return parsed.protocol === 'https:' || localHttp ? [] : [{ code: 'invalid_site_url' }]
  } catch {
    return [{ code: 'invalid_site_url' }]
  }
}

function priceIssues(env: PaymentEnvironment, prefix: 'STRIPE_PRICE' | 'CRYPTO_PRICE') {
  return Object.entries(SERVER_CATALOG).flatMap(([sku, entry]) =>
    entry.purchasable ? missing(env, providerPriceSetting(prefix, sku)) : []
  )
}

/**
 * Pure, network-free validation of the active payment configuration.
 *
 * Checkout and portal obey the shared build/runtime rollback flag. Webhooks keep
 * running while checkout is disabled so cancellations and renewals still update
 * existing customers during an incident.
 */
export function inspectPaymentConfiguration(
  env: PaymentEnvironment = process.env,
  endpoint: PaymentEndpoint = 'checkout'
): PaymentConfiguration {
  const providerId = env.PAYMENT_PROVIDER?.trim() || null
  if (endpoint !== 'webhook' && env.VITE_PAYMENTS_ENABLED !== 'true') {
    return { status: 'disabled', providerId, issues: [] }
  }
  if (!providerId) {
    return {
      status: 'invalid',
      providerId: null,
      issues: [{ code: 'missing_setting', setting: 'PAYMENT_PROVIDER' }],
    }
  }

  const common = endpoint === 'webhook' ? [] : siteUrlIssues(env)
  let issues: PaymentConfigurationIssue[]
  switch (providerId) {
    case 'stripe':
      issues = [
        ...common,
        ...missing(env, 'STRIPE_SECRET_KEY'),
        ...missing(env, 'STRIPE_WEBHOOK_SECRET'),
        ...(endpoint === 'webhook' ? [] : priceIssues(env, 'STRIPE_PRICE')),
      ]
      break
    case 'coinbase-commerce':
      issues = [
        ...common,
        ...missing(env, 'COINBASE_COMMERCE_API_KEY'),
        ...missing(env, 'COINBASE_COMMERCE_WEBHOOK_SECRET'),
        ...(endpoint === 'webhook' ? [] : priceIssues(env, 'CRYPTO_PRICE')),
      ]
      break
    default:
      issues = [{ code: 'unknown_provider' }]
  }

  return issues.length > 0
    ? { status: 'invalid', providerId, issues }
    : { status: 'ready', providerId, issues: [] }
}

/** Safe for logs: names missing settings, but never includes values or payloads. */
export function configurationSummary(config: PaymentConfiguration): string {
  if (config.status === 'ready') return `${config.providerId}:ready`
  if (config.status === 'disabled') return `${config.providerId ?? 'none'}:disabled`
  return config.issues
    .map((issue) => (issue.setting ? `${issue.code}:${issue.setting}` : issue.code))
    .join(',')
}

/** Avoid logging provider response bodies, messages, stacks, or credentials. */
export function failureSummary(error: unknown): string {
  if (error instanceof Error && error.name) return error.name
  return 'UnknownError'
}
