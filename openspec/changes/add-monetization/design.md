## Context

OpenChinese is a fully client-side React SPA: Netlify static hosting, Firebase Auth for identity, Firestore for per-user SRS state, and a static SQLite file (`client/public/words.db`, 740 words across HSK 1–4) fetched by the browser. There is **no backend server and no server-side code of any kind** in the repo today.

The owner wants to charge for it: a cheap yearly subscription (~€25) and/or one-off content packs, with card **and** crypto payment, and explicitly does not want sensitive payment data anywhere near this codebase.

Three constraints collide:

1. **Entitlements must be server-authoritative.** If the client can write "I am Pro" to Firestore, the paywall is decoration. Current rules (`allow read, write: if request.auth.uid == userId` on `users/{userId}/{document=**}`) let it do exactly that.
2. **Making them server-authoritative requires trusted compute.** Something has to receive the payment provider's webhook and write to Firestore with credentials the client does not have. There is nowhere to put that today.
3. **The provider is not chosen yet**, and the requirements (EU pricing, subscriptions *and* one-offs, cards *and* crypto) do not have a single-vendor answer.

Four other agents are concurrently building `feat/graded-readers`, `feat/personal-dictionary`, `feat/study-session-ux` and `feat/dashboard-redesign` off the same base, so edits to shared files must stay surgical.

## Goals / Non-Goals

**Goals:**

- A provider-agnostic entitlement model that is read-only to the client and written only by trusted compute.
- Firestore rules that make that guarantee real, and are narrow enough to survive a security review.
- Both commercial models supported simultaneously — yearly subscription *and* one-off packs — so the owner can A/B them without a code change.
- A free demo tier defined by configuration (default: first half of HSK 1), not by conditionals scattered through pages.
- One obvious call site per gate: `canAccess(resource, entitlements)`.
- Hosted checkout only. Zero PCI scope, zero card fields, zero secrets in the client bundle.
- A `PaymentProvider` interface such that adding Polar, Paddle, or a crypto processor is "implement four methods".
- An honest, written account of what is *enforced* versus what is merely *hidden*.

**Non-Goals:**

- Creating provider accounts, obtaining API keys, or pointing a live webhook at anything. That is the owner's call and is still open.
- Building or editing the graded-readers feature. This change defines the gating **contract** for it and stops there.
- Real content protection for the static word DB. See "What is actually enforced" — this is deliberately not solved here.
- Tax registration, invoicing, refunds, dunning, proration, plan upgrades/downgrades mid-term, coupon codes.
- Server-side rendering, an API gateway, or any general-purpose backend. The functions added here do three things and nothing else.

## Decisions

### D1. Entitlements live at `users/{uid}/entitlements/current`, written only by the Admin SDK

A single document, not a field on the profile, because it needs a different security posture than everything else under `users/{uid}` and Firestore rules are matched per-path.

```ts
interface Entitlements {
  plan: 'free' | 'pro'
  planSource: 'subscription' | 'grant' | null
  status: 'active' | 'past_due' | 'canceled' | 'expired' | null
  currentPeriodEnd: Timestamp | null   // pro access is valid while now < this
  packs: string[]                      // catalogue SKUs owned outright, e.g. ['hsk-2','reader-journey-west']
  provider: string | null              // 'stripe' | 'polar' | 'coinbase-commerce' | ...
  updatedAt: Timestamp
}
```

Rationale for the shape:

- `plan` + `packs` in one document means one listener, one read, and a pure resolver. No joins.
- `currentPeriodEnd` rather than a boolean means a lapsed subscription degrades correctly even if the `customer.subscription.deleted` webhook is missed — the client computes `active && now < currentPeriodEnd`. Missed webhooks are the normal failure mode of this architecture, so the model is built to fail closed.
- `packs` is a flat array of catalogue SKUs. One-off purchases are additive and never expire, which is what "buy a pack" means to a user.
- `planSource: 'grant'` exists so the owner can comp an account by hand from the Firebase console without faking a subscription record.

A sibling `users/{uid}/billing/customer` holds the provider's customer id (needed to open the billing portal) and is likewise server-written. It is kept separate from `entitlements` so the entitlement document stays provider-neutral.

**Alternative rejected:** Firebase Auth custom claims. Claims are genuinely server-authoritative and arrive in the ID token, which is tidier for future server-side enforcement. But they are capped at 1000 bytes, only refresh when the token refreshes (up to an hour of staleness, or a forced `getIdToken(true)`), and are awkward to inspect or hand-edit. Firestore gives instant propagation via `onSnapshot` — which matters a lot for the post-checkout "waiting for your purchase to land" screen. Revisit claims if and when the word DB is served through an authenticated endpoint.

### D2. Firestore rules: read-own-everything, write-own-everything-**except** entitlements and billing

```
match /users/{userId} {
  allow read: if isOwner(userId);
  allow write: if isOwner(userId);

  match /entitlements/{docId} {
    allow read: if isOwner(userId);
    allow write: if false;
  }
  match /billing/{docId} {
    allow read: if isOwner(userId);
    allow write: if false;
  }
  match /{document=**} {
    allow read, write: if isOwner(userId);
  }
}
```

Two things make this safe, and both are non-obvious:

1. **Firestore rules do not cascade — they OR.** A request is allowed if *any* matching rule allows it. So the specific `entitlements/{docId}` match cannot "override" the recursive `{document=**}` match by being more specific; the recursive one would still grant the write. The fix is that the recursive wildcard must be written so it does not match those paths. Firestore evaluates `match /users/{userId}/{document=**}` against `users/u1/entitlements/current` with `document = "entitlements/current"`, so the recursive rule *does* cover it. **Therefore the recursive rule is replaced with explicit per-subcollection matches** (`words`, `dailyStats`, and any future user-owned collection) rather than a wildcard. Listing collections explicitly is the only way to get a deny-by-default hole in Firestore.
2. **The Admin SDK bypasses security rules entirely.** `allow write: if false` denies every client — web, mobile, REST, anyone holding a stolen ID token — while the Netlify function, authenticating as a service account through `firebase-admin`, writes freely. There is no rule to weaken and no privileged client path to leak.

The cost is that adding a new user-owned subcollection now requires a rules edit. That is the correct trade: a forgotten rules edit fails closed (feature broken, loudly), whereas a wildcard that forgets to exclude a sensitive path fails open (paywall silently bypassable).

`webhookEvents/{eventId}` is a top-level collection used for webhook idempotency, with `allow read, write: if false` — Admin SDK only.

### D3. Trusted compute: Netlify Functions, not Firebase Cloud Functions

| | Netlify Functions | Firebase Cloud Functions |
|---|---|---|
| Deploy | Same `git push`, same `netlify.toml`, already configured | Separate `firebase deploy --only functions` |
| Billing | Included in the existing free tier | Requires upgrading the Firebase project to Blaze |
| Webhook URL | `https://<site>/.netlify/functions/webhook` — same origin as the app | `cloudfunctions.net` — a second origin to configure and monitor |
| Firebase admin credentials | Service-account JSON stored as an env var — **a secret to protect** | Ambient via the runtime service account — **no secret to store** |
| Cold start | ~200–500ms, irrelevant for webhooks | Comparable |

**Chosen: Netlify Functions.** The deciding factor is that this project's whole operating model is "one repo, one push, one deploy". Introducing a second deploy target and a second billing relationship for three HTTP handlers is disproportionate.

The one real advantage of Cloud Functions — ambient admin credentials, no service-account key to store — is a genuine loss. Mitigations: a dedicated service account with only the Datastore User role (not Owner), the key stored only as a Netlify environment variable scoped to the production context, never committed, and rotatable independently of everything else. `.env.example` documents this explicitly. If the owner would rather not hold that key at all, swapping to Cloud Functions is a contained change: the three handlers are plain request/response functions with the Firebase and provider access isolated in `netlify/functions/_lib/`.

### D4. The uid comes from a verified Firebase ID token, never from the request body

This is the single most attackable seam in the design, so it is worth stating flatly.

```
Client                         checkout fn                    Provider          webhook fn
  |-- POST /checkout ------------->|                              |                  |
  |   Authorization: Bearer <ID>   |-- verifyIdToken() -> uid ---->|                  |
  |   { sku }                      |-- createCheckoutSession(     |                  |
  |                                |     sku, metadata:{uid,sku}) |                  |
  |<-- { url } --------------------|                              |                  |
  |-- redirect to hosted checkout ------------------------------->|                  |
  |                                                               |-- webhook ------>|
  |                                                               |   (signed)       |-- verify sig
  |                                                               |                  |-- read metadata.uid
  |                                                               |                  |-- admin write
  |<-- redirect /billing/return ----------------------------------|                  |   entitlements
  |-- onSnapshot fires when the entitlement document lands --------------------------|
```

The checkout function derives the uid from `admin.auth().verifyIdToken(...)` and stamps it into provider metadata. The webhook reads the uid back out of provider-held metadata after verifying the payload signature. At no point does an attacker-controlled value become a uid. A client that POSTs `{ uid: "someone-else", sku: "pro-yearly" }` is ignored — the field is not read.

The webhook additionally:

- verifies the provider signature **before parsing** the body (raw bytes, constant-time compare) and returns 400 on failure;
- rejects events whose id already exists in `webhookEvents/{eventId}` (idempotency — providers retry, and Stripe explicitly does not guarantee once-only delivery);
- returns 2xx on unhandled event types so the provider stops retrying, without touching Firestore.

### D5. Provider evaluation and recommendation

Requirements: hosted checkout; subscriptions **and** one-off purchases; euro pricing with EU VAT handled; cards **and** crypto; a signed webhook; usable by a solo developer without an enterprise contract.

| Provider | Merchant of record | Subs + one-off | EU VAT | Crypto | Fees (approx.) | Notes |
|---|---|---|---|---|---|---|
| **Stripe** | No — you are the merchant | Yes, both, mature | Stripe Tax *calculates*; you still register and remit in each jurisdiction | Stablecoin (USDC) support exists but is regionally limited and not a general "pay with crypto" flow | 1.5% + €0.25 (EEA cards) | Best API and docs by a distance. Instant test mode, no approval. **The VAT burden is the problem** — a solo EU seller of digital goods owes VAT in the buyer's country from the first sale (no threshold for cross-border B2C digital services), which means OSS registration and quarterly filings. |
| **Paddle** | **Yes** | Yes, both | Fully handled — registration, collection, remittance, invoices | No | ~5% + €0.50 | The conservative MoR choice; longest track record. Requires an application and approval, which can take days and is occasionally refused for thin catalogues. |
| **Polar** | **Yes** | Yes, both, plus license keys and file downloads | Fully handled | No | 4% + €0.40 | Built on Stripe Connect, developer-first API that is deliberately Stripe-shaped (checkout session → redirect; HMAC-signed webhooks). Youngest of the three MoRs, so the least operating history. |
| **Lemon Squeezy** | **Yes** | Yes, both | Fully handled | No | 5% + €0.50 | Acquired by Stripe in 2024 and being folded into Stripe's own MoR offering. **Not recommended for a new integration** — the migration path is the owner's problem later. |
| **Coinbase Commerce** | No (crypto only) | One-off natively; recurring is not a native concept | N/A | Yes — BTC/ETH/USDC and more, self-custody | ~1% | Hosted checkout page, `X-CC-Webhook-Signature` HMAC-SHA256. The standard pairing for a card processor. |
| **BTCPay Server** | No | One-off | N/A | Yes, non-custodial, 0% fee | Self-hosted | Zero fees, full sovereignty, but it is a server to run and back up — contradicts this project's no-infrastructure posture. |

**No single provider covers cards + crypto + MoR.** That is not a gap in the research; it is the state of the market. The MoRs decline crypto because being the merchant of record for a crypto payment is a compliance problem they do not want. So the shape of the answer is fixed: **one card provider plus one crypto provider, behind one interface.**

**Recommendation: Polar for cards, Coinbase Commerce for crypto.**

Why Polar over Stripe: the owner is pricing in euro and is a solo developer. Selling digital goods to EU consumers as your own merchant means EU VAT MOSS/OSS registration and quarterly filings from the first sale, plus keeping evidence of customer location. At €25/year, the difference between Stripe's ~1.8% and Polar's ~4.4% is roughly €0.65 per customer per year — far less than the cost of an accountant, and less than the cost of the owner's time doing it themselves. MoR is worth the spread here.

Why Polar over Paddle: 4% + €0.40 versus 5% + €0.50, self-serve onboarding instead of an approval queue, and an API modelled closely enough on Stripe's that the adapter is nearly a rename. Paddle remains the right answer if the owner values a decade of operating history over a point of margin — the interface makes that a swap, not a rewrite.

**Reference implementation: Stripe.** Deliberately not the recommendation, for two reasons. Stripe test mode works immediately with no application, so the owner can exercise the entire funnel end to end before committing to any merchant relationship; and Stripe's Checkout-Session-plus-signed-webhook shape is the pattern Polar and Paddle both imitate, so the reference is the most transferable one to write against. A `crypto.ts` stub implements the same interface with the Coinbase Commerce request shapes and `TODO` markers where the account-specific pieces go.

### D6. `PaymentProvider` interface

```ts
export interface PaymentProvider {
  readonly id: string
  createCheckoutSession(input: {
    sku: CatalogSku
    uid: string
    email: string | null
    successUrl: string
    cancelUrl: string
  }): Promise<{ url: string }>
  createPortalSession(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>
  verifyWebhook(rawBody: string, headers: Record<string, string>): WebhookEvent | null
  toEntitlementUpdate(event: WebhookEvent): EntitlementUpdate | null
}
```

`verifyWebhook` returns `null` rather than throwing on a bad signature — the handler's job is then a single `if (!event) return 400`, which is hard to get wrong. `toEntitlementUpdate` returning `null` means "valid event, nothing to do", keeping the "which events matter" knowledge inside the adapter where the provider-specific event names live. The handler itself contains no provider vocabulary at all.

Provider selection is a single environment variable (`PAYMENT_PROVIDER`) read by a registry in `netlify/functions/_lib/providers.ts`. The client never knows or cares which provider is active.

### D7. Catalogue and free tier as data

```ts
export const CATALOG = {
  'pro-yearly': { kind: 'subscription', label: 'Pro', priceEur: 25, grants: 'all' },
  'hsk-1': { kind: 'pack', label: 'HSK 1 Complete', priceEur: 6, grants: { hskLevel: 1 } },
  'hsk-2': { ... }, 'hsk-3': { ... }, 'hsk-4': { ... },
} as const

export const FREE_TIER: FreeTierConfig = {
  hskLevels: { 1: { fraction: 0.5 } },   // first 78 of HSK 1's 156 words
}
```

The free allowance is expressed as a fraction (or an absolute `wordCount`) of a level, resolved against the same `ORDER BY simplified` ordering `getWordsByLevel` already uses, so free membership is deterministic and stable across sessions. Changing the demo size is a one-line config edit, and running the subscription-only or packs-only experiment is a matter of which SKUs the pricing page renders — no gating code changes for either.

Caveat, recorded honestly: alphabetical-by-simplified is deterministic but not pedagogically ordered, so "the first half of HSK 1" is an arbitrary half, not the easiest half. The config supports an explicit `words: string[]` allowlist for when the owner wants to hand-pick the demo set; `fraction` is only the default.

### D8. `canAccess` is pure, and gating happens at three sites

```ts
export type Resource =
  | { kind: 'word'; simplified: string; hskLevel: number | null }
  | { kind: 'hskLevel'; level: number }
  | { kind: 'reader'; readerId: string; packSku: string }

export function canAccess(resource: Resource, ent: Entitlements | null): AccessResult
// -> { allowed: true } | { allowed: false; reason: 'requires-pro' | 'requires-pack'; sku: CatalogSku }
```

Pure, synchronous, no React, no Firestore — trivially testable and callable from `buildQueue` (which is not a component). Returning the *reason* and the *SKU that would unlock it* rather than a bare boolean means every call site can render a correct, specific upsell without re-deriving why the thing was locked.

Applied at:

1. **`HskPage`** — locked levels render with a lock badge and an "Unlock" button instead of "Study".
2. **`buildQueue`** — locked words are filtered out of every mode before slicing. This is the important one: without it a free user hitting `/study?hsk=4` directly would get paid content even though `/hsk` showed a lock.
3. **Graded readers** — contract only, see below.

### D9. Readers gating contract (for `feat/graded-readers`, not implemented here)

That branch is unmerged, so this change adds the seam and nothing else:

- Each reader declares a `packSku` matching a `kind: 'pack'` entry in `CATALOG`.
- Readers call `canAccess({ kind: 'reader', readerId, packSku }, ent)` and render `<Paywall sku={result.sku} />` when `allowed` is false.
- `canAccess` already returns `allowed: true` for any resource whose SKU is in `packs`, and for every resource when the plan is active Pro — so the readers branch needs no changes to entitlement logic, only the call.
- Reader SKUs are added to `CATALOG` when that branch lands. `canAccess` treats an unknown SKU as locked (fail closed).

### D10. What is actually enforced, and what is not

**Genuinely enforced — a user cannot defeat these from the browser:**

- A user cannot grant themselves an entitlement. `allow write: if false` on `entitlements/**` and `billing/**` is absolute for client SDKs; only the service account can write. This is the one security property this change actually delivers, and it is the one that matters for the integrity of any future enforcement.
- A user cannot read or write another user's entitlements.
- A user cannot mint a checkout session for another user's account (uid comes from a verified ID token).
- A forged webhook cannot grant an entitlement (signature verified before parse, replayed event ids rejected).

**Not enforced — UX only, and trivially bypassable:**

- **All word content remains publicly downloadable.** `client/public/words.db` is a static file on a CDN with no auth in front of it. Anyone can `curl https://<site>/words.db` and open it in SQLite. Gating HSK levels in the UI does not change that by one bit. Someone who wants the words has them already.
- Locked HSK levels and locked words are hidden and filtered client-side. Editing local state, or calling `buildQueue` from the console, bypasses it. The paywall is a purchase prompt, not a lock.
- Reader content, when that branch lands, will have the same property if it ships as static assets.

**What real enforcement would take** (deliberately out of scope, and it should not be attempted before there is revenue to justify it): split `words.db` into a free shard and paid shards; serve paid shards from an authenticated function or a short-lived signed URL issued only after a server-side entitlement check; ship reader text the same way. That is a meaningful architecture change — it makes content delivery depend on Firestore availability and adds per-request cost — and it is only worth doing once piracy is demonstrably costing money.

This posture is defensible for a €25/year study app: the honest buyer pays because the product is worth it and cracking it is a hassle, and the dishonest one was never going to pay. It is recorded here so nobody later mistakes the UI paywall for a security boundary.

### D11. Post-checkout return: wait for the webhook, do not trust the redirect

`/billing/return` does **not** read the query string to decide anything. The redirect from a hosted checkout page is attacker-controllable (a user can just navigate to `/billing/return?success=true`), so it grants nothing. Instead the page subscribes to the entitlement document and waits for the webhook-written change to arrive, showing a spinner for up to ~20 seconds, then a "this is taking longer than usual, your purchase is safe, refresh in a minute" message with a support link. Payment succeeded/failed is never inferred client-side.

## Risks / Trade-offs

- **Webhook missed or delayed → user pays and stays locked out.** → Idempotent handler plus provider-side retries; `/billing/return` polls rather than assuming; `currentPeriodEnd` means a *renewal* webhook that never arrives degrades to expiry at the correct time rather than granting indefinite access. Residual risk: a first purchase whose webhook is lost entirely needs manual intervention. Acceptable at this scale; a reconciliation job is the fix if it ever happens twice.
- **Service-account key stored in a Netlify env var.** → Dedicated account, Datastore User role only, never committed, rotatable. Accepted consciously in D3; Cloud Functions removes this risk if the owner prefers.
- **Explicit per-subcollection rules will be forgotten when someone adds a collection.** → Fails closed (visible breakage), and the rules file carries a comment saying exactly this. Chosen over a wildcard that fails open.
- **`allow write: if false` also blocks the Firebase console's client-side editor.** → Console edits go through the Admin path and still work; noted so it does not read as a bug.
- **Paywalling content that is already free is a reputational risk.** → Existing users keep everything they have already studied; gating applies to *starting* new locked material. Words a free user already has SRS state for stay accessible regardless of tier — enforced in `canAccess` via the caller passing existing-word context, so nobody loses progress they built up.
- **Provider spread on €25/yr is ~€1.40 with an MoR versus ~€0.70 with Stripe direct.** → Deliberate; see D5. The delta is smaller than the compliance cost it removes.
- **Crypto adds real operational surface** — volatility during the confirmation window, underpayment, chargeback-free but also refund-hostile. → The crypto adapter ships as a stub behind the same interface and is off by default. Turning it on is a decision the owner makes with eyes open, not a side effect of merging this.
- **Four branches in flight touching the same files.** → Edits to `App.tsx` (a provider wrapper and two routes), `Sidebar.tsx` (one nav entry), `HskPage.tsx` (lock rendering) and `session.ts` (one filter) are kept as small and as localised as they can be; every touched file is listed in the PR description.

## Migration Plan

1. Merge with `PAYMENT_PROVIDER` unset. `getProvider()` returns null, the checkout function returns 503, the pricing page renders in a disabled "coming soon" state. Nothing about the app changes for existing users.
2. Deploy the tightened `firestore.rules`. Verified safe for existing data: current rules already restrict to the owner, and no existing code writes to `entitlements/**` or `billing/**`, so nothing that works today starts failing.
3. Owner picks a provider, creates the account, sets the server-side env vars in Netlify (never in the repo), points the provider's webhook at `/.netlify/functions/webhook`.
4. Flip `VITE_PAYMENTS_ENABLED=true` to expose pricing and paywalls.
5. **Rollback:** unset `VITE_PAYMENTS_ENABLED` — every gate opens, since `canAccess` returns `allowed: true` for everything when payments are disabled. No data migration to undo, no entitlement documents to clean up.

## Open Questions

These are the owner's to decide; the code is built so that none of them require rework.

1. **Which card provider?** Recommendation is Polar (MoR, 4% + €0.40); Paddle if operating history outweighs margin; Stripe direct only if the owner is willing to own EU VAT registration and filings.
2. **Crypto: launch with it, or wait?** The adapter slot exists. Coinbase Commerce is the low-effort option; BTCPay is zero-fee but is infrastructure to run.
3. **Which experiment first — subscription-only, packs-only, or both on the pricing page?** Supported either way; it is a question of which SKUs get rendered.
4. **Pack pricing.** €6/level is a placeholder chosen so four packs (€24) sit just under the €25 yearly, making the subscription the obvious buy. If packs are meant to be a real alternative rather than a decoy, they should be priced independently.
5. **Is half of HSK 1 the right demo?** 78 words is a few sessions — enough to feel the SRS but probably not enough to feel attached to it. All of HSK 1 (156) may convert better. One config line either way.
6. **Existing users at launch:** grandfather everyone who signed up before the switch (a `planSource: 'grant'` backfill), or apply the free tier to everyone? Recommendation is to grandfather — the goodwill is worth more than the handful of conversions, and it is a one-time script.
