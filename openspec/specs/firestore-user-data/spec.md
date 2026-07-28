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
The user SHALL be able to mark a word as `Mastered` from the personal dictionary — from a word row, from the word detail view, or for a multi-select of words. This sets `intervalMeaning`, `intervalPinyin`, `intervalAudio` to 365, `status` to `Mastered`, and `nextReviewDate` to one year in the future.

The control SHALL NOT be offered during a study session; the study card exposes grading actions only.

Marking a word that has no document in `users/{uid}/words` SHALL create the document carrying `deckName` and `hskLevel` before applying the mastered state.

The action SHALL be reversible: unmarking a `Mastered` word SHALL set `intervalMeaning`, `intervalPinyin` and `intervalAudio` to 1, `consecutiveFails` to 0, `status` to `Weak` and `nextReviewDate` to now, leaving `easeFactor` unchanged, so the word returns to the review queue.

#### Scenario: Mark as known from the personal dictionary
- **WHEN** user activates "Mark as known" on a word in the personal dictionary
- **THEN** the word SHALL be written to Firestore as `Mastered` with all intervals at 365
- **AND** the word SHALL NOT reappear in future due-review queues

#### Scenario: Bulk mark as known
- **WHEN** user selects several words in the personal dictionary and marks them known
- **THEN** all selected words SHALL be written as `Mastered` in batched writes
- **AND** the writes SHALL be split across multiple batches when they exceed the Firestore batch limit

#### Scenario: No mark-as-known control on the study card
- **WHEN** a study card reveals the meaning
- **THEN** only grading actions SHALL be presented
- **AND** no "mark as fully known" control SHALL be rendered

#### Scenario: Unmark restores review scheduling
- **GIVEN** a word previously marked known
- **WHEN** user unmarks it
- **THEN** its intervals SHALL be 1, `consecutiveFails` SHALL be 0, `status` SHALL be `Weak` and `nextReviewDate` SHALL be now
- **AND** it SHALL appear in the next due-review session

### Requirement: Words can be added to the personal dictionary without a review
The system SHALL support creating `users/{uid}/words/{simplified}` documents at default SRS state for words the user has encountered but not yet reviewed, without disturbing documents that already exist.

A created document SHALL carry intervals of 0, `easeFactor` 2.5, `consecutiveFails` 0, `status` `Unstudied`, `nextReviewDate` at the epoch, `firstSeenAt` as a server timestamp, and `deckName` and `hskLevel` when the caller supplies them. It SHALL NOT carry review counters, so knowledge percentage remains undefined until the first review.

#### Scenario: Encountered word created at default state
- **WHEN** a word with no existing document is added
- **THEN** `users/{uid}/words/{simplified}` SHALL be created with default SRS state and `status` `Unstudied`
- **AND** `firstSeenAt` SHALL be set to the server timestamp

#### Scenario: Adding a word that already exists is a no-op
- **GIVEN** a word already at `status: Strong` with accumulated review counters
- **WHEN** the same word is added again
- **THEN** its document SHALL be left unchanged

#### Scenario: Added word has no knowledge percentage
- **WHEN** a word created this way is shown in the personal dictionary
- **THEN** no knowledge percentage SHALL be displayed for it

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

### Requirement: Firestore security rules enforce per-user isolation
Firestore rules SHALL allow read and write only to `users/{uid}/**` where `uid` matches the authenticated user's Firebase Auth UID.

#### Scenario: User cannot read another user's data
- **WHEN** an authenticated user attempts to read `users/{otherUid}/words`
- **THEN** the Firestore security rules SHALL deny the request

#### Scenario: Unauthenticated request denied
- **WHEN** a request arrives without a valid Firebase Auth token
- **THEN** all Firestore reads and writes SHALL be denied
