/**
 * POST /.netlify/functions/portal
 *
 * Auth: `Authorization: Bearer <firebase-id-token>`.
 * Returns: { url } — the provider's hosted billing portal.
 *
 * The customer id is looked up server-side from the caller's own billing
 * document, so a client cannot open a portal session for someone else's
 * subscription by supplying a customer id.
 */

import { getCustomerId, verifyRequestUser } from './_lib/firebase'
import { appUrl, getProvider, json } from './_lib/providers'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const provider = getProvider()
  if (!provider) return json(503, { error: 'payments_not_configured' })

  const user = await verifyRequestUser(req.headers)
  if (!user) return json(401, { error: 'unauthenticated' })

  try {
    const customerId = await getCustomerId(user.uid, provider.id)
    if (!customerId) return json(404, { error: 'no_billing_account' })

    const { url } = await provider.createPortalSession({
      customerId,
      // App route, not the marketing pricing page — this returns a signed-in
      // user from the billing portal to where they were.
      returnUrl: `${appUrl()}/pricing`,
    })
    return json(200, { url })
  } catch (e) {
    console.error('[portal]', e)
    return json(502, { error: 'portal_failed' })
  }
}
