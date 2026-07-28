import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getCatalogEntry } from '../lib/catalog'
import { useEntitlements } from '../hooks/useEntitlements'

/** How long to wait for the webhook before reassuring rather than spinning. */
const WAIT_MS = 20_000

/**
 * Where the provider sends the browser after checkout.
 *
 * The redirect itself proves nothing — anyone can type this URL — so nothing here
 * reads success from the query string. The `sku` parameter is only a hint about
 * *what* to wait for; the answer always comes from the entitlement document the
 * webhook writes, which no client can forge.
 */
export default function BillingReturnPage() {
  const [params] = useSearchParams()
  const { entitlements, isPro, loading } = useEntitlements()
  const [timedOut, setTimedOut] = useState(false)

  const sku = params.get('sku')
  const entry = sku ? getCatalogEntry(sku) : null

  const satisfied = sku
    ? entry?.kind === 'subscription'
      ? isPro
      : entitlements.packs.includes(sku)
    : isPro || entitlements.packs.length > 0

  useEffect(() => {
    if (satisfied) return
    const t = setTimeout(() => setTimedOut(true), WAIT_MS)
    return () => clearTimeout(t)
  }, [satisfied])

  return (
    <div className="p-4 sm:p-8 max-w-lg mx-auto">
      <div className="bg-surface-raised border border-border rounded-2xl p-8 text-center space-y-4">
        {satisfied ? (
          <>
            <div className="w-12 h-12 mx-auto rounded-full bg-accent/10 text-accent flex items-center justify-center text-2xl">
              ✓
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl font-semibold text-text-primary">You're all set</h1>
              <p className="text-sm text-text-muted">
                {entry ? `${entry.label} is unlocked.` : 'Your purchase is unlocked.'}
              </p>
            </div>
            <Link
              to="/hsk"
              className="inline-block px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Start studying
            </Link>
          </>
        ) : timedOut ? (
          <>
            <div className="space-y-1.5">
              <h1 className="text-xl font-semibold text-text-primary">Still processing</h1>
              <p className="text-sm text-text-muted">
                Your payment went through and nothing is lost — confirmations occasionally take a
                minute or two to reach us. This page will update on its own, or check back shortly.
              </p>
            </div>
            <Link to="/" className="inline-block text-sm text-accent hover:underline">
              Back to dashboard
            </Link>
          </>
        ) : (
          <>
            <div className="w-8 h-8 mx-auto border-2 border-border border-t-accent rounded-full animate-spin" />
            <p className="text-sm text-text-muted">
              {loading ? 'Loading your account…' : 'Confirming your purchase…'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
