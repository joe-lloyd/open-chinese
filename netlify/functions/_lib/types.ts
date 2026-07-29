/**
 * The provider-agnostic payment contract.
 *
 * Everything a payment provider knows how to do lives behind `PaymentProvider`.
 * The three HTTP handlers contain no provider vocabulary at all, so adding
 * Polar, Paddle or a crypto processor is implementing four methods and
 * registering the adapter — nothing else changes.
 */

export type CatalogSku =
  | 'pro-monthly'
  | 'pro-yearly'
  | 'hsk-1'
  | 'hsk-2'
  | 'hsk-3'
  | 'hsk-4'

/**
 * Server-side mirror of the client catalogue, deliberately duplicated: the
 * function bundle must not import client code and the client bundle must not
 * import server code. Only the two fields the server actually needs are here —
 * prices and copy stay on the client, and the authoritative price is whatever
 * the provider has configured for the SKU.
 *
 * Keep the SKU list in sync with `client/src/lib/catalog.ts`.
 */
export const SERVER_CATALOG: Record<CatalogSku, { recurring: boolean }> = {
  'pro-monthly': { recurring: true },
  'pro-yearly': { recurring: true },
  'hsk-1': { recurring: false },
  'hsk-2': { recurring: false },
  'hsk-3': { recurring: false },
  'hsk-4': { recurring: false },
}

export function isCatalogSku(value: unknown): value is CatalogSku {
  return typeof value === 'string' && value in SERVER_CATALOG
}

export interface CheckoutInput {
  sku: CatalogSku
  /** Always derived from a verified Firebase ID token, never from the request body. */
  uid: string
  email: string | null
  successUrl: string
  cancelUrl: string
}

export interface WebhookEvent {
  /** Provider event id, used as the idempotency key. */
  id: string
  type: string
  /**
   * When the provider generated the event. Used to reject out-of-order
   * deliveries, which no provider rules out. Null disables that guard.
   */
  createdAt: Date | null
  /** The verified, parsed payload. Only the owning adapter interprets this. */
  payload: unknown
}

export type Plan = 'free' | 'pro'
export type PlanSource = 'subscription' | 'grant'
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'expired'

/** A partial write against `users/{uid}/entitlements/current`. */
export interface EntitlementUpdate {
  uid: string
  provider: string
  plan?: Plan
  planSource?: PlanSource | null
  status?: SubscriptionStatus | null
  currentPeriodEnd?: Date | null
  /** Merged with `arrayUnion`, so redelivery cannot duplicate or drop packs. */
  addPacks?: string[]
  /** Stored under `users/{uid}/billing/customer` for the billing portal. */
  customerId?: string | null
}

export interface PaymentProvider {
  readonly id: string
  createCheckoutSession(input: CheckoutInput): Promise<{ url: string }>
  createPortalSession(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>
  /**
   * Verify the signature against the raw, unparsed body. Returns null on any
   * failure so the caller's error path is a single `if (!event) return 400` —
   * hard to forget, hard to get wrong.
   */
  verifyWebhook(rawBody: string, headers: Headers): WebhookEvent | null
  /** Null means "valid event, nothing to do" — keeps event triage in the adapter. */
  toEntitlementUpdate(event: WebhookEvent): EntitlementUpdate | null
}
