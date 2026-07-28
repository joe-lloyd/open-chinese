## 1. Entitlement model and catalogue

- [x] 1.1 Create `client/src/lib/catalog.ts` with the `CatalogSku` union, `CATALOG` entries (`pro-yearly` subscription plus `hsk-1`…`hsk-4` packs), `FREE_TIER` config supporting `fraction` / `wordCount` / explicit `words`, and helpers `getCatalogEntry`, `skuForHskLevel`
- [x] 1.2 Create `client/src/lib/entitlements.ts` with the `Entitlements` interface, `FREE_ENTITLEMENTS` constant, `entitlementsFromDoc` (Firestore data → typed, tolerant of missing fields), and `isPro(ent, now)` implementing period-end expiry
- [x] 1.3 Add `Resource` / `AccessResult` types and the pure `canAccess(resource, ent, ctx)` to `entitlements.ts`, handling `word` / `hskLevel` / `reader` kinds, already-studied words, unknown SKUs failing closed, and the payments-disabled bypass
- [x] 1.4 Add `resolveFreeWords(worddb, level)` returning the deterministic free-allowance set for a level, and wire it into `canAccess` via a resolver the caller supplies

## 2. Firestore reads, rules and hook

- [x] 2.1 Add `subscribeEntitlements(uid, cb)` and `getBillingCustomer(uid)` to `client/src/lib/firestore.ts`
- [x] 2.2 Create `client/src/hooks/useEntitlements.ts` (context + hooks) and `client/src/hooks/EntitlementsProvider.tsx` (provider component, split so the fast-refresh lint rule stays quiet) streaming the entitlement document and exposing `{ entitlements, isPro, loading, check, freeCountFor }`
- [x] 2.3 Rewrite `firestore.rules`: explicit per-subcollection matches for `words` and `dailyStats`, owner read on the whole subtree, `allow write: if false` on `entitlements/**` and `billing/**`, `webhookEvents` denied to all clients, and a comment explaining why no recursive wildcard is used
- [x] 2.4 Add a `useAccess()` convenience hook that binds `canAccess` to the current entitlements and the loaded word DB free-allowance resolver

## 3. Payment provider interface and adapters

- [x] 3.1 Create `netlify/functions/_lib/types.ts` with `PaymentProvider`, `WebhookEvent`, `EntitlementUpdate`, and the shared catalogue SKU list (server copy, kept in sync deliberately — the client bundle must not import server code)
- [x] 3.2 Create `netlify/functions/_lib/firebase.ts` — lazy Admin SDK init from a service-account env var, with `applyEntitlementUpdate(uid, update)` and `markEventProcessed(eventId)` implementing the idempotency check
- [x] 3.3 Create `netlify/functions/_lib/stripe.ts` — the reference adapter: hosted Checkout Session creation with `metadata: { uid, sku }`, billing portal session, `constructEvent` signature verification, and event → entitlement translation for subscription and one-off events
- [x] 3.4 Create `netlify/functions/_lib/crypto.ts` — Coinbase Commerce adapter stub implementing the same interface with HMAC-SHA256 signature verification, marked as unconfigured by default
- [x] 3.5 Create `netlify/functions/_lib/providers.ts` — registry selecting the adapter from `PAYMENT_PROVIDER`, returning null when unset

## 4. Netlify Functions

- [x] 4.1 Create `netlify/functions/checkout.ts` — verify the Firebase ID token, validate the SKU against the catalogue, create a checkout session, return the URL; 401 / 400 / 503 paths per spec
- [x] 4.2 Create `netlify/functions/webhook.ts` — verify signature on the raw body before parsing, dedupe by event id, apply the entitlement update, 2xx on unhandled types
- [x] 4.3 Create `netlify/functions/portal.ts` — verify the ID token, look up the stored provider customer id, return a portal URL
- [x] 4.4 Add the functions directory and esbuild bundler config to `netlify.toml`; add `stripe` and `firebase-admin` as root dependencies (resolved by Netlify's function bundler, outside the client workspace so they never enter the browser bundle) plus `tsconfig.functions.json` and a `typecheck:functions` script

## 5. Funnel UI

- [x] 5.1 Create `client/src/lib/checkout.ts` — client-side `startCheckout(sku)` and `openBillingPortal()` that attach the Firebase ID token and redirect
- [x] 5.2 Create `client/src/components/Paywall.tsx` — the locked-content panel taking an `AccessResult` and rendering the specific upsell for the blocking SKU
- [x] 5.3 Create `client/src/components/LockBadge.tsx` — small inline lock indicator used on level cards and list rows
- [x] 5.4 Create `client/src/pages/PricingPage.tsx` — yearly plan and pack cards, current-plan state, manage-subscription link, disabled state when payments are off
- [x] 5.5 Create `client/src/pages/BillingReturnPage.tsx` — subscribes to the entitlement document, bounded wait, success / still-processing states, never reads success from the URL

## 6. Wiring and gating

- [x] 6.1 `App.tsx`: wrap the shell in `EntitlementsProvider`, add `/pricing` and `/billing/return` routes
- [x] 6.2 `Sidebar.tsx`: add a single Pricing/Upgrade nav entry with an icon matching the existing set
- [x] 6.3 `HskPage.tsx`: compute lock state per level, render lock badge plus Unlock action instead of Study, keep the existing layout intact
- [x] 6.4 `session.ts`: filter locked words out of `buildQueue` in every mode, passing the already-studied set so existing progress is never revoked

## 7. Configuration and docs

- [x] 7.1 Add `VITE_PAYMENTS_ENABLED` and server-side variable documentation to `client/.env.example`, with an explicit note that `VITE_*` is public
- [x] 7.2 Add a root `.env.example` documenting the server-only variables (`PAYMENT_PROVIDER`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `COINBASE_*`, `FIREBASE_SERVICE_ACCOUNT`, `PUBLIC_SITE_URL`) and stating that none of them may be prefixed `VITE_`
- [x] 7.3 Document the readers gating contract in the monetization spec and PR description so `feat/graded-readers` can adopt it without changes here

## 8. Verification

- [x] 8.1 `pnpm --filter client build` passes with zero TypeScript errors
- [x] 8.2 `pnpm --filter client lint` shows no new findings
- [x] 8.3 Re-read the diff: confirm no secret is referenced from client code, no `VITE_` variable holds a secret, and the rules file has no path that re-grants write to `entitlements/**`
- [x] 8.4 Add `pnpm check:functions-bundle` — bundles the functions the way Netlify does, loads them, and exercises the no-provider and bad-signature paths. Typechecking alone misses bundling failures, and `firebase-admin` is not safely bundleable (google-gax uses `__dirname`), so it is externalised in `netlify.toml`
