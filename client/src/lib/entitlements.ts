/**
 * The entitlement model and the single access decision.
 *
 * Entitlements live at `users/{uid}/entitlements/current` and are written only by
 * the payment webhook through the Firebase Admin SDK. Security rules deny every
 * client write, so nothing here can be forged from the browser.
 *
 * What that does *not* buy: `words.db` is a public static file, so gating below
 * is a purchase prompt, not a lock. See design.md D10.
 */

import { CATALOG, FREE_TIER, SUBSCRIPTION_SKU, skuForHskLevel } from './catalog'

export type Plan = 'free' | 'pro'
export type PlanSource = 'subscription' | 'grant'
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'expired'

export interface Entitlements {
  plan: Plan
  planSource: PlanSource | null
  status: SubscriptionStatus | null
  /** Pro access is valid while `now < currentPeriodEnd`. Null means no expiry. */
  currentPeriodEnd: Date | null
  /** Catalogue SKUs owned outright. Never expire. */
  packs: string[]
  provider: string | null
}

export const FREE_ENTITLEMENTS: Entitlements = {
  plan: 'free',
  planSource: null,
  status: null,
  currentPeriodEnd: null,
  packs: [],
  provider: null,
}

/**
 * Payments off means every gate opens. This is the rollback switch: unset the
 * variable and the app behaves exactly as it did before monetization existed,
 * with no data to migrate back.
 */
export const PAYMENTS_ENABLED = import.meta.env.VITE_PAYMENTS_ENABLED === 'true'

const VALID_STATUS: SubscriptionStatus[] = ['active', 'past_due', 'canceled', 'expired']

function toDate(val: unknown): Date | null {
  if (val == null) return null
  if (val instanceof Date) return val
  // Firestore Timestamp, without importing the class into this pure module.
  if (typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: unknown }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate()
  }
  return null
}

/** Tolerant of missing and malformed fields — an unreadable document is free tier. */
export function entitlementsFromDoc(data: Record<string, unknown> | undefined | null): Entitlements {
  if (!data) return FREE_ENTITLEMENTS
  const status = data.status as SubscriptionStatus
  const source = data.planSource as PlanSource
  return {
    plan: data.plan === 'pro' ? 'pro' : 'free',
    planSource: source === 'subscription' || source === 'grant' ? source : null,
    status: VALID_STATUS.includes(status) ? status : null,
    currentPeriodEnd: toDate(data.currentPeriodEnd),
    packs: Array.isArray(data.packs) ? data.packs.filter((p): p is string => typeof p === 'string') : [],
    provider: typeof data.provider === 'string' ? data.provider : null,
  }
}

/**
 * Pro requires an active-ish status *and* an unexpired period. Deriving it from
 * the period end rather than a flag means a renewal webhook that never arrives
 * lapses the account on schedule instead of granting access forever — missed
 * webhooks are the expected failure mode of a webhook-driven entitlement, so the
 * model fails closed by construction.
 *
 * A manual `grant` with no period end is the one perpetual case.
 */
export function isPro(ent: Entitlements | null, now: Date = new Date()): boolean {
  if (!ent || ent.plan !== 'pro') return false
  if (ent.status !== 'active' && ent.status !== 'past_due') return false
  if (ent.currentPeriodEnd === null) return ent.planSource === 'grant'
  return now < ent.currentPeriodEnd
}

export type Resource =
  | { kind: 'word'; simplified: string; hskLevel: number | null }
  | { kind: 'hskLevel'; level: number }
  | { kind: 'reader'; readerId: string; packSku: string }

export interface AccessContext {
  /** True when the word is inside the free allowance for its level. */
  isFreeWord?: (simplified: string, hskLevel: number) => boolean
  /** Words the user already holds SRS state for. Never revoked. */
  studied?: ReadonlySet<string>
  now?: Date
}

export type DenyReason = 'requires-pro' | 'requires-pack'

export type AccessResult =
  | { allowed: true }
  | { allowed: false; reason: DenyReason; sku: string }

const ALLOW: AccessResult = { allowed: true }

function deny(sku: string | null): AccessResult {
  return sku === null
    ? { allowed: false, reason: 'requires-pro', sku: SUBSCRIPTION_SKU }
    : { allowed: false, reason: 'requires-pack', sku }
}

/**
 * The only place that decides whether content is available. Pure and synchronous
 * so the queue builder — which is not a component — uses the same logic the UI
 * does, with no adapter and no second implementation to drift.
 *
 * Denials carry the SKU that would unlock the resource, so a call site can render
 * a specific upsell without re-deriving why the thing was locked.
 */
export function canAccess(
  resource: Resource,
  ent: Entitlements | null,
  ctx: AccessContext = {}
): AccessResult {
  if (!PAYMENTS_ENABLED) return ALLOW
  if (isPro(ent, ctx.now)) return ALLOW

  const packs = ent?.packs ?? []

  switch (resource.kind) {
    case 'hskLevel': {
      const sku = skuForHskLevel(resource.level)
      if (sku !== null && packs.includes(sku)) return ALLOW
      return deny(sku)
    }

    case 'word': {
      // Imported and custom words carry no HSK level. They are the user's own
      // content and are never gated.
      if (resource.hskLevel === null) return ALLOW
      if (ctx.studied?.has(resource.simplified)) return ALLOW
      const sku = skuForHskLevel(resource.hskLevel)
      if (sku !== null && packs.includes(sku)) return ALLOW
      if (ctx.isFreeWord?.(resource.simplified, resource.hskLevel)) return ALLOW
      return deny(sku)
    }

    case 'reader': {
      // An unrecognised packSku is simply not owned, so this fails closed.
      if (packs.includes(resource.packSku)) return ALLOW
      return { allowed: false, reason: 'requires-pack', sku: resource.packSku }
    }
  }
}

/** Every SKU that would unlock the resource, cheapest first. Drives the paywall. */
export function unlockOptions(result: AccessResult): string[] {
  if (result.allowed) return []
  return result.sku === SUBSCRIPTION_SKU ? [SUBSCRIPTION_SKU] : [result.sku, SUBSCRIPTION_SKU]
}

/**
 * Resolve a level's free allowance against words already ordered by `simplified`.
 * Order of precedence: explicit list, absolute count, fraction.
 */
export function resolveFreeWords(
  orderedWords: readonly { simplified: string }[],
  level: number
): Set<string> {
  const allowance = FREE_TIER.hskLevels[level]
  if (!allowance) return new Set()
  if (allowance.words) return new Set(allowance.words)
  const count =
    allowance.wordCount ??
    (allowance.fraction != null ? Math.floor(orderedWords.length * allowance.fraction) : 0)
  return new Set(orderedWords.slice(0, Math.max(0, count)).map((w) => w.simplified))
}

/**
 * Resolve the free allowance for every configured level in one pass. Shared by
 * the React tree and by `buildQueue` so both agree on what "free" means.
 */
export function buildFreeWordSets(
  getWordsByLevel: (level: number) => readonly { simplified: string }[]
): Map<number, Set<string>> {
  const byLevel = new Map<number, Set<string>>()
  for (const key of Object.keys(FREE_TIER.hskLevels)) {
    const level = Number(key)
    byLevel.set(level, resolveFreeWords(getWordsByLevel(level), level))
  }
  return byLevel
}

/** Adapt the resolved sets into the predicate `canAccess` expects. */
export function freeWordPredicate(
  sets: Map<number, Set<string>>
): (simplified: string, hskLevel: number) => boolean {
  return (simplified, hskLevel) => sets.get(hskLevel)?.has(simplified) ?? false
}

export function planLabel(ent: Entitlements | null): string {
  if (isPro(ent)) return CATALOG[SUBSCRIPTION_SKU].label
  return 'Free'
}
