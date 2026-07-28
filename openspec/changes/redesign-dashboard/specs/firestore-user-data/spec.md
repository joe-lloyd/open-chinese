## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: User profile document stores preferences
`users/{uid}` SHALL store: `email`, `name`, `picture`, `dailyNewLimit` (default 20). Profile SHALL be created/updated on each sign-in.

`users/{uid}` MAY additionally store `lastRead`, the learner's most recent reading position, as an object carrying at minimum a reader identifier and a chapter identifier and optionally a title and a fractional progress value. The field is optional: consumers SHALL treat an absent or incomplete `lastRead` as "no reading position" and SHALL NOT fail when it is missing. Sign-in profile upsert SHALL NOT overwrite or clear `lastRead`.

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
