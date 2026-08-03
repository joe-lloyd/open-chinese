## MODIFIED Requirements

### Requirement: Readers section with overall completion
The system SHALL provide a dedicated Readers section, reachable from the primary navigation on both desktop and mobile, that lists every available graded reader. The section SHALL display the user's overall completion as the number of finished chapters against the total number of chapters across all readers. Each reader entry SHALL present responsive cover art when declared or the deterministic cover fallback otherwise, while retaining semantic title, level, chapter, and progress information.

#### Scenario: Readers section reachable from navigation
- **WHEN** user opens the app
- **THEN** a "Readers" entry SHALL be present in the desktop sidebar and in the mobile bottom navigation
- **AND** activating it SHALL navigate to `/readers`

#### Scenario: Reader list shows every reader with its level
- **WHEN** user opens `/readers`
- **THEN** every reader in the content manifest SHALL be listed
- **AND** each entry SHALL show the reader's title, its English title, its target HSK level, and its chapter count as semantic text

#### Scenario: Reader has declared cover
- **WHEN** its entry renders
- **THEN** responsive story artwork SHALL be displayed with the declared focal crop
- **AND** all title and level text SHALL remain HTML rather than pixels in the image

#### Scenario: Reader has no declared cover
- **WHEN** its entry renders
- **THEN** a deterministic HSK/id-based fallback SHALL occupy the cover area
- **AND** the card's information and navigation SHALL remain complete

#### Scenario: Overall completion displayed
- **GIVEN** the user has finished 3 chapters out of 5 across all readers
- **WHEN** user opens `/readers`
- **THEN** the section SHALL display `3 / 5` chapters finished

#### Scenario: Per-reader completion displayed
- **GIVEN** the user has finished 2 of the 3 chapters in a reader
- **WHEN** user opens `/readers`
- **THEN** that reader's entry SHALL show `2 / 3` and a progress bar at 67%
