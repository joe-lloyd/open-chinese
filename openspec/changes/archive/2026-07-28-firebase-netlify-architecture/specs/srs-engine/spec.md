## MODIFIED Requirements

### Requirement: SRS state read and written via Firestore adapter
The SRS engine SHALL operate on SRS state objects read from and written to Firestore (`users/{uid}/words/{simplified}`). The pure computation functions (`applyBinaryReview`, `calculateNewInterval`, `deriveStatus`, `checkMastery`) SHALL remain client-side TypeScript with no I/O. A storage adapter SHALL handle all Firestore reads and writes.

#### Scenario: Review applies SRS computation then writes to Firestore
- **WHEN** user completes grading a card with `knewPronunciation` and `knewMeaning`
- **THEN** `applyBinaryReview` SHALL compute the new state using the current Firestore document values (or defaults if missing)
- **AND** the computed state SHALL be written back to `users/{uid}/words/{simplified}`
- **AND** aggregate analytics counters on the word document SHALL be incremented atomically

#### Scenario: Unstudied word (no Firestore doc) treated as zero-interval state
- **WHEN** `applyBinaryReview` is called for a word with no existing Firestore document
- **THEN** the function SHALL use default values: `intervalMeaning: 0`, `intervalPinyin: 0`, `intervalAudio: 0`, `easeFactor: 2.5`, `consecutiveFails: 0`
- **AND** the result SHALL be written as a new Firestore document

### Requirement: Graduated initial learning steps for new cards
`calculateNewInterval` SHALL use stepped intervals for cards being reviewed for the first time, rather than applying the SM-2 multiplier immediately.

| Previous interval | Response | New interval |
|---|---|---|
| 0 (never reviewed) | Good | 1 day |
| < 2 days | Good | 4 days |
| < 5 days | Good | 10 days |
| ≥ 5 days | Good | `interval × 2.5 × easeFactor` (SM-2) |
| Any | Again | 1 day (reset) |

#### Scenario: First successful review of a new card
- **WHEN** `calculateNewInterval(0, 'Good', easeFactor)` is called
- **THEN** the result SHALL be `1` day (not `1 × 2.5 × easeFactor`)

#### Scenario: Second successful review
- **WHEN** current interval is 1 day and response is `Good`
- **THEN** the result SHALL be `4` days

#### Scenario: Third successful review graduates to SM-2
- **WHEN** current interval is 4 days and response is `Good`
- **THEN** the result SHALL be `10` days

#### Scenario: Any fail resets to minimum interval
- **WHEN** response is `Again` at any interval
- **THEN** the result SHALL be `1` day

## REMOVED Requirements

### Requirement: SRS state stored via Prisma/SQLite
**Reason**: Production deployment no longer includes a server; Prisma, SQLite user data store, and the Hono API server have all been deleted from the repository.
**Migration**: All SRS state is stored in Firestore. Existing SQLite data was not migrated (personal tool; fresh start acceptable). The `server/` workspace has been removed entirely.
