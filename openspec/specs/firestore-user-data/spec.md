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

### Requirement: Word analytics counters surfaced when reading the collection
When the client reads `users/{uid}/words`, the mapped word state SHALL carry the analytics fields stored on the document — `totalReviews`, `correctMeaningCount`, `incorrectMeaningCount`, `correctPronCount`, `incorrectPronCount`, `firstSeenAt`, `lastReviewedAt` and `hskLevel` — in addition to the SRS state. Documents written before a given counter existed SHALL map that counter to zero, and absent timestamps SHALL map to `null` rather than an epoch date, so "never" is distinguishable from "reviewed at the epoch".

#### Scenario: Counters available without a second read
- **WHEN** the client reads the whole `users/{uid}/words` collection
- **THEN** each mapped word SHALL expose its analytics counters
- **AND** no further Firestore read SHALL be required to obtain them

#### Scenario: Legacy document without counters
- **WHEN** a word document predates the analytics counters and has none of those fields
- **THEN** each counter SHALL map to 0
- **AND** `firstSeenAt` and `lastReviewedAt` SHALL map to `null`

### Requirement: User profile document stores preferences
`users/{uid}` SHALL store: `email`, `name`, `picture`, `dailyNewLimit` (default 20). Profile SHALL be created/updated on each sign-in.

`users/{uid}` MAY additionally store `lastRead`, the learner's most recent reading position, as an object carrying at minimum a non-empty reader identifier and a non-empty chapter identifier, and optionally reader and chapter titles, a timestamp, and a fractional progress value.

Because the field is written by one capability and read by another, the reader SHALL be the tolerant side of the contract. It SHALL accept the timestamp under either `at` or `updatedAt`, SHALL treat `progress` as genuinely optional rather than required, and SHALL reject a progress value outside `[0, 1)` — at or above 1 because the chapter is finished, below 0 because it is nonsensical and would render as a negative percentage. Consumers SHALL treat an absent, malformed or rejected `lastRead` as "no reading position" and SHALL NOT fail. Sign-in profile upsert SHALL NOT overwrite or clear `lastRead`.

#### Scenario: Profile upserted on sign-in
- **WHEN** user successfully signs in
- **THEN** `users/{uid}` SHALL be set with current Firebase Auth user fields
- **AND** `dailyNewLimit` SHALL be set to 20 if not already present

#### Scenario: Sign-in preserves reading position
- **WHEN** a profile already carrying `lastRead` is upserted on sign-in
- **THEN** `lastRead` SHALL remain unchanged

#### Scenario: Consumer tolerates missing reading position
- **WHEN** a consumer reads a profile with no `lastRead` field
- **THEN** it SHALL behave as though no reading position exists and SHALL NOT error

#### Scenario: Either timestamp spelling accepted
- **WHEN** `lastRead` carries its timestamp under `at` rather than `updatedAt`
- **THEN** the position SHALL still be accepted as valid

#### Scenario: Position without progress accepted
- **WHEN** `lastRead` carries valid identifiers but no `progress` field
- **THEN** the position SHALL be accepted
- **AND** the consuming recommendation SHALL omit the percentage from its text

#### Scenario: Negative progress rejected
- **WHEN** `lastRead` carries a `progress` of -5
- **THEN** the position SHALL be treated as absent

### Requirement: Firestore security rules enforce per-user isolation
Firestore rules SHALL allow read and write only to `users/{uid}/**` where `uid` matches the authenticated user's Firebase Auth UID.

#### Scenario: User cannot read another user's data
- **WHEN** an authenticated user attempts to read `users/{otherUid}/words`
- **THEN** the Firestore security rules SHALL deny the request

#### Scenario: Unauthenticated request denied
- **WHEN** a request arrives without a valid Firebase Auth token
- **THEN** all Firestore reads and writes SHALL be denied
