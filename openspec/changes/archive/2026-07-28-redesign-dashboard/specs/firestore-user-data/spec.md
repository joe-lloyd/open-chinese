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
