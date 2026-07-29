/**
 * POST /.netlify/functions/portal
 *
 * The customer id is looked up from the authenticated user's server-owned
 * billing document; callers can never supply another customer's id.
 */

import { getCustomerId, verifyRequestUser } from './_lib/firebase'
import {
  configurationSummary,
  failureSummary,
  inspectPaymentConfiguration,
  type PaymentConfiguration,
} from './_lib/payment-config'
import { appUrl, getProvider, json } from './_lib/providers'
import type { PaymentProvider } from './_lib/types'

interface PortalDependencies {
  inspectConfiguration: () => PaymentConfiguration
  provider: () => PaymentProvider | null
  verifyUser: typeof verifyRequestUser
  customerId: typeof getCustomerId
  applicationUrl: () => string
}

export function createPortalHandler(
  overrides: Partial<PortalDependencies> = {}
): (req: Request) => Promise<Response> {
  const dependencies: PortalDependencies = {
    inspectConfiguration: () => inspectPaymentConfiguration(process.env, 'portal'),
    provider: getProvider,
    verifyUser: verifyRequestUser,
    customerId: getCustomerId,
    applicationUrl: appUrl,
    ...overrides,
  }

  return async function handler(req: Request): Promise<Response> {
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

    const configuration = dependencies.inspectConfiguration()
    if (configuration.status !== 'ready') {
      console.error('[portal] unavailable', configurationSummary(configuration))
      return json(503, { error: 'payments_unavailable', retryable: true })
    }

    const provider = dependencies.provider()
    if (!provider) {
      console.error('[portal] configured provider is not registered')
      return json(503, { error: 'payments_unavailable', retryable: true })
    }

    const user = await dependencies.verifyUser(req.headers)
    if (!user) return json(401, { error: 'unauthenticated' })

    try {
      const customerId = await dependencies.customerId(user.uid, provider.id)
      if (!customerId) return json(404, { error: 'no_billing_account' })
      const { url } = await provider.createPortalSession({
        customerId,
        returnUrl: `${dependencies.applicationUrl()}/pricing`,
      })
      return json(200, { url })
    } catch (error) {
      console.error('[portal] provider request failed', failureSummary(error))
      return json(502, { error: 'portal_unavailable', retryable: true })
    }
  }
}

export default createPortalHandler()
