## ADDED Requirements

### Requirement: Review outcomes recorded as aggregate counters on the word document
Each completed card review SHALL update aggregate counters on the word's own Firestore document at `users/{uid}/words/{simplified}`. No per-review document SHALL be created. On every review the system SHALL increment `totalReviews` by 1, increment exactly one of `correctMeaningCount` / `incorrectMeaningCount` according to `knewMeaning`, increment exactly one of `correctPronCount` / `incorrectPronCount` according to `knewPronunciation`, and set `lastReviewedAt` to the server timestamp. When the reviewed card was new, the system SHALL also set `firstSeenAt` to the server timestamp.

The counter writes SHALL be issued as field-transform increments so that concurrent reviews cannot lose an update, and SHALL be applied to the same document that holds the SRS state written by the review.

#### Scenario: Counters incremented when both sub-skills were known
- **WHEN** a review completes with `knewPronunciation: true` and `knewMeaning: true`
- **THEN** `totalReviews` SHALL increment by 1
- **AND** `correctPronCount` SHALL increment by 1
- **AND** `correctMeaningCount` SHALL increment by 1
- **AND** `incorrectPronCount` and `incorrectMeaningCount` SHALL be unchanged
- **AND** `lastReviewedAt` SHALL be set to the server timestamp

#### Scenario: Mixed result splits the per-sub-skill counters
- **WHEN** a review completes with `knewPronunciation: false` and `knewMeaning: true`
- **THEN** `incorrectPronCount` SHALL increment by 1
- **AND** `correctMeaningCount` SHALL increment by 1
- **AND** `totalReviews` SHALL increment by 1

#### Scenario: First review of a word stamps firstSeenAt
- **WHEN** a review completes for a card that had no prior Firestore document
- **THEN** `firstSeenAt` SHALL be set to the server timestamp
- **AND** later reviews of the same word SHALL NOT overwrite `firstSeenAt`

#### Scenario: No per-review history document is written
- **WHEN** any review completes
- **THEN** the system SHALL NOT write a document to a per-review history collection
- **AND** the only durable per-review outputs SHALL be the word document counters and that day's `dailyStats` document

### Requirement: Derived Good/Hard/Again response is computed but not persisted
`applyBinaryReview` SHALL derive a `response` value of `Good` when both sub-skills were known, `Again` when neither was known, and `Hard` when exactly one was known. This value SHALL be a computation detail only: it SHALL NOT be written to Firestore, and no stored field SHALL be derived from it. `Easy` SHALL never be produced by the binary review flow.

#### Scenario: Response derived from the two booleans
- **WHEN** `applyBinaryReview` is called with `knewPronunciation: true` and `knewMeaning: false`
- **THEN** the returned `response` SHALL be `Hard`

#### Scenario: Both sub-skills known derives Good
- **WHEN** `applyBinaryReview` is called with `knewPronunciation: true` and `knewMeaning: true`
- **THEN** the returned `response` SHALL be `Good`

#### Scenario: Derived response is discarded by the write path
- **WHEN** the study session writes a review result to `users/{uid}/words/{simplified}`
- **THEN** the written document SHALL NOT contain a `response` field
- **AND** no consumer SHALL read a persisted per-review response value

### Requirement: Per-day review aggregates recorded in dailyStats
Each completed review SHALL update the document at `users/{uid}/dailyStats/{YYYY-MM-DD}` for the current local date. The document SHALL carry a plain `date` field equal to its own id so it can be range-queried, and SHALL increment `totalReviewed` by 1 on every review, `correctCount` by 1 when the user knew BOTH sub-skills, `incorrectCount` by 1 otherwise, and `newCardsSeen` by 1 when the reviewed card was new.

#### Scenario: Daily counters updated on a fully-known review
- **WHEN** a review completes on 2026-07-27 with `knewPronunciation: true` and `knewMeaning: true`
- **THEN** `users/{uid}/dailyStats/2026-07-27` SHALL have `totalReviewed` incremented by 1
- **AND** `correctCount` SHALL be incremented by 1
- **AND** `incorrectCount` SHALL be unchanged

#### Scenario: Partial knowledge counts as incorrect for the day
- **WHEN** a review completes with `knewPronunciation: true` and `knewMeaning: false`
- **THEN** `incorrectCount` for that date SHALL increment by 1
- **AND** `correctCount` SHALL be unchanged

#### Scenario: New cards counted separately from total reviews
- **WHEN** a card that had no prior Firestore document is reviewed
- **THEN** `newCardsSeen` for that date SHALL increment by 1
- **AND** `totalReviewed` for that date SHALL also increment by 1

#### Scenario: Date document created on the first review of the day
- **WHEN** the first review of a given date completes and no document exists for that date
- **THEN** the system SHALL create `users/{uid}/dailyStats/{date}` with its `date` field populated before applying the increments

## REMOVED Requirements

### Requirement: ReviewHistory captures per-step knowledge state
**Reason**: The `ReviewHistory` store no longer exists in any form. The relational `ReviewHistory` table was deleted with the `server/` workspace and Prisma in commit `8850661`, and its Firestore replacement — the `users/{uid}/history/{autoId}` collection with its `appendHistory` / `getHistory` accessors — was deleted in commit `5986ae3` because it cost one write per review with unbounded growth and had no read path. The requirement's trigger, `POST /api/session/review`, also no longer exists: there is no server, and the client writes to Firestore directly.

**Migration**: Per-review knowledge state is now captured as aggregates in two places, both specified above. Per-word totals live on `users/{uid}/words/{simplified}` as `totalReviews`, `correctMeaningCount`, `incorrectMeaningCount`, `correctPronCount`, `incorrectPronCount`, `lastReviewedAt` and `firstSeenAt`. Per-day totals live on `users/{uid}/dailyStats/{YYYY-MM-DD}` as `totalReviewed`, `correctCount`, `incorrectCount` and `newCardsSeen`. Individual review timestamps and per-review before/after SRS snapshots are not recoverable and no feature depends on them; consumers that previously read history (such as the dashboard retention series) read the daily aggregates instead. The `subskill: "combined"` and `response` fields have no replacement — `subskill` was always constant, and the derived response is computed and discarded.
