/**
 * POST /.netlify/functions/checkout
 *
 * Body: { sku }. Auth: `Authorization: Bearer <firebase-id-token>`.
 * Returns: { url } — the provider's hosted checkout page.
 *
 * The purchasing uid is taken from the verified ID token. A uid in the body is
 * never read, so a request authenticated as A can only ever buy for A.
 */

import { verifyRequestUser } from './_lib/firebase'
import { getProvider, json, siteUrl } from './_lib/providers'
import { isCatalogSku } from './_lib/types'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const provider = getProvider()
  if (!provider) return json(503, { error: 'payments_not_configured' })

  const user = await verifyRequestUser(req.headers)
  if (!user) return json(401, { error: 'unauthenticated' })

  let sku: unknown
  try {
    sku = ((await req.json()) as { sku?: unknown }).sku
  } catch {
    return json(400, { error: 'invalid_body' })
  }
  if (!isCatalogSku(sku)) return json(400, { error: 'unknown_sku' })

  try {
    const site = siteUrl()
    const { url } = await provider.createCheckoutSession({
      sku,
      uid: user.uid,
      email: user.email,
      successUrl: `${site}/billing/return?sku=${encodeURIComponent(sku)}`,
      cancelUrl: `${site}/pricing`,
    })
    return json(200, { url })
  } catch (e) {
    // Never surface provider internals to the browser.
    console.error('[checkout]', e)
    return json(502, { error: 'checkout_failed' })
  }
}
