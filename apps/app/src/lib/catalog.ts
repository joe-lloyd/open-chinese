/**
 * What is for sale, and what is free.
 *
 * Both commercial models are live at once: `pro-yearly` unlocks everything for a
 * year, and each `pack` unlocks one HSK level outright. Which of them the pricing
 * page offers is a rendering decision, not a gating one — `canAccess` treats them
 * identically.
 *
 * Prices here are display copy only. The authoritative price is whatever the
 * payment provider has configured for the SKU; nothing in the client is trusted
 * at checkout time.
 */

export type CatalogSku =
  | 'pro-yearly'
  | 'hsk-1'
  | 'hsk-2'
  | 'hsk-3'
  | 'hsk-4'
  | 'hsk-5'
  | 'hsk-6'
  | 'hsk-7'
  | 'hsk-8'
  | 'hsk-9'

export interface CatalogEntry {
  kind: 'subscription' | 'pack'
  label: string
  description: string
  /** Display price in euro. */
  priceEur: number
  /** Billing cadence for subscriptions; absent for one-off packs. */
  interval?: 'year'
  /** `'all'` unlocks everything; otherwise the HSK level this pack covers. */
  grants: 'all' | { hskLevel: number }
}

export const CATALOG: Record<CatalogSku, CatalogEntry> = {
  'pro-yearly': {
    kind: 'subscription',
    label: 'Pro',
    description: 'Every HSK level and every reader, for a year.',
    priceEur: 25,
    interval: 'year',
    grants: 'all',
  },
  'hsk-1': {
    kind: 'pack',
    label: 'HSK 1 Complete',
    description: 'All 506 HSK 1 words.',
    priceEur: 6,
    grants: { hskLevel: 1 },
  },
  'hsk-2': {
    kind: 'pack',
    label: 'HSK 2 Complete',
    description: 'All 750 HSK 2 words.',
    priceEur: 6,
    grants: { hskLevel: 2 },
  },
  'hsk-3': {
    kind: 'pack',
    label: 'HSK 3 Complete',
    description: 'All 953 HSK 3 words.',
    priceEur: 6,
    grants: { hskLevel: 3 },
  },
  'hsk-4': {
    kind: 'pack',
    label: 'HSK 4 Complete',
    description: 'All 972 HSK 4 words.',
    priceEur: 6,
    grants: { hskLevel: 4 },
  },
  'hsk-5': {
    kind: 'pack',
    label: 'HSK 5 Complete',
    description: 'All 1,059 HSK 5 words.',
    priceEur: 6,
    grants: { hskLevel: 5 },
  },
  'hsk-6': {
    kind: 'pack',
    label: 'HSK 6 Complete',
    description: 'All 1,123 HSK 6 words.',
    priceEur: 6,
    grants: { hskLevel: 6 },
  },
  'hsk-7': {
    kind: 'pack',
    label: 'HSK 7 Complete',
    description: 'The first 1,869 words in the OpenChinese advanced progression.',
    priceEur: 6,
    grants: { hskLevel: 7 },
  },
  'hsk-8': {
    kind: 'pack',
    label: 'HSK 8 Complete',
    description: 'The next 1,869 words in the OpenChinese advanced progression.',
    priceEur: 6,
    grants: { hskLevel: 8 },
  },
  'hsk-9': {
    kind: 'pack',
    label: 'HSK 9 Complete',
    description: 'The final 1,868 words in the OpenChinese advanced progression.',
    priceEur: 6,
    grants: { hskLevel: 9 },
  },
}

export const SUBSCRIPTION_SKU: CatalogSku = 'pro-yearly'

/**
 * What the pricing page actually offers.
 *
 * MVP is the subscription alone. The pack machinery stays fully wired —
 * `canAccess` honours packs, and `pnpm entitlement packs` grants them — but
 * surfacing packs would mean creating and maintaining several provider prices
 * instead of one, and the full set would compete awkwardly with the yearly plan
 * rather than a real choice. Add pack SKUs here once they are priced to stand
 * on their own; nothing else needs to change.
 */
export const OFFERED_SKUS: CatalogSku[] = [SUBSCRIPTION_SKU]

export function isCatalogSku(sku: string): sku is CatalogSku {
  return sku in CATALOG
}

export function getCatalogEntry(sku: string): CatalogEntry | null {
  return isCatalogSku(sku) ? CATALOG[sku] : null
}

/** The pack SKU that unlocks an HSK level, or null if no pack covers it. */
export function skuForHskLevel(level: number): CatalogSku | null {
  const sku = `hsk-${level}`
  return isCatalogSku(sku) ? sku : null
}

export function packSkus(): CatalogSku[] {
  return (Object.keys(CATALOG) as CatalogSku[]).filter((s) => CATALOG[s].kind === 'pack')
}

/**
 * How much a free account gets, per HSK level. Exactly one of `words`,
 * `wordCount` or `fraction` applies, checked in that order. A level absent from
 * the map grants nothing.
 *
 * `fraction` and `wordCount` resolve against the same `ORDER BY simplified`
 * ordering `getWordsByLevel` uses, so membership is deterministic across
 * sessions. That ordering is alphabetical, not pedagogical — set `words`
 * explicitly to hand-pick a demo set.
 */
export interface FreeLevelAllowance {
  fraction?: number
  wordCount?: number
  words?: string[]
}

export interface FreeTierConfig {
  hskLevels: Partial<Record<number, FreeLevelAllowance>>
}

/** Default demo: the first half of HSK 1. */
export const FREE_TIER: FreeTierConfig = {
  hskLevels: {
    1: { fraction: 0.5 },
  },
}
