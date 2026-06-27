## MODIFIED Requirements

### Requirement: SRS state read and written via Firestore adapter
The SRS engine SHALL operate on SRS state objects read from and written to Firestore (`users/{uid}/words/{simplified}`). The pure computation functions (`applyBinaryReview`, `calculateNewInterval`, `deriveStatus`, `checkMastery`) SHALL remain client-side TypeScript with no I/O. A storage adapter SHALL handle all Firestore reads and writes.

#### Scenario: Review applies SRS computation then writes to Firestore
- **WHEN** user completes grading a card with `knewPronunciation` and `knewMeaning`
- **THEN** `applyBinaryReview` SHALL compute the new state using the current Firestore document values (or defaults if missing)
- **AND** the computed state SHALL be written back to `users/{uid}/words/{simplified}`
- **AND** a history document SHALL be appended to `users/{uid}/history`

#### Scenario: Unstudied word (no Firestore doc) treated as zero-interval state
- **WHEN** `applyBinaryReview` is called for a word with no existing Firestore document
- **THEN** the function SHALL use default values: `intervalMeaning: 0`, `intervalPinyin: 0`, `intervalAudio: 0`, `easeFactor: 2.5`, `consecutiveFails: 0`
- **AND** the result SHALL be written as a new Firestore document

## REMOVED Requirements

### Requirement: SRS state stored via Prisma/SQLite
**Reason**: Production deployment no longer includes a server; Prisma and SQLite are removed from the production data path.
**Migration**: All SRS state is stored in Firestore. Existing SQLite data is not migrated (acceptable for personal tool fresh start). Server-side Prisma code remains for local development only.
