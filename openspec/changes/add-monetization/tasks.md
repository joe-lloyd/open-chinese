## 1. Entitlement model and catalogue

- [ ] 1.1 Create `client/src/lib/catalog.ts` with the `CatalogSku` union, `CATALOG` entries (`pro-yearly` subscription plus `hsk-1`…`hsk-4` packs), `FREE_TIER` config supporting `fraction` / `wordCount` / explicit `words`, and helpers `getCatalogEntry`, `skuForHskLevel`
- [ ] 1.2 Create `client/src/lib/entitlements.ts` with the `Entitlements` interface, `FREE_ENTITLEMENTS` constant, `entitlementsFromDoc` (Firestore data → typed, tolerant of missing fields), and `isPro(ent, now)` implementing period-end expiry
- [ ] 1.3 Add `Resource` / `AccessResult` types and the pure `canAccess(resource, ent, ctx)` to `entitlements.ts`, handling `word` / `hskLevel` / `reader` kinds, already-studied words, unknown SKUs failing closed, and the payments-disabled bypass
- [ ] 1.4 Add `resolveFreeWords(worddb, level)` returning the deterministic free-allowance set for a level, and wire it into `canAccess` via a resolver the caller supplies

## 2. Firestore reads, rules and hook

- [ ] 2.1 Add `subscribeEntitlements(uid, cb)` and `getBillingCustomer(uid)` to `client/src/lib/firestore.ts`
- [ ] 2.2 Create `client/src/hooks/useEntitlements.tsx` — a context provider streaming the entitlement document plus a `useEntitlements()` hook exposing `{ entitlements, isPro, loading }`
- [ ] 2.3 Rewrite `firestore.rules`: explicit per-subcollection matches for `words` and `dailyStats`, owner read on the whole subtree, `allow write: if false` on `entitlements/**` and `billing/**`, `webhookEvents` denied to all clients, and a comment explaining why no recursive wildcard is used
- [ ] 2.4 Add a `useAccess()` convenience hook that binds `canAccess` to the current entitlements and the loaded word DB free-allowance resolver

## 3. Payment provider interface and adapters

- [ ] 3.1 Create `netlify/functions/_lib/types.ts` with `PaymentProvider`, `WebhookEvent`, `EntitlementUpdate`, and the shared catalogue SKU list (server copy, kept in sync deliberately — the client bundle must not import server code)
- [ ] 3.2 Create `netlify/functions/_lib/firebase.ts` — lazy Admin SDK init from a service-account env var, with `applyEntitlementUpdate(uid, update)` and `markEventProcessed(eventId)` implementing the idempotency check
- [ ] 3.3 Create `netlify/functions/_lib/stripe.ts` — the reference adapter: hosted Checkout Session creation with `metadata: { uid, sku }`, billing portal session, `constructEvent` signature verification, and event → entitlement translation for subscription and one-off events
- [ ] 3.4 Create `netlify/functions/_lib/crypto.ts` — Coinbase Commerce adapter stub implementing the same interface with HMAC-SHA256 signature verification, marked as unconfigured by default
- [ ] 3.5 Create `netlify/functions/_lib/providers.ts` — registry selecting the adapter from `PAYMENT_PROVIDER`, returning null when unset

## 4. Netlify Functions

- [ ] 4.1 Create `netlify/functions/checkout.ts` — verify the Firebase ID token, validate the SKU against the catalogue, create a checkout session, return the URL; 401 / 400 / 503 paths per spec
- [ ] 4.2 Create `netlify/functions/webhook.ts` — verify signature on the raw body before parsing, dedupe by event id, apply the entitlement update, 2xx on unhandled types
- [ ] 4.3 Create `netlify/functions/portal.ts` — verify the ID token, look up the stored provider customer id, return a portal URL
- [ ] 4.4 Add the functions directory and esbuild bundler config to `netlify.toml`; add `stripe` and `firebase-admin` as dependencies of a `netlify/functions/package.json` so they never enter the client bundle

## 5. Funnel UI

- [ ] 5.1 Create `client/src/lib/checkout.ts` — client-side `startCheckout(sku)` and `openBillingPortal()` that attach the Firebase ID token and redirect
- [ ] 5.2 Create `client/src/components/Paywall.tsx` — the locked-content panel taking an `AccessResult` and rendering the specific upsell for the blocking SKU
- [ ] 5.3 Create `client/src/components/LockBadge.tsx` — small inline lock indicator used on level cards and list rows
- [ ] 5.4 Create `client/src/pages/PricingPage.tsx` — yearly plan and pack cards, current-plan state, manage-subscription link, disabled state when payments are off
- [ ] 5.5 Create `client/src/pages/BillingReturnPage.tsx` — subscribes to the entitlement document, bounded wait, success / still-processing states, never reads success from the URL

## 6. Wiring and gating

- [ ] 6.1 `App.tsx`: wrap the shell in `EntitlementsProvider`, add `/pricing` and `/billing/return` routes
- [ ] 6.2 `Sidebar.tsx`: add a single Pricing/Upgrade nav entry with an icon matching the existing set
- [ ] 6.3 `HskPage.tsx`: compute lock state per level, render lock badge plus Unlock action instead of Study, keep the existing layout intact
- [ ] 6.4 `session.ts`: filter locked words out of `buildQueue` in every mode, passing the already-studied set so existing progress is never revoked

## 7. Configuration and docs

- [ ] 7.1 Add `VITE_PAYMENTS_ENABLED` and server-side variable documentation to `client/.env.example`, with an explicit note that `VITE_*` is public
- [ ] 7.2 Add a root `.env.example` documenting the server-only variables (`PAYMENT_PROVIDER`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `COINBASE_*`, `FIREBASE_SERVICE_ACCOUNT`, `PUBLIC_SITE_URL`) and stating that none of them may be prefixed `VITE_`
- [ ] 7.3 Document the readers gating contract in the monetization spec and PR description so `feat/graded-readers` can adopt it without changes here

## 8. Verification

- [ ] 8.1 `pnpm --filter client build` passes with zero TypeScript errors
- [ ] 8.2 `pnpm --filter client lint` shows no new findings
- [ ] 8.3 Re-read the diff: confirm no secret is referenced from client code, no `VITE_` variable holds a secret, and the rules file has no path that re-grants write to `entitlements/**`
