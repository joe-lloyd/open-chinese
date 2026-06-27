## ADDED Requirements

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

### Requirement: Firestore document structure matches SRS state plus per-word analytics
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
- **THEN** `firstSeenAt` SHALL NOT be overwritten (field absent from the update object)

### Requirement: Review history appended as subcollection documents with full SRS snapshot
Each completed review SHALL append a document to `users/{uid}/history/{autoId}` with:

**Outcome:** `simplified`, `knewPronunciation`, `knewMeaning`, `response`, `reviewedAt` (server timestamp)

**SRS audit trail:**
- `intervalMeaningBefore`, `intervalPinyinBefore` — intervals before this review
- `intervalMeaningAfter`, `intervalPinyinAfter` — intervals computed by this review
- `easeFactorBefore`, `easeFactorAfter` — ease factor before and after
- `nextReviewDateAfter` (Timestamp) — when the card is next scheduled
- `hskLevel` (number | null) — HSK level of the word

#### Scenario: Review history written on card completion
- **WHEN** user grades both pronunciation and meaning for a card
- **THEN** a history document SHALL be written with `reviewedAt` = current server timestamp
- **AND** the document SHALL include the full before/after SRS snapshot
- **AND** the document SHALL NOT overwrite any existing history (append-only)

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
`users/{uid}/profile` SHALL store: `email`, `name`, `picture`, `dailyNewLimit` (default 20). Profile SHALL be created/updated on each sign-in.

#### Scenario: Profile upserted on sign-in
- **WHEN** user successfully signs in
- **THEN** `users/{uid}/profile` SHALL be set with current Firebase Auth user fields
- **AND** `dailyNewLimit` SHALL be set to 20 if not already present

### Requirement: Firestore security rules enforce per-user isolation
Firestore rules SHALL allow read and write only to `users/{uid}/**` where `uid` matches the authenticated user's Firebase Auth UID.

#### Scenario: User cannot read another user's data
- **WHEN** an authenticated user attempts to read `users/{otherUid}/words`
- **THEN** the Firestore security rules SHALL deny the request

#### Scenario: Unauthenticated request denied
- **WHEN** a request arrives without a valid Firebase Auth token
- **THEN** all Firestore reads and writes SHALL be denied
