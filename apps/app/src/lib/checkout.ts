/**
 * Client half of the payment funnel.
 *
 * All this does is ask the server for a hosted checkout URL and navigate to it.
 * No card fields, no provider SDK, no publishable key — the browser never sees
 * payment data, so there is no PCI surface here to get wrong.
 */

import { getIdToken } from './auth'

const FUNCTIONS = '/.netlify/functions'

const ERRORS: Record<string, string> = {
  payments_not_configured: 'Payments are not switched on yet.',
  unauthenticated: 'Please sign in again and retry.',
  unknown_sku: 'That item is no longer available.',
  no_billing_account: 'No subscription found for this account.',
  checkout_failed: 'Could not reach the payment provider. Please try again.',
  portal_failed: 'Could not open the billing portal. Please try again.',
}

async function post(path: string, body?: unknown): Promise<string> {
  const token = await getIdToken()
  if (!token) throw new Error('Please sign in to continue.')

  const res = await fetch(`${FUNCTIONS}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
  })

  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!res.ok || !data.url) {
    throw new Error(ERRORS[data.error ?? ''] ?? 'Something went wrong. Please try again.')
  }
  return data.url
}

/** Redirects the browser to the provider's hosted checkout page. */
export async function startCheckout(sku: string): Promise<void> {
  window.location.href = await post('checkout', { sku })
}

/** Redirects to the provider's hosted billing portal to manage or cancel. */
export async function openBillingPortal(): Promise<void> {
  window.location.href = await post('portal')
}
