## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Atomic transactional import
**Reason**: The requirement is false in every particular. It mandates "all database writes in a single SQLite transaction" with a full rollback on partial failure, but there is no writable SQLite database: the bundled `words.db` is fetched as a static asset and opened read-only in memory by sql.js, and the server that once owned a writable SQLite file was deleted in commit `8850661`. Imports write to Firestore, where the maximum batch size is 500 documents, so an import larger than 500 rows is necessarily more than one transaction and cannot be rolled back as a unit.

**Migration**: Replaced by `Chunked Firestore import with per-batch atomicity`, which states the real guarantee (atomic per batch of at most 500, no cross-batch rollback), and by `Import is idempotent and safe to re-run`, which supplies the compensating property: because every write is a merging write addressed by `simplified` as the document id, re-importing the same file repairs a partially failed import. No rollback mechanism is provided or needed.
