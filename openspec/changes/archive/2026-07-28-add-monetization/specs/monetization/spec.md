## ADDED Requirements

### Requirement: Entitlements are server-authoritative and never client-writable
The system SHALL store each user's entitlements at `users/{uid}/entitlements/current` in Firestore. The document SHALL be readable by its owner and writable by no client under any circumstances. Only trusted server-side code authenticating with the Firebase Admin SDK SHALL write it.

The document SHALL contain:
- `plan` (string: `free|pro`)
- `planSource` (string: `subscription|grant`, or null)
- `status` (string: `active|past_due|canceled|expired`, or null)
- `currentPeriodEnd` (Timestamp or null)
- `packs` (array of catalogue SKU strings)
- `provider` (string or null)
- `updatedAt` (Timestamp)

A missing document SHALL be treated as the free tier, identical to `{ plan: 'free', packs: [] }`.

#### Scenario: Client attempts to grant itself Pro
- **WHEN** an authenticated user writes `{ plan: 'pro' }` to their own `users/{uid}/entitlements/current`
- **THEN** the Firestore security rules SHALL deny the write
- **AND** the user's effective entitlements SHALL be unchanged

#### Scenario: Client reads its own entitlements
- **WHEN** an authenticated user reads `users/{uid}/entitlements/current`
- **THEN** the read SHALL succeed

#### Scenario: Client reads another user's entitlements
- **WHEN** an authenticated user reads `users/{otherUid}/entitlements/current`
- **THEN** the read SHALL be denied

#### Scenario: No entitlement document exists
- **WHEN** a user who has never purchased anything signs in
- **THEN** the system SHALL resolve their entitlements to the free tier
- **AND** SHALL NOT create an entitlement document from the client

### Requirement: Pro access expires by period end, not by flag alone
A user SHALL be treated as Pro only when `plan` is `pro` AND `status` is `active` or `past_due` AND either `currentPeriodEnd` is in the future, or `planSource` is `grant` and `currentPeriodEnd` is null. A subscription whose renewal is never confirmed SHALL therefore lapse to the free tier automatically rather than granting access indefinitely; only a manually issued grant SHALL be perpetual.

#### Scenario: Active subscription within period
- **GIVEN** `plan: 'pro'`, `status: 'active'`, `currentPeriodEnd` one month in the future
- **WHEN** entitlements are resolved
- **THEN** the user SHALL be treated as Pro

#### Scenario: Renewal webhook never arrives
- **GIVEN** `plan: 'pro'`, `status: 'active'`, `currentPeriodEnd` in the past
- **WHEN** entitlements are resolved
- **THEN** the user SHALL NOT be treated as Pro
- **AND** SHALL fall back to the free tier plus any owned packs

#### Scenario: Canceled subscription runs to end of paid period
- **GIVEN** `status: 'canceled'` with `currentPeriodEnd` in the future
- **WHEN** entitlements are resolved
- **THEN** the user SHALL NOT be treated as Pro

#### Scenario: Manually issued grant never expires
- **GIVEN** `plan: 'pro'`, `planSource: 'grant'`, `status: 'active'`, `currentPeriodEnd: null`
- **WHEN** entitlements are resolved
- **THEN** the user SHALL be treated as Pro

### Requirement: Subscription and one-off pack purchases are supported simultaneously
The system SHALL support both a recurring subscription that unlocks all content and one-off pack purchases that unlock a single catalogue entry permanently. Both SHALL be represented in the same entitlement document and resolved by the same access function, so that either or both commercial models can be offered without code changes.

#### Scenario: Pro subscription unlocks everything
- **GIVEN** a user with an active Pro subscription
- **WHEN** access is checked for any gated resource
- **THEN** access SHALL be allowed regardless of the `packs` array

#### Scenario: Pack purchase unlocks only that pack
- **GIVEN** a free-tier user whose `packs` contains `hsk-2`
- **WHEN** access is checked for an HSK 2 resource
- **THEN** access SHALL be allowed
- **WHEN** access is checked for an HSK 3 resource
- **THEN** access SHALL be denied with reason `requires-pack` and the SKU `hsk-3`

#### Scenario: Packs survive subscription lapse
- **GIVEN** a user whose Pro subscription has expired but whose `packs` contains `hsk-2`
- **WHEN** access is checked for an HSK 2 resource
- **THEN** access SHALL be allowed

### Requirement: Free tier allowance is defined by configuration
The free content allowance SHALL be defined by a single configuration object, not by conditionals at call sites. The configuration SHALL support, per HSK level, either a fraction of the level's words, an absolute word count, or an explicit list of words. The default SHALL be the first half of HSK 1 (78 of 156 words) resolved against the same deterministic `ORDER BY simplified` ordering used to list a level's words.

Changing the size or membership of the free allowance SHALL require editing only that configuration.

#### Scenario: Word inside the free allowance
- **GIVEN** the default free-tier configuration
- **WHEN** access is checked for the 10th HSK 1 word in simplified order for a free user
- **THEN** access SHALL be allowed

#### Scenario: Word outside the free allowance
- **GIVEN** the default free-tier configuration
- **WHEN** access is checked for the 100th HSK 1 word in simplified order for a free user
- **THEN** access SHALL be denied with reason `requires-pro` or `requires-pack`

#### Scenario: Free allowance is deterministic across sessions
- **WHEN** the free allowance is resolved twice for the same word database
- **THEN** the same set of words SHALL be returned both times

#### Scenario: Level with no free allowance configured
- **GIVEN** the default configuration, which grants no free words in HSK 2, 3 or 4
- **WHEN** access is checked for any HSK 3 word for a free user
- **THEN** access SHALL be denied

### Requirement: A single pure function decides every access question
The system SHALL expose `canAccess(resource, entitlements)` — a pure, synchronous function with no React or Firestore dependency — as the only decision point for content gating. It SHALL accept resources of kind `word`, `hskLevel` and `reader`, and SHALL return either `{ allowed: true }` or `{ allowed: false, reason, sku }` where `sku` names the catalogue entry that would unlock the resource.

An unknown or unrecognised SKU SHALL be treated as locked.

#### Scenario: Denial names the unlocking SKU
- **GIVEN** a free user
- **WHEN** access is checked for HSK 3
- **THEN** the result SHALL be `allowed: false` with a `sku` that, if purchased, would make the same check return `allowed: true`

#### Scenario: Unknown SKU fails closed
- **WHEN** access is checked for a reader whose `packSku` is not present in the catalogue
- **THEN** access SHALL be denied

#### Scenario: Function is callable outside React
- **WHEN** the queue builder, which is not a React component, checks access for a word
- **THEN** the same function SHALL be used with no adapter or duplicated logic

### Requirement: Words the user has already studied are never revoked
A word for which the user already holds SRS state SHALL remain accessible regardless of tier, so that introducing paid tiers never removes progress a user has already made.

#### Scenario: Previously studied word outside the free allowance
- **GIVEN** a free user with existing SRS state for an HSK 3 word
- **WHEN** the study queue is built
- **THEN** that word SHALL still be scheduled for review

#### Scenario: New word outside the free allowance
- **GIVEN** a free user with no SRS state for an HSK 3 word
- **WHEN** the study queue is built
- **THEN** that word SHALL NOT be introduced as a new card

### Requirement: Gating is applied at HSK browsing and at queue construction
Locked content SHALL be gated both where it is browsed and where a study queue is assembled. The HSK level page SHALL indicate locked levels and offer an unlock action in place of the study action. The study queue builder SHALL exclude locked words in every study mode before the session size limit is applied, so that navigating directly to a study URL for a locked level does not yield locked content. Where a locked level yields an empty queue, the system SHALL present the unlock option rather than an empty session.

Dictionary lookup and search SHALL NOT be gated. Word definitions, pinyin and character breakdowns remain readable at every level regardless of entitlement; "locked" means the word cannot be added to the user's study queue, not that it cannot be read.

#### Scenario: Locked level on the HSK page
- **GIVEN** a free user
- **WHEN** the HSK page renders
- **THEN** locked levels SHALL show a locked indicator and an unlock action instead of a study action

#### Scenario: Direct navigation to a locked level's study session
- **GIVEN** a free user
- **WHEN** the user navigates directly to the study route for HSK 4
- **THEN** the built queue SHALL contain no HSK 4 words the user has not already studied

#### Scenario: Every study mode respects gating
- **WHEN** a queue is built in `due`, `new`, `cram`, `refreshWeak` or `hardOnly` mode
- **THEN** locked words SHALL be excluded in each mode

#### Scenario: Locked level yields an empty queue
- **GIVEN** a free user who has exhausted the free allowance for a level
- **WHEN** they open the study route for that level
- **THEN** the system SHALL present the unlock option for that level
- **AND** SHALL NOT present an empty study session with no explanation

#### Scenario: Dictionary is readable regardless of entitlement
- **GIVEN** a free user
- **WHEN** they look up a word from a locked level in the dictionary
- **THEN** the definition, pinyin and character breakdown SHALL be shown

### Requirement: Graded readers gating contract
Graded readers SHALL be gated through the same access function. Each reader SHALL declare a `packSku` corresponding to a catalogue entry of kind `pack`. A reader SHALL be accessible when the user has active Pro, or when the reader's `packSku` is present in the user's `packs`.

#### Scenario: Reader gated by pack ownership
- **GIVEN** a free user whose `packs` contains a reader's `packSku`
- **WHEN** access is checked for that reader
- **THEN** access SHALL be allowed

#### Scenario: Reader gated for a free user
- **GIVEN** a free user who owns no packs
- **WHEN** access is checked for a reader
- **THEN** access SHALL be denied with reason `requires-pack` and the reader's `packSku`

### Requirement: Payment funnel uses hosted checkout only
The system SHALL never collect, transmit or store card numbers, CVCs, bank details or any other sensitive payment data. All payment collection SHALL occur on the provider's hosted checkout page. No payment provider secret key SHALL be present in the client bundle or in any `VITE_`-prefixed variable.

#### Scenario: Upgrade flow
- **WHEN** a user selects a plan or pack and confirms
- **THEN** the client SHALL request a checkout URL from the server-side checkout endpoint
- **AND** SHALL redirect the browser to the provider's hosted page
- **AND** SHALL render no payment input fields of its own

#### Scenario: No secrets in the client bundle
- **WHEN** the client bundle is built
- **THEN** it SHALL contain no payment provider secret key, webhook signing secret, or Firebase service account credential

### Requirement: Checkout sessions are bound to a verified user identity
The checkout endpoint SHALL derive the purchasing user's uid exclusively from a Firebase ID token verified server-side. A uid supplied in the request body, query string or any other client-controlled field SHALL be ignored. The verified uid and the requested SKU SHALL be attached to the provider's session as metadata so the webhook can attribute the payment.

#### Scenario: Missing or invalid ID token
- **WHEN** the checkout endpoint receives a request with no `Authorization` header or an unverifiable token
- **THEN** it SHALL respond 401 and SHALL NOT create a checkout session

#### Scenario: Attacker supplies another user's uid
- **WHEN** a request authenticated as user A includes `uid: "B"` in its body
- **THEN** the created checkout session SHALL be attributed to A

#### Scenario: Unknown SKU
- **WHEN** the checkout endpoint receives a SKU not present in the catalogue
- **THEN** it SHALL respond 400 and SHALL NOT create a checkout session

### Requirement: Webhooks are signature-verified and idempotent
The webhook endpoint SHALL verify the provider's signature against the raw, unparsed request body before interpreting the payload, and SHALL reject unverified requests with 400 without writing to Firestore. It SHALL record each processed event id and SHALL ignore repeat deliveries of an event it has already processed. It SHALL respond 2xx to event types it does not handle.

An event SHALL be recorded as fully processed only after its entitlement write has succeeded. An event whose processing was interrupted SHALL remain eligible for reprocessing on a later delivery, so that a handler terminated mid-flight cannot permanently suppress an entitlement the user has paid for.

#### Scenario: Forged webhook
- **WHEN** a request arrives with a payload granting Pro but an invalid signature
- **THEN** the endpoint SHALL respond 400
- **AND** no entitlement SHALL be written

#### Scenario: Duplicate delivery
- **WHEN** the provider redelivers an event that was already processed successfully
- **THEN** the endpoint SHALL respond 2xx
- **AND** SHALL NOT apply the entitlement change a second time

#### Scenario: Successful subscription purchase
- **WHEN** a verified event indicates a completed `pro-yearly` purchase with metadata uid U
- **THEN** `users/U/entitlements/current` SHALL be written with `plan: 'pro'`, `status: 'active'` and the provider's period end

#### Scenario: Successful pack purchase
- **WHEN** a verified event indicates a completed pack purchase with metadata uid U and SKU S
- **THEN** S SHALL be added to `users/U/entitlements/current.packs` without removing existing packs

#### Scenario: Unhandled event type
- **WHEN** a verified event of an unhandled type arrives
- **THEN** the endpoint SHALL respond 2xx and write nothing

#### Scenario: Handler terminated before the write completes
- **GIVEN** an event whose processing began but was interrupted before the entitlement write succeeded
- **WHEN** the provider redelivers that event
- **THEN** the endpoint SHALL process it rather than dismissing it as a duplicate
- **AND** the resulting entitlement SHALL be the same as if it had succeeded the first time

### Requirement: Entitlement writes tolerate out-of-order webhook delivery
Payment providers do not guarantee webhook ordering. Subscription state SHALL therefore be written only when the incoming event is not older than the event last applied to that user, compared using the provider's own event timestamp. Pack grants SHALL be applied regardless of ordering, since they are additive and never expire.

#### Scenario: Stale subscription event arrives after a newer one
- **GIVEN** a cancellation has been applied for a user
- **WHEN** an earlier-generated subscription event with an active status and a future period end is delivered afterwards
- **THEN** the subscription fields SHALL NOT be overwritten
- **AND** the user SHALL remain not-Pro

#### Scenario: Pack purchase delivered out of order
- **WHEN** a pack purchase event is delivered after a newer subscription event
- **THEN** the pack SHALL still be added to `packs`

### Requirement: Post-checkout return waits for the entitlement, never trusts the redirect
The post-checkout return page SHALL NOT infer purchase success from URL parameters. It SHALL subscribe to the user's entitlement document and report success only when the server-written entitlement reflects the purchase. If the entitlement has not arrived within a bounded wait, it SHALL tell the user the purchase is safe and to check back shortly.

#### Scenario: Entitlement arrives
- **WHEN** the webhook writes the entitlement while the return page is open
- **THEN** the page SHALL update to the unlocked state without a manual reload

#### Scenario: User forges a success URL
- **WHEN** a user navigates directly to the return route with success parameters and no purchase was made
- **THEN** no content SHALL be unlocked
- **AND** the page SHALL report that no purchase was found

#### Scenario: Webhook is slow
- **WHEN** the entitlement has not arrived within the bounded wait
- **THEN** the page SHALL show a reassurance message rather than an error or an unlocked state

### Requirement: Payment provider integration is swappable behind one interface
All provider-specific behaviour SHALL be confined to an adapter implementing a `PaymentProvider` interface exposing checkout session creation, billing portal session creation, webhook verification, and translation of a verified event into an entitlement update. The active provider SHALL be selected by a server-side environment variable. Adding a provider, including a cryptocurrency processor, SHALL require implementing that interface and registering it, with no change to the endpoints, the entitlement model, or any UI.

#### Scenario: Provider swap
- **WHEN** the active provider environment variable is changed to another registered adapter
- **THEN** the checkout, portal and webhook endpoints SHALL operate against the new provider with no other code change

#### Scenario: No provider configured
- **WHEN** no provider is configured
- **THEN** the checkout endpoint SHALL respond 503
- **AND** the client SHALL present payments as unavailable rather than failing opaquely

#### Scenario: Provider vocabulary stays in the adapter
- **WHEN** the webhook endpoint handles an event
- **THEN** it SHALL not reference any provider-specific event name or payload field directly

### Requirement: Payments can be disabled without removing gating code
A single client-side flag SHALL control whether payments are exposed. When payments are disabled, every access check SHALL return allowed, no paywall SHALL render, and the pricing route SHALL present as unavailable — providing a rollback that requires no data migration.

#### Scenario: Payments disabled
- **GIVEN** payments are disabled
- **WHEN** any access check runs
- **THEN** it SHALL return allowed

#### Scenario: Payments enabled
- **GIVEN** payments are enabled
- **WHEN** a free user checks access to a locked resource
- **THEN** it SHALL return denied with an unlocking SKU
