/**
 * POST /.netlify/functions/checkout
 *
 * The purchasing uid is taken from the verified ID token. A uid in the body is
 * never read, so an authenticated user can only buy for their own account.
 */

import { verifyRequestUser } from './_lib/firebase'
import {
  configurationSummary,
  failureSummary,
  inspectPaymentConfiguration,
  type PaymentConfiguration,
} from './_lib/payment-config'
import { appUrl, getProvider, json } from './_lib/providers'
import { isCatalogSku, SERVER_CATALOG, type PaymentProvider } from './_lib/types'

interface CheckoutDependencies {
  inspectConfiguration: () => PaymentConfiguration
  provider: () => PaymentProvider | null
  verifyUser: typeof verifyRequestUser
  applicationUrl: () => string
}

export function createCheckoutHandler(
  overrides: Partial<CheckoutDependencies> = {}
): (req: Request) => Promise<Response> {
  const dependencies: CheckoutDependencies = {
    inspectConfiguration: () => inspectPaymentConfiguration(process.env, 'checkout'),
    provider: getProvider,
    verifyUser: verifyRequestUser,
    applicationUrl: appUrl,
    ...overrides,
  }

  return async function handler(req: Request): Promise<Response> {
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

    const configuration = dependencies.inspectConfiguration()
    if (configuration.status !== 'ready') {
      console.error('[checkout] unavailable', configurationSummary(configuration))
      return json(503, { error: 'payments_unavailable', retryable: true })
    }

    const provider = dependencies.provider()
    if (!provider) {
      console.error('[checkout] configured provider is not registered')
      return json(503, { error: 'payments_unavailable', retryable: true })
    }

    const user = await dependencies.verifyUser(req.headers)
    if (!user) return json(401, { error: 'unauthenticated' })

    let sku: unknown
    try {
      sku = ((await req.json()) as { sku?: unknown }).sku
    } catch {
      return json(400, { error: 'invalid_body' })
    }
    // Same response for "not in the catalogue" and "in the catalogue but not
    // sellable": a hidden SKU with a leftover price id in the environment must
    // not be purchasable via a hand-crafted request, and the distinction is
    // nobody's business but ours.
    if (!isCatalogSku(sku) || !SERVER_CATALOG[sku].purchasable) {
      return json(400, { error: 'unknown_sku' })
    }

    try {
      const app = dependencies.applicationUrl()
      const { url } = await provider.createCheckoutSession({
        sku,
        uid: user.uid,
        email: user.email,
        successUrl: `${app}/billing/return?sku=${encodeURIComponent(sku)}`,
        cancelUrl: `${app}/pricing`,
      })
      return json(200, { url })
    } catch (error) {
      console.error('[checkout] provider request failed', failureSummary(error))
      return json(502, { error: 'checkout_unavailable', retryable: true })
    }
  }
}

export default createCheckoutHandler()
