import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { subscribeEntitlements } from '../lib/firestore'
import { loadDB } from '../lib/worddb'
import {
  buildFreeWordSets,
  canAccess,
  freeWordPredicate,
  isPro as computeIsPro,
  FREE_ENTITLEMENTS,
  PAYMENTS_ENABLED,
} from '../lib/entitlements'
import type { Entitlements } from '../lib/entitlements'
import { EntitlementsContext } from './useEntitlements'
import type { EntitlementsValue } from './useEntitlements'

/**
 * Streams the user's entitlement document and pairs it with the free-tier index,
 * so every gate in the app answers from one live source rather than each call
 * site doing its own read.
 */
export function EntitlementsProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)
  const [freeSets, setFreeSets] = useState<Map<number, Set<string>> | null>(null)

  useEffect(() => {
    // With payments off there is no document to watch and every gate is open,
    // so skip the listener entirely rather than subscribing to nothing.
    if (!PAYMENTS_ENABLED) {
      setEntitlements(FREE_ENTITLEMENTS)
      return
    }
    setEntitlements(null)
    return subscribeEntitlements(uid, setEntitlements)
  }, [uid])

  useEffect(() => {
    if (!PAYMENTS_ENABLED) {
      setFreeSets(new Map())
      return
    }
    let cancelled = false
    loadDB()
      .then((wdb) => {
        if (!cancelled) setFreeSets(buildFreeWordSets((level) => wdb.getWordsByLevel(level)))
      })
      .catch((e) => {
        console.error('[entitlements] free tier index', e)
        if (!cancelled) setFreeSets(new Map())
      })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<EntitlementsValue>(() => {
    // Until the snapshot lands, treat the user as free rather than as Pro —
    // a paywall that flashes is better than paid content that flashes.
    const ent = entitlements ?? FREE_ENTITLEMENTS
    const sets = freeSets ?? new Map<number, Set<string>>()
    const isFreeWord = freeWordPredicate(sets)
    return {
      entitlements: ent,
      isPro: computeIsPro(ent),
      loading: entitlements === null || freeSets === null,
      check: (resource, ctx) => canAccess(resource, ent, { isFreeWord, ...ctx }),
      freeCountFor: (level) => sets.get(level)?.size ?? 0,
    }
  }, [entitlements, freeSets])

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>
}
