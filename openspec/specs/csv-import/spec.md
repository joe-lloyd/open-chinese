# csv-import Specification

## Purpose
Migrates an existing Hack Chinese vocabulary export into the user's Firestore word collection, reconstructing each word's SRS state from the CSV's status and next-review columns.
## Requirements
### Requirement: Hack Chinese CSV format parsing
The system SHALL accept CSV files matching the Hack Chinese export schema with columns: `Simplified`, `Traditional`, `Pinyin`, `Definitions`, `List Name`, `Status`, `Next Review`.

#### Scenario: Valid CSV uploaded
- **WHEN** a valid Hack Chinese CSV is uploaded
- **THEN** all rows SHALL be parsed without error and a preview SHALL be shown before commit

#### Scenario: Missing required column
- **WHEN** the CSV is missing the `Simplified` column
- **THEN** the import SHALL be rejected with a descriptive error message before any database writes

### Requirement: Status mapping to SRS state
The system SHALL map Hack Chinese status values to internal states:
- `Unstudied` → `Unstudied` (all intervals = 0, ease = 2.5)
- `Weak` → `Weak` (interval derived from nextReview − importDate, capped at 7 days)
- `Strong` → `Strong` (interval derived from nextReview − importDate, capped at 21 days)
- `Memorized` → `Memorized` (interval derived from nextReview − importDate, capped at 180 days)
- `Mastered` → `Mastered` (all intervals pinned to 365 days)

#### Scenario: Mastered word gets max interval
- **WHEN** a row has `Status` = `Mastered`
- **THEN** all three sub-skill intervals SHALL be set to 365.0 days

#### Scenario: Weak word derives interval from timestamp
- **WHEN** a row has `Status` = `Weak` and `Next Review` is 5 days from import date
- **THEN** the intervals SHALL be set to 5.0 days (capped at 7)

### Requirement: Interval reconstruction from Next Review timestamp
The system SHALL derive the initial interval as `nextReviewDate − importTimestamp` in days. Negative values (overdue cards) SHALL be clamped to 1 day.

#### Scenario: Overdue card interval clamped
- **WHEN** `Next Review` is in the past relative to import date
- **THEN** the derived interval SHALL be set to 1.0 day, not a negative value

### Requirement: Import preview before commit
The system SHALL display a summary of records to be imported (count by status, count of errors/skipped rows) before the user confirms the import.

#### Scenario: User sees preview before confirming
- **WHEN** CSV parsing completes
- **THEN** the UI SHALL show total rows, breakdown by status, and any rows with parse errors

#### Scenario: User cancels import at preview
- **WHEN** user clicks Cancel at the preview step
- **THEN** no database writes SHALL occur

### Requirement: Duplicate detection
The system SHALL detect duplicate words by `simplified` field. On duplicate: skip the row and report it in the import summary.

#### Scenario: Duplicate simplified character skipped
- **WHEN** a CSV row's `simplified` value already exists in the database
- **THEN** that row SHALL be skipped and counted in the "skipped duplicates" summary tally

### Requirement: Chunked Firestore import with per-batch atomicity
The import SHALL write parsed rows to Firestore in sequential batches of at most 500 documents. Each batch SHALL be committed as a single Firestore `writeBatch`, so a batch is applied in full or not at all. There SHALL NOT be any transaction spanning more than one batch: if a later batch fails, the documents written by earlier batches SHALL remain committed, and the system SHALL NOT attempt to roll them back.

The import SHALL NOT write to the bundled SQLite word database. `words.db` is fetched over HTTP and opened read-only in memory by sql.js; it is identical for every user and is never mutated by the application.

#### Scenario: Import smaller than one batch commits atomically
- **WHEN** a CSV of 200 rows is confirmed
- **THEN** all 200 documents SHALL be written in a single batch commit
- **AND** if that commit fails, no document from the import SHALL be written

#### Scenario: Import larger than one batch is split into independent commits
- **WHEN** a CSV of 1000 rows is confirmed
- **THEN** the system SHALL commit 2 batches of 500 documents in sequence
- **AND** each commit SHALL be an independent Firestore transaction

#### Scenario: Later batch failure leaves earlier batches committed
- **WHEN** a 1000-row import commits its first batch of 500 and the second batch commit is rejected
- **THEN** the first 500 documents SHALL remain in Firestore
- **AND** the error SHALL be surfaced to the user
- **AND** the system SHALL NOT delete or revert the already-written documents

#### Scenario: No SQLite writes occur during import
- **WHEN** any import runs, including one containing words absent from the dictionary
- **THEN** `words.db` SHALL NOT be modified
- **AND** words not found in the dictionary SHALL be stored in Firestore with an embedded `customWordData` field instead

### Requirement: Import is idempotent and safe to re-run
Every imported row SHALL be written with the word's `simplified` value as the Firestore document id at `users/{uid}/words/{simplified}`, using a merging write rather than a replacing write. Re-importing the same CSV SHALL therefore address the same documents and converge on the same state rather than creating duplicates. Because the write merges, fields already present on a document that are not supplied by the import SHALL be preserved.

#### Scenario: Re-running a completed import changes nothing
- **WHEN** the user imports the same CSV a second time
- **THEN** each row SHALL resolve to the document it wrote previously
- **AND** no duplicate documents SHALL be created
- **AND** the resulting document values SHALL be identical to those after the first import

#### Scenario: Re-running repairs a partially failed import
- **WHEN** a multi-batch import failed partway through and the user re-imports the same file
- **THEN** the already-written documents SHALL be re-merged with the same values
- **AND** the rows that were never written SHALL now be written
- **AND** the import SHALL complete without manual cleanup

#### Scenario: Merging write preserves unrelated fields
- **WHEN** a word already carries a `notes` field and is written again by an import that does not supply notes
- **THEN** the existing `notes` value SHALL be preserved

### Requirement: Batch progress reported to the user
The import SHALL report progress to the UI after each committed batch, identifying the batch just completed and the total number of batches. The UI SHALL display this progress while the import runs and SHALL clear it when the import finishes or fails.

#### Scenario: Progress message shown per committed batch
- **WHEN** a 1000-row import commits its first batch
- **THEN** the UI SHALL display "Writing batch 1 of 2…"
- **AND** after the second commit it SHALL display "Writing batch 2 of 2…"

#### Scenario: Progress cleared when the import settles
- **WHEN** the import completes successfully or fails with an error
- **THEN** the progress message SHALL be cleared
- **AND** either the import summary or the error message SHALL be shown in its place

