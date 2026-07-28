## Why

OpenChinese is entirely free today with no way to charge for anything. The owner wants a cheap yearly Pro subscription (~€25) plus the option to sell one-off content packs (an HSK level, a graded reader), and wants to try both models before committing to one. None of that is possible until the app can answer "what is this user allowed to access?" from a source the user cannot forge, and until there is a checkout path that never lets card data or secrets near this codebase.

The app has no backend server, so this change also has to establish the minimum trusted compute needed to make entitlements server-authoritative.

## What Changes

- **New entitlement layer.** `users/{uid}/entitlements/current` in Firestore becomes the single source of truth for a user's plan and owned packs. A `useEntitlements()` hook streams it; a pure `canAccess(resource, entitlements)` function decides every gate.
- **Firestore rules split.** `users/{uid}` and its subcollections stay client-writable except `entitlements/**` and `billing/**`, which become **read-own / write-never** for clients. Only the Firebase Admin SDK (which bypasses rules) may write them. **BREAKING** for the current blanket `allow read, write` rule on `users/{userId}/{document=**}`.
- **Both commercial models at once.** A `pro-yearly` subscription unlocks everything; one-off `pack` purchases unlock a single catalogue entry. Both are represented in the same entitlement document and resolved by the same `canAccess` call, so the owner can price/promote either without code changes.
- **Configurable free demo tier.** A `freeTier` config object (default: first 50% of HSK 1, by the same deterministic ordering the word DB uses) defines what an unpaid user gets. The cutoff is data, not scattered `if` statements.
- **Gating at real access points.** HSK level cards on `/hsk`, the study queue builder (`buildQueue` filters locked words out rather than serving them), and a documented — but not implemented here — contract for the in-flight `/readers` branch.
- **Provider-agnostic payment funnel.** A `PaymentProvider` interface (`createCheckoutSession`, `createPortalSession`, `verifyWebhook`, `toEntitlementUpdate`) with a Stripe reference implementation and a stub crypto provider. A `/pricing` page, a `<Paywall>` component, hosted-checkout redirect, and a `/billing/return` route that waits for the webhook-written entitlement to land.
- **Netlify Functions.** Three functions (`checkout`, `webhook`, `portal`) become the trusted compute. This introduces the repo's first server-side code and its first server-only secrets, all documented in `.env.example` only.
- **No live accounts, no keys, no real webhook.** Provider selection and account setup remain the owner's decision; this change ships the code that any of the candidate providers can be dropped into.

## Capabilities

### New Capabilities
- `monetization`: entitlement model and storage, plan/pack catalogue, free-tier configuration, `canAccess` resolution rules, content gating at HSK/study/readers access points, provider-agnostic hosted checkout funnel, webhook-driven entitlement writes, and the security boundary between client-visible and server-only data.

### Modified Capabilities
- `firestore-user-data`: adds the `entitlements` and `billing` subcollections with their document shapes, and tightens the security-rules requirement from "user may read and write everything under `users/{uid}`" to "user may read everything under `users/{uid}` but may not write `entitlements/**` or `billing/**`".

## Impact

**New code**
- `client/src/lib/entitlements.ts`, `client/src/lib/catalog.ts`, `client/src/lib/payments/` (`types.ts`, `stripe.ts`, `crypto.ts`, `index.ts`)
- `client/src/hooks/useEntitlements.tsx`
- `client/src/components/Paywall.tsx`, `client/src/components/LockBadge.tsx`
- `client/src/pages/PricingPage.tsx`, `client/src/pages/BillingReturnPage.tsx`
- `netlify/functions/checkout.ts`, `netlify/functions/webhook.ts`, `netlify/functions/portal.ts`, `netlify/functions/_lib/`

**Modified code (kept minimal — four other branches are in flight)**
- `client/src/App.tsx` — provider wrapper + two routes
- `client/src/components/Sidebar.tsx` — one nav entry
- `client/src/pages/HskPage.tsx` — lock state on level cards
- `client/src/lib/session.ts` — `buildQueue` drops locked words
- `firestore.rules`, `netlify.toml`, `client/.env.example`, `package.json`

**Dependencies**
- `stripe` and `firebase-admin` as server-only dependencies of the Netlify Functions bundle. Neither enters the client bundle.

**Not in scope**
- Building or editing the graded-readers feature (separate branch); creating provider accounts; tax/invoicing configuration; refund flows.
