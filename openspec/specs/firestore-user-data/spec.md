# firestore-user-data Specification

## Purpose
Holds every piece of per-user state in Firestore under `users/{uid}` — word SRS state, learning analytics, daily stats and profile preferences — isolated per user by security rules. All aggregates live on the word document itself; there is no per-review history subcollection.
## Requirements
### Requirement: Per-user SRS state stored in Firestore subcollection
Each user's word SRS state SHALL be stored in Firestore at `users/{uid}/words/{simplified}`. A missing document for a word SHALL be treated as Unstudied (all intervals 0, easeFactor 2.5).

#### Scenario: First review of an unstudied word creates Firestore document
- **WHEN** user completes a review of a word with no existing Firestore document
- **THEN** the system SHALL create `users/{uid}/words/{simplified}` with the computed SRS state
- **AND** the document SHALL include `deckName` copied from the word's SQLite record

#### Scenario: Subsequent review updates existing document
- **WHEN** user completes a review of a word that already has a Firestore document
- **THEN** the system SHALL update the document fields (`intervalMeaning`, `intervalPinyin`, `easeFactor`, `consecutiveFails`, `nextReviewDate`, `status`)
- **AND** SHALL NOT overwrite `deckName`

### Requirement: All word data lives on the word document — no separate history collection
There is no separate history subcollection. All data needed to drive the SRS algorithm and compute a knowledge percentage SHALL live directly on `users/{uid}/words/{simplified}`. The knowledge percentage for a word is `correctMeaningCount / totalReviews`.

Each `users/{uid}/words/{simplified}` document SHALL contain:

**SRS state:**
- `intervalMeaning` (number), `intervalPinyin` (number), `intervalAudio` (number)
- `easeFactor` (number, default 2.5)
- `consecutiveFails` (number)
- `nextReviewDate` (Timestamp)
- `status` (string: `Unstudied|Weak|Strong|Memorized|Mastered|Leech`)
- `deckName` (string)

**Learning analytics (all incremented atomically via Firestore `increment()`):**
- `totalReviews` (number) — cumulative review count
- `correctMeaningCount` (number) — times user knew the meaning
- `incorrectMeaningCount` (number) — times user did not know the meaning
- `correctPronCount` (number) — times user knew the pronunciation
- `incorrectPronCount` (number) — times user did not know the pronunciation
- `firstSeenAt` (Timestamp) — set once on the first review; never overwritten
- `lastReviewedAt` (Timestamp, server timestamp) — updated on every review
- `hskLevel` (number | null) — cached from SQLite at first review; enables Firestore-only queries by level

#### Scenario: Document written with all required fields
- **WHEN** a word document is created or updated
- **THEN** all SRS state fields SHALL be present and typed correctly
- **AND** `status` SHALL be one of: `Unstudied`, `Weak`, `Strong`, `Memorized`, `Mastered`, `Leech`
- **AND** analytics counters SHALL be incremented atomically (not overwritten)

#### Scenario: firstSeenAt set only on first review
- **WHEN** a new card (`isNew: true`) is reviewed for the first time
- **THEN** `firstSeenAt` SHALL be written with the current server timestamp
- **WHEN** an existing card is reviewed subsequently
- **THEN** `firstSeenAt` SHALL NOT be overwritten

#### Scenario: Knowledge percentage derivable from word document
- **GIVEN** `totalReviews > 0`
- **THEN** knowledge % = `correctMeaningCount / totalReviews * 100`
- **AND** no query to a separate history collection is required

### Requirement: User can mark words as fully known
The user SHALL be able to mark a word as `Mastered` directly from the study card when the meaning is revealed. This sets `intervalMeaning`, `intervalPinyin`, `intervalAudio` to 365, `status` to `Mastered`, and `nextReviewDate` to one year in the future.

#### Scenario: Mark as known from study card
- **WHEN** the meaning is revealed and user presses "Mark as known"
- **THEN** the word SHALL be written to Firestore as `Mastered` and advanced past immediately
- **AND** the word SHALL NOT reappear in future due-review queues

### Requirement: Daily stats upserted on each review with accuracy tracking
The system SHALL upsert `users/{uid}/dailyStats/{YYYY-MM-DD}` on each review incrementing:
- `totalReviewed` by 1 always
- `correctCount` by 1 when both `knewPronunciation` and `knewMeaning` are true
- `incorrectCount` by 1 when either is false
- `newCardsSeen` by 1 only if the word was Unstudied before this review

#### Scenario: First review of the day creates daily stats document
- **WHEN** user completes their first review of the day
- **THEN** `users/{uid}/dailyStats/{today}` SHALL be created with `totalReviewed: 1`

#### Scenario: Reviewing a new card increments newCardsSeen
- **WHEN** user reviews a word that had no prior Firestore document (Unstudied)
- **THEN** `newCardsSeen` SHALL be incremented by 1 in today's daily stats

#### Scenario: Accuracy tracked per day
- **WHEN** user grades a card fully correct (knew both pronunciation and meaning)
- **THEN** `correctCount` SHALL be incremented and `incorrectCount` SHALL NOT
- **WHEN** user fails either skill
- **THEN** `incorrectCount` SHALL be incremented

### Requirement: User profile document stores preferences
`users/{uid}` SHALL store: `email`, `name`, `picture`, `dailyNewLimit` (default 20). Profile SHALL be created/updated on each sign-in.

#### Scenario: Profile upserted on sign-in
- **WHEN** user successfully signs in
- **THEN** `users/{uid}` SHALL be set with current Firebase Auth user fields
- **AND** `dailyNewLimit` SHALL be set to 20 if not already present

### Requirement: Entitlement and billing subcollections are server-written
`users/{uid}` SHALL have two subcollections whose documents are written exclusively by trusted server-side code using the Firebase Admin SDK, and never by any client:

**`users/{uid}/entitlements/current`**
- `plan` (string: `free|pro`)
- `planSource` (string: `subscription|grant`, or null)
- `status` (string: `active|past_due|canceled|expired`, or null)
- `currentPeriodEnd` (Timestamp or null)
- `packs` (array of catalogue SKU strings)
- `provider` (string or null)
- `updatedAt` (Timestamp, server timestamp)

**`users/{uid}/billing/customer`**
- `provider` (string)
- `customerId` (string) — the provider's customer identifier, used to open a billing portal session
- `updatedAt` (Timestamp, server timestamp)

A missing `entitlements/current` document SHALL be treated as `{ plan: 'free', packs: [] }`. Clients SHALL NOT create either document.

#### Scenario: Entitlement document created by webhook
- **WHEN** a verified payment webhook is processed for user U
- **THEN** `users/U/entitlements/current` SHALL be written by the Admin SDK
- **AND** `updatedAt` SHALL be a server timestamp

#### Scenario: Client cannot create the entitlement document
- **WHEN** an authenticated user writes to their own `users/{uid}/entitlements/current`
- **THEN** the write SHALL be denied

#### Scenario: Client can read its own billing customer record
- **WHEN** an authenticated user reads `users/{uid}/billing/customer`
- **THEN** the read SHALL succeed

### Requirement: Webhook events are recorded for idempotency
The system SHALL record processed payment webhook event identifiers at top-level `webhookEvents/{eventId}`. This collection SHALL be inaccessible to all clients for both read and write.

#### Scenario: Client attempts to read webhook events
- **WHEN** any client, authenticated or not, reads `webhookEvents/{eventId}`
- **THEN** the request SHALL be denied

#### Scenario: Repeat event ignored
- **WHEN** a webhook event whose id already exists in `webhookEvents` is delivered again
- **THEN** no entitlement write SHALL occur

### Requirement: Firestore security rules enforce per-user isolation
Firestore rules SHALL allow read only to `users/{uid}/**` where `uid` matches the authenticated user's Firebase Auth UID, and SHALL allow write only to the user-owned portions of that tree.

Rules SHALL NOT use a recursive `{document=**}` wildcard to grant writes under `users/{uid}`, because a recursive allow rule is OR-ed with more specific rules and would therefore re-grant write access to paths intended to be server-only. Each user-owned subcollection SHALL instead be matched explicitly, so that any path not enumerated is denied by default.

`users/{uid}/entitlements/**` and `users/{uid}/billing/**` SHALL be readable by their owner and writable by no client. Server-side code writes them through the Firebase Admin SDK, which bypasses security rules.

#### Scenario: User cannot read another user's data
- **WHEN** an authenticated user attempts to read `users/{otherUid}/words`
- **THEN** the Firestore security rules SHALL deny the request

#### Scenario: Unauthenticated request denied
- **WHEN** a request arrives without a valid Firebase Auth token
- **THEN** all Firestore reads and writes SHALL be denied

#### Scenario: User can still write their own SRS and stats data
- **WHEN** an authenticated user writes `users/{uid}/words/{simplified}` or `users/{uid}/dailyStats/{date}` or their own profile document
- **THEN** the write SHALL be allowed

#### Scenario: User cannot write their own entitlements
- **WHEN** an authenticated user attempts any write to `users/{uid}/entitlements/{docId}` or `users/{uid}/billing/{docId}`
- **THEN** the write SHALL be denied

#### Scenario: Unenumerated subcollection denied by default
- **WHEN** a client writes to a subcollection under `users/{uid}` that the rules do not explicitly match
- **THEN** the write SHALL be denied
