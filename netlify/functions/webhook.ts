/**
 * POST /.netlify/functions/webhook
 *
 * The only path that can write entitlements. Order matters and is not
 * negotiable: verify the signature over the raw bytes, then claim the event id,
 * then write. Nothing touches Firestore before the signature is proven good.
 */

import { applyEntitlementUpdate, claimEvent, releaseEvent } from './_lib/firebase'
import { getProvider, json } from './_lib/providers'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const provider = getProvider()
  if (!provider) return json(503, { error: 'payments_not_configured' })

  // Raw, unparsed body — signature schemes hash the exact bytes sent, so any
  // parse-then-restringify round trip invalidates them.
  const rawBody = await req.text()

  const event = provider.verifyWebhook(rawBody, req.headers)
  if (!event) return json(400, { error: 'invalid_signature' })

  const update = provider.toEntitlementUpdate(event)
  // Valid but uninteresting. 2xx so the provider stops retrying it.
  if (!update) return json(200, { ok: true, ignored: event.type })

  // Providers retry and none guarantee once-only delivery, so a repeat is
  // normal traffic rather than an error.
  if (!(await claimEvent(event.id))) {
    return json(200, { ok: true, duplicate: true })
  }

  try {
    await applyEntitlementUpdate(update)
  } catch (e) {
    console.error('[webhook] entitlement write failed', event.id, e)
    // Drop the claim so the provider's retry is not swallowed as a duplicate,
    // and answer 5xx so it actually retries.
    await releaseEvent(event.id)
    return json(500, { error: 'write_failed' })
  }

  return json(200, { ok: true })
}
