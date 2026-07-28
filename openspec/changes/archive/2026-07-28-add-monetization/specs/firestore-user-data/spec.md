## ADDED Requirements

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

## MODIFIED Requirements

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
