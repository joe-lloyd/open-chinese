import { useState } from 'react'
import { getCatalogEntry } from '../lib/catalog'
import { unlockOptions } from '../lib/entitlements'
import type { AccessResult } from '../lib/entitlements'
import { startCheckout } from '../lib/checkout'
import { LockIcon } from './LockBadge'

interface Props {
  /** A denied `canAccess` result. Renders nothing when access is allowed. */
  result: AccessResult
  title?: string
  description?: string
}

/**
 * The locked-content panel. Takes the `AccessResult` directly so it always offers
 * exactly the SKUs that would unlock what the user actually tried to reach — no
 * re-deriving why something was locked, and no generic "upgrade" dead end.
 */
export default function Paywall({ result, title, description }: Props) {
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (result.allowed) return null

  const skus = unlockOptions(result)

  async function buy(sku: string) {
    setError(null)
    setPending(sku)
    try {
      await startCheckout(sku)
    } catch (e) {
      setError((e as Error).message)
      setPending(null)
    }
  }

  return (
    <div className="bg-surface-raised border border-border rounded-2xl p-6 sm:p-8 space-y-5 text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-accent/10 text-accent flex items-center justify-center">
        <LockIcon size={20} />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-text-primary">{title ?? 'This content is locked'}</h2>
        <p className="text-sm text-text-muted max-w-md mx-auto">
          {description ??
            (result.reason === 'requires-pack'
              ? 'Buy this pack on its own, or get everything with Pro.'
              : 'Upgrade to Pro to unlock every level and every reader.')}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
        {skus.map((sku) => {
          const entry = getCatalogEntry(sku)
          const primary = sku === skus[0]
          return (
            <button
              key={sku}
              onClick={() => buy(sku)}
              disabled={pending !== null}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50 ${
                primary
                  ? 'bg-accent-solid text-on-accent hover:opacity-90'
                  : 'border border-border text-text-primary hover:bg-surface'
              }`}
            >
              {pending === sku
                ? 'Redirecting…'
                : entry
                  ? `${entry.label} — €${entry.priceEur}${entry.interval === 'year' ? '/yr' : ''}`
                  : `Unlock ${sku}`}
            </button>
          )
        })}
      </div>

      {error && (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-text-muted">{error} You can retry above or go back.</p>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="text-sm font-medium text-accent hover:underline"
          >
            Go back
          </button>
        </div>
      )}
    </div>
  )
}
