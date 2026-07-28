## ADDED Requirements

### Requirement: Reader progress stored per user
Reader progress SHALL be stored at `users/{uid}/readerProgress/{readerId}` containing:
- `readerId` (string)
- `completedChapters` (array of chapter ids, appended idempotently)
- `lastChapterId` (string) — the chapter most recently opened in this reader
- `lastReadAt` (Timestamp, server timestamp)

A missing document SHALL be treated as no progress in that reader.

#### Scenario: First completed chapter creates the progress document
- **WHEN** user marks the first chapter of a reader as finished
- **THEN** `users/{uid}/readerProgress/{readerId}` SHALL be created with that chapter id in `completedChapters`

#### Scenario: Completing a chapter twice does not duplicate it
- **WHEN** an already-completed chapter is marked finished again
- **THEN** `completedChapters` SHALL contain that chapter id exactly once

#### Scenario: Word writes and chapter completion commit together
- **WHEN** a chapter is finished
- **THEN** the encountered-word documents and the `completedChapters` update SHALL be committed as one atomic write
- **AND** if that write fails, neither the words nor the completion SHALL be recorded, leaving the chapter cleanly retryable

#### Scenario: Missing document means no progress
- **WHEN** no document exists for a reader
- **THEN** that reader SHALL be shown with zero chapters finished

### Requirement: Words encountered while reading are recorded as unstudied
When a chapter is completed, the system SHALL write a document at `users/{uid}/words/{simplified}` for every word in that chapter that had no document, with `status` `Unstudied`, all intervals `0`, `easeFactor` `2.5`, `nextReviewDate` at the Unix epoch, plus:
- `encounteredAt` (Timestamp, server timestamp)
- `encounteredIn` (string) — `<readerId>/<chapterId>`
- `deckName` — the word's deck from the static word database, or `Readers` when the word is not in it
- `customWordData` — pinyin and definition, written only for words absent from the static word database

Words that already have a document SHALL NOT be modified. No new `status` value SHALL be introduced; encountered-but-unstudied words remain `Unstudied`.

#### Scenario: New word document written on chapter completion
- **GIVEN** `苹果` has no document for the user
- **WHEN** user finishes a chapter containing `苹果`
- **THEN** `users/{uid}/words/苹果` SHALL be created with `status` `Unstudied` and `encounteredIn` set to the reader and chapter

#### Scenario: Existing SRS state preserved
- **GIVEN** `朋友` already has a document with `intervalMeaning` 10
- **WHEN** user finishes a chapter containing `朋友`
- **THEN** that document SHALL be left unchanged

#### Scenario: Word absent from the static database carries its own data
- **GIVEN** a reader word is not present in the static word database
- **WHEN** its document is written
- **THEN** `customWordData` SHALL carry its pinyin and definition
- **AND** `deckName` SHALL be `Readers`

### Requirement: Profile records the user's last reading position
The user profile document `users/{uid}` SHALL carry a `lastRead` field holding `readerId`, `chapterId`, `readerTitle`, `chapterTitle` and `at` (Timestamp), updated whenever a chapter is opened. This field is a display cache for a "continue reading" entry point; `users/{uid}/readerProgress` remains the authoritative record of progress.

#### Scenario: Opening a chapter updates the profile pointer
- **WHEN** user opens a chapter
- **THEN** `users/{uid}.lastRead` SHALL be set to that reader and chapter with the current server timestamp

#### Scenario: Absent pointer for a user who has never read
- **WHEN** a user who has never opened a chapter is loaded
- **THEN** `lastRead` SHALL be absent and consumers SHALL treat that as "no reading in progress"

### Requirement: Security rules name the reader progress subcollection explicitly
`firestore.rules` SHALL grant the owning user read and write access to `users/{uid}/readerProgress/{readerId}` through a match block that names the collection, rather than relying on a recursive `users/{uid}/{document=**}` match. Recursive matches cannot be relied on here: Firestore evaluates matching rules as a union rather than letting the most specific win, so a recursive `allow write` cannot coexist with any server-authoritative collection under `users/{uid}`, and removing it must not silently revoke reader progress.

#### Scenario: User cannot read another user's reader progress
- **WHEN** an authenticated user attempts to read `users/{otherUid}/readerProgress/{readerId}`
- **THEN** the Firestore security rules SHALL deny the request

#### Scenario: Reader progress stays writable without a recursive match
- **GIVEN** the recursive `users/{uid}/{document=**}` match has been removed
- **WHEN** the owning user writes `users/{uid}/readerProgress/{readerId}`
- **THEN** the write SHALL be permitted by the explicit match block
