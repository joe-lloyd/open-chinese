import { useState } from 'react'
import { CATALOG, OFFERED_SKUS, SUBSCRIPTION_SKU } from '../lib/catalog'
import { PAYMENTS_ENABLED } from '../lib/entitlements'
import { openBillingPortal, startCheckout } from '../lib/checkout'
import { useEntitlements } from '../hooks/useEntitlements'
import { LockIcon } from '../components/LockBadge'

const PRO_FEATURES = [
  'HSK 1–9, with more than 10,900 words',
  'Every graded reader as they land',
  'Unlimited new cards per day',
  'Cancel any time — no auto-renew surprises',
]

export default function PricingPage() {
  const { entitlements, isPro, loading, freeCountFor } = useEntitlements()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pro = CATALOG[SUBSCRIPTION_SKU]
  const offeredPacks = OFFERED_SKUS.filter((sku) => CATALOG[sku].kind === 'pack')
  const freeHsk1 = freeCountFor(1)

  async function run(key: string, action: () => Promise<void>) {
    setError(null)
    setPending(key)
    try {
      await action()
    } catch (e) {
      setError((e as Error).message)
      setPending(null)
    }
  }

  if (!PAYMENTS_ENABLED) {
    return (
      <div className="p-4 sm:p-8 max-w-2xl mx-auto">
        <div className="bg-surface-raised border border-border rounded-2xl p-8 text-center space-y-2">
          <h1 className="text-xl font-semibold text-text-primary">Everything is free right now</h1>
          <p className="text-sm text-text-muted">
            Paid plans are not switched on yet. Every level and every word is unlocked.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-text-primary">Plans</h1>
        <p className="text-sm text-text-muted">
          {loading
            ? 'Checking your plan…'
            : isPro
              ? 'You are on Pro. Everything is unlocked.'
              : `You are on the free plan — the first ${freeHsk1} words of HSK 1.`}
        </p>
      </header>

      {error && (
        <p className="text-sm text-text-primary bg-surface-raised border border-border rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <div
        className={`grid grid-cols-1 gap-4 ${offeredPacks.length > 0 ? 'lg:grid-cols-3' : 'max-w-md mx-auto w-full'}`}
      >
        {/* Subscription */}
        <div className="lg:col-span-1 bg-surface-raised border-2 border-accent rounded-2xl p-6 space-y-5 flex flex-col">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-accent">Best value</p>
            <p className="text-2xl font-bold text-text-primary">{pro.label}</p>
            <p className="text-3xl font-bold text-text-primary">
              €{pro.priceEur}
              <span className="text-sm font-normal text-text-muted"> / year</span>
            </p>
          </div>

          <ul className="space-y-2 flex-1">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex gap-2 text-sm text-text-muted">
                <CheckIcon />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {isPro ? (
            <div className="space-y-2">
              {entitlements.currentPeriodEnd && (
                <p className="text-xs text-text-muted text-center">
                  {entitlements.status === 'canceled' ? 'Access ends' : 'Renews'}{' '}
                  {entitlements.currentPeriodEnd.toLocaleDateString()}
                </p>
              )}
              <button
                onClick={() => run('portal', openBillingPortal)}
                disabled={pending !== null}
                className="w-full py-2.5 border border-border text-text-primary rounded-xl text-sm font-medium hover:bg-surface transition-colors disabled:opacity-50"
              >
                {pending === 'portal' ? 'Opening…' : 'Manage subscription'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => run(SUBSCRIPTION_SKU, () => startCheckout(SUBSCRIPTION_SKU))}
              disabled={pending !== null || loading}
              className="w-full py-2.5 bg-accent-solid text-on-accent rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {pending === SUBSCRIPTION_SKU ? 'Redirecting…' : 'Get Pro'}
            </button>
          )}
        </div>

        {/* One-off packs. Empty in the MVP — see OFFERED_SKUS in catalog.ts. */}
        {offeredPacks.length > 0 && (
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Or buy a level outright</h2>
            <span className="text-xs text-text-muted">One payment, yours for good</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {offeredPacks.map((sku) => {
              const entry = CATALOG[sku]
              const owned = isPro || entitlements.packs.includes(sku)
              return (
                <div
                  key={sku}
                  className="bg-surface-raised border border-border rounded-2xl p-5 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-text-primary">{entry.label}</p>
                      <p className="text-xs text-text-muted">{entry.description}</p>
                    </div>
                    <p className="text-lg font-bold text-text-primary whitespace-nowrap">
                      €{entry.priceEur}
                    </p>
                  </div>

                  {owned ? (
                    <p className="text-xs font-medium text-accent flex items-center gap-1.5">
                      <CheckIcon /> Unlocked
                    </p>
                  ) : (
                    <button
                      onClick={() => run(sku, () => startCheckout(sku))}
                      disabled={pending !== null || loading}
                      className="w-full py-2 border border-border text-text-primary rounded-xl text-sm font-medium hover:bg-surface transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {pending === sku ? (
                        'Redirecting…'
                      ) : (
                        <>
                          <LockIcon /> Unlock
                        </>
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        )}
      </div>

      <p className="text-xs text-text-muted text-center">
        Payments are handled entirely by our payment provider on their own checkout page. Card details
        never reach OpenChinese.
      </p>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0 mt-0.5 text-accent"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
