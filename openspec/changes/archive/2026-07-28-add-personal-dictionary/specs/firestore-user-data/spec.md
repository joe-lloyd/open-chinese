## MODIFIED Requirements

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

## ADDED Requirements

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
