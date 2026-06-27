## MODIFIED Requirements

### Requirement: Card queue built client-side from Firestore and SQLite
The system SHALL build the study queue without any server API call. Due cards SHALL be fetched from Firestore (`users/{uid}/words` where `nextReviewDate <= now` and `status` not `Mastered` or `Leech`). Unstudied cards SHALL come from words in SQLite that have no corresponding Firestore document, up to the daily new-card limit.

#### Scenario: Session queue built from due Firestore cards
- **WHEN** user starts a review session
- **THEN** the system SHALL query Firestore for all words where `nextReviewDate <= now`
- **AND** SHALL cross-reference with SQLite to get word content (simplified, pinyin, definition)
- **AND** SHALL assemble the queue sorted by `nextReviewDate` ascending

#### Scenario: Unstudied cards fill remaining queue slots up to daily limit
- **WHEN** fewer due cards exist than the session size
- **THEN** the system SHALL add Unstudied words (from SQLite, not in Firestore) up to `dailyNewLimit - newCardsSeen` for today
- **AND** new words SHALL be ordered by `hsk_level` ascending then `id` ascending

#### Scenario: Daily new-card limit respected
- **WHEN** `newCardsSeen` for today already equals `dailyNewLimit`
- **THEN** no Unstudied cards SHALL be added to the queue

### Requirement: Review result written directly to Firestore
After the user completes both grading phases for a card, the computed SRS state SHALL be written to `users/{uid}/words/{simplified}` via the Firestore adapter. No server API call is made.

#### Scenario: Card graded and Firestore updated
- **WHEN** user grades both pronunciation and meaning
- **THEN** the client SHALL call `applyBinaryReview` and write the result to Firestore
- **AND** the next card in the queue SHALL be presented immediately (optimistic update; no await block on UI)
