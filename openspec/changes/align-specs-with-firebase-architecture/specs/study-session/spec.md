## ADDED Requirements

### Requirement: Review result written directly to Firestore
After the user completes both grading phases for a card, the computed SRS state SHALL be written to `users/{uid}/words/{simplified}` via the Firestore adapter. No server API call is made.

#### Scenario: Card graded and Firestore updated
- **WHEN** user grades both pronunciation and meaning
- **THEN** the client SHALL call `applyBinaryReview` and write the result to Firestore
- **AND** the next card in the queue SHALL be presented immediately (optimistic update; no await block on UI)

#### Scenario: Day's aggregate updated alongside the word document
- **WHEN** a review is written
- **THEN** the system SHALL also update `users/{uid}/dailyStats/{YYYY-MM-DD}` for the current local date
- **AND** neither write SHALL block presentation of the next card

#### Scenario: Failed write surfaces without losing the session
- **WHEN** a Firestore write for a graded card is rejected
- **THEN** the system SHALL display an error banner naming the failure
- **AND** the session SHALL remain usable rather than terminating

## MODIFIED Requirements

### Requirement: Audio replay
The system SHALL play the word's audio when the user presses ↑ or R during any phase of review. Both keys SHALL be bound, and the in-app keyboard help SHALL advertise the binding as `↑ / R`. The on-screen play control SHALL be labelled with the same binding.

#### Scenario: R key triggers audio
- **WHEN** user presses R
- **THEN** the word's TTS audio SHALL play immediately regardless of current phase

#### Scenario: Up arrow triggers audio
- **WHEN** user presses ↑
- **THEN** the word's TTS audio SHALL play immediately regardless of current phase
- **AND** the default scroll behaviour of the arrow key SHALL be suppressed

#### Scenario: Keyboard help lists both keys
- **WHEN** the user opens the keyboard help overlay
- **THEN** the replay entry SHALL read `↑ / R`

## REMOVED Requirements

### Requirement: SRS submission after both phases
**Reason**: The requirement mandates `POST /api/session/review`, an endpoint that no longer exists. The Hono API server was deleted from the repository in commit `8850661` and production is a static SPA on Netlify with no backend of any kind. The client computes the new SRS state locally and writes it to Firestore itself.

**Migration**: Replaced by `Review result written directly to Firestore`. The `{ wordId, knewPronunciation, knewMeaning }` request body has no replacement — `applyBinaryReview` consumes the two booleans in-process and the resulting state is written to `users/{uid}/words/{simplified}`, keyed by `simplified` rather than by a numeric `wordId`. The per-day counters that the server route also maintained are now written client-side to `users/{uid}/dailyStats/{YYYY-MM-DD}`.
