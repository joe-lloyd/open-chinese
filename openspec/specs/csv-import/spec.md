# csv-import Specification

## Purpose
TBD - created by archiving change open-chinese. Update Purpose after archive.
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

### Requirement: Atomic transactional import
The system SHALL execute all database writes in a single SQLite transaction. If any row fails validation after the preview confirmation, the entire import SHALL be rolled back.

#### Scenario: Partial failure rolls back
- **WHEN** 999 of 1000 rows succeed but one row causes a constraint violation
- **THEN** all 1000 rows SHALL be rolled back and no partial import SHALL be committed

### Requirement: Duplicate detection
The system SHALL detect duplicate words by `simplified` field. On duplicate: skip the row and report it in the import summary.

#### Scenario: Duplicate simplified character skipped
- **WHEN** a CSV row's `simplified` value already exists in the database
- **THEN** that row SHALL be skipped and counted in the "skipped duplicates" summary tally

