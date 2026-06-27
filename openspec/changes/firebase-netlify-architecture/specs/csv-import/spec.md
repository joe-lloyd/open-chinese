## MODIFIED Requirements

### Requirement: CSV parsed client-side and written to Firestore
The system SHALL parse the Hack Chinese CSV entirely in the browser using Papa Parse. Parsed rows SHALL be written to `users/{uid}/words/{simplified}` in Firestore using batched writes (maximum 500 documents per batch). No server API call is made during import.

#### Scenario: Valid CSV imported directly to Firestore
- **WHEN** user uploads a valid Hack Chinese CSV and confirms the preview
- **THEN** all rows SHALL be written to Firestore in batches
- **AND** words whose `simplified` value exists in the SQLite word dictionary SHALL use the SQLite `id`-mapped document path
- **AND** words not found in SQLite SHALL embed `customWordData` in the Firestore document

#### Scenario: Large CSV chunked into batches of 500
- **WHEN** user imports a CSV with more than 500 rows
- **THEN** the system SHALL write in sequential batches of up to 500 documents each
- **AND** the UI SHALL show progress (e.g., "Writing batch 1 of 3…")

### Requirement: Custom words not in SQLite stored with embedded content
Words in the imported CSV that do not match any `simplified` value in the SQLite dictionary SHALL be stored in Firestore with a `customWordData` field containing: `{ simplified, traditional, pinyin, definition }`.

#### Scenario: Imported word not in SQLite dictionary
- **WHEN** a CSV row's `Simplified` value is not found in the `words` SQLite table
- **THEN** the Firestore document SHALL include `customWordData` with the CSV row's word fields
- **AND** the document SHALL still include all SRS state fields

## REMOVED Requirements

### Requirement: Import via server POST /api/import
**Reason**: Server removed from production deployment.
**Migration**: All import logic moves to client-side. The `POST /api/import` route is removed. Firestore batch writes replace direct SQLite inserts.
