/**
 * POST /.netlify/functions/webhook
 *
 * Verify the signature over the raw bytes, claim the event id, then write.
 * Nothing touches Firestore before the provider signature is proven valid.
 */

import { applyEntitlementUpdate, claimEvent, completeEvent, releaseEvent } from './_lib/firebase'
import {
  configurationSummary,
  failureSummary,
  inspectPaymentConfiguration,
  type PaymentConfiguration,
} from './_lib/payment-config'
import { getProvider, json } from './_lib/providers'
import type { EntitlementUpdate, PaymentProvider } from './_lib/types'

interface WebhookDependencies {
  inspectConfiguration: () => PaymentConfiguration
  provider: () => PaymentProvider | null
  claim: typeof claimEvent
  apply: (update: EntitlementUpdate, eventAt: Date | null) => Promise<void>
  complete: typeof completeEvent
  release: typeof releaseEvent
}

export function createWebhookHandler(
  overrides: Partial<WebhookDependencies> = {}
): (req: Request) => Promise<Response> {
  const dependencies: WebhookDependencies = {
    inspectConfiguration: () => inspectPaymentConfiguration(process.env, 'webhook'),
    provider: getProvider,
    claim: claimEvent,
    apply: applyEntitlementUpdate,
    complete: completeEvent,
    release: releaseEvent,
    ...overrides,
  }

  return async function handler(req: Request): Promise<Response> {
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

    const configuration = dependencies.inspectConfiguration()
    if (configuration.status !== 'ready') {
      console.error('[webhook] unavailable', configurationSummary(configuration))
      return json(503, { error: 'payments_unavailable', retryable: true })
    }

    const provider = dependencies.provider()
    if (!provider) {
      console.error('[webhook] configured provider is not registered')
      return json(503, { error: 'payments_unavailable', retryable: true })
    }

    const rawBody = await req.text()
    const event = provider.verifyWebhook(rawBody, req.headers)
    if (!event) return json(400, { error: 'invalid_signature' })

    const update = provider.toEntitlementUpdate(event)
    if (!update) return json(200, { ok: true, ignored: event.type })

    let claim
    try {
      claim = await dependencies.claim(event.id)
    } catch (error) {
      console.error('[webhook] event claim failed', event.id, failureSummary(error))
      return json(500, { error: 'claim_failed', retryable: true })
    }
    if (claim === 'duplicate') {
      return json(200, { ok: true, duplicate: true })
    }
    if (claim === 'in_progress') {
      return json(409, { error: 'event_in_progress', retryable: true })
    }

    try {
      await dependencies.apply(update, event.createdAt)
    } catch (error) {
      console.error('[webhook] entitlement write failed', event.id, failureSummary(error))
      await dependencies.release(event.id)
      return json(500, { error: 'write_failed', retryable: true })
    }

    try {
      await dependencies.complete(event.id)
    } catch (error) {
      // Returning 5xx is important: the entitlement write is idempotent and a
      // retry can safely repair a completion marker interrupted after the write.
      console.error('[webhook] event completion failed', event.id, failureSummary(error))
      await dependencies.release(event.id)
      return json(500, { error: 'completion_failed', retryable: true })
    }

    return json(200, { ok: true })
  }
}

export default createWebhookHandler()
