import { useState } from 'react'
import {
  annualSavingsPercent,
  formatEuro,
  yearlyMonthlyEquivalentEur,
} from '@open-chinese/pricing'
import { CATALOG, OFFERED_SKUS } from '../lib/catalog'
import { PAYMENTS_ENABLED } from '../lib/entitlements'
import { openBillingPortal, startCheckout } from '../lib/checkout'
import { useEntitlements } from '../hooks/useEntitlements'
import { LockIcon } from '../components/LockBadge'

const PRO_FEATURES = [
  'HSK 1–9, with more than 10,900 words',
  'Every graded reader as they land',
  'Unlimited new cards per day',
  'Cancel any time from billing settings',
]

export default function PricingPage() {
  const { entitlements, isPro, loading, freeCountFor } = useEntitlements()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const proPlans = OFFERED_SKUS.filter((sku) => CATALOG[sku].kind === 'subscription')
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {proPlans.map((sku) => {
          const plan = CATALOG[sku]
          const recommended = plan.recommended === true
          const intervalLabel = plan.interval === 'month' ? 'month' : 'year'
          return (
            <div
              key={sku}
              className={`relative bg-surface-raised rounded-2xl p-6 space-y-5 flex flex-col ${
                recommended ? 'border-2 border-accent' : 'border border-border'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-2xl font-bold text-text-primary">{plan.label}</p>
                  {recommended && (
                    <span className="rounded-full bg-accent-solid px-2.5 py-1 text-xs font-medium text-on-accent">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-3xl font-bold text-text-primary">
                  {formatEuro(plan.priceEur)}
                  <span className="text-sm font-normal text-text-muted"> / {intervalLabel}</span>
                </p>
                <p className="min-h-5 text-xs text-text-muted">
                  {recommended
                    ? `${formatEuro(yearlyMonthlyEquivalentEur())}/month equivalent · save ${annualSavingsPercent()}%`
                    : 'Flexible monthly billing'}
                </p>
              </div>

              <ul className="space-y-2 flex-1">
                {PRO_FEATURES.map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm text-text-muted">
                    <CheckIcon />
                    <span>{feature}</span>
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
                  onClick={() => run(sku, () => startCheckout(sku))}
                  disabled={pending !== null || loading}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50 ${
                    recommended
                      ? 'bg-accent-solid text-on-accent hover:opacity-90'
                      : 'border border-border text-text-primary hover:bg-surface'
                  }`}
                >
                  {pending === sku ? 'Redirecting…' : `Choose ${intervalLabel}ly`}
                </button>
              )}
            </div>
          )
        })}

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
