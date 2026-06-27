## MODIFIED Requirements

### Requirement: Vocabulary lifecycle stats read from Firestore
The system SHALL compute vocabulary distribution (Unstudied, Weak, Strong, Memorized, Mastered) from Firestore. Unstudied count SHALL be derived as: total words in SQLite minus count of Firestore documents with `status != Unstudied`. All other status counts SHALL come from Firestore document `status` fields.

#### Scenario: Chart reflects current Firestore distribution
- **WHEN** user visits the dashboard
- **THEN** the system SHALL query `users/{uid}/words` and count documents by `status`
- **AND** Unstudied count SHALL be total SQLite word count minus count of Firestore documents

### Requirement: Activity heatmap data read from daily stats
The system SHALL read `users/{uid}/dailyStats/{date}` documents to populate the activity heatmap. Each document's `totalReviewed` field provides the review count for that day.

#### Scenario: Heatmap cell intensity from dailyStats
- **WHEN** user visits the dashboard
- **THEN** the system SHALL query `users/{uid}/dailyStats` for the last 52 weeks
- **AND** each day's cell intensity SHALL be proportional to `totalReviewed` for that date

### Requirement: Retention rate computed from history documents
The system SHALL compute a rolling 30-day retention rate from `users/{uid}/history` documents. Retention = count of documents where `response == 'Good'` divided by total documents in the window.

#### Scenario: Retention computed from last 30 days of history
- **WHEN** user visits the dashboard
- **THEN** the system SHALL query `users/{uid}/history` where `reviewedAt >= 30 days ago`
- **AND** retention rate SHALL equal `Good` responses / total responses

## REMOVED Requirements

### Requirement: Dashboard data fetched from server API
**Reason**: Server removed from production deployment.
**Migration**: All dashboard queries run directly against Firestore from the client. No `/api/dashboard` or `/api/stats` routes are used.
