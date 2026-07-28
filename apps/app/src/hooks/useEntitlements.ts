import { createContext, useContext } from 'react'
import type { AccessContext, AccessResult, Entitlements, Resource } from '../lib/entitlements'

export interface EntitlementsValue {
  entitlements: Entitlements
  isPro: boolean
  /** True until both the entitlement document and the free-tier index have loaded. */
  loading: boolean
  /** `canAccess` bound to the current user's entitlements and free allowance. */
  check: (resource: Resource, ctx?: AccessContext) => AccessResult
  /** How many words of a level a free account gets — drives "78 of 156 free" copy. */
  freeCountFor: (level: number) => number
}

export const EntitlementsContext = createContext<EntitlementsValue | null>(null)

export function useEntitlements(): EntitlementsValue {
  const ctx = useContext(EntitlementsContext)
  if (!ctx) throw new Error('useEntitlements must be used inside <EntitlementsProvider>')
  return ctx
}

/** Shorthand for the common case: one resource, one answer. */
export function useAccess(resource: Resource, ctx?: AccessContext): AccessResult {
  const { check } = useEntitlements()
  return check(resource, ctx)
}
