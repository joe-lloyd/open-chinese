# queue-manager Specification

## Purpose
TBD - created by archiving change open-chinese. Update Purpose after archive.
## Requirements
### Requirement: Deck list view
The system SHALL display all word lists (imported from `List Name` CSV column or created manually) as a sortable list of decks, each showing word count and due count.

#### Scenario: Deck list shows all imported lists
- **WHEN** user navigates to the queue manager
- **THEN** all distinct `List Name` values from imported words SHALL appear as deck entries

### Requirement: Drag-and-drop deck priority ordering
The system SHALL allow users to reorder decks by drag-and-drop. The priority order SHALL determine which deck's cards are presented first in a mixed review session.

#### Scenario: Dragged deck updates priority
- **WHEN** user drags a deck from position 3 to position 1
- **THEN** the deck's priority rank SHALL update and future sessions SHALL draw from it first

### Requirement: Targeted study modes
The system SHALL support targeted study modes selectable per deck:
- **Refresh Weak**: only cards with status `Weak`
- **Cram**: all cards regardless of `nextReviewDate`
- **Hard-Only**: only cards where last response was `Again` or `Hard`

#### Scenario: Refresh Weak mode filters to weak cards
- **WHEN** user selects Refresh Weak on a deck and starts a session
- **THEN** only cards with `status = Weak` from that deck SHALL appear in the queue

#### Scenario: Cram mode ignores due dates
- **WHEN** user selects Cram mode and starts a session
- **THEN** all cards in the deck SHALL be included regardless of their `nextReviewDate`

### Requirement: Mark words as Assumed Known
The system SHALL allow users to select words in a deck and mark them as `Mastered` (skipping the normal review progression). This is intended for vocabulary the user already knows before starting the app.

#### Scenario: Bulk mark as assumed known
- **WHEN** user selects multiple words and clicks "Mark as Known"
- **THEN** all selected words SHALL have their status set to `Mastered` with all intervals set to 365 days

### Requirement: New cards per day limit
The system SHALL enforce a configurable daily limit on new (Unstudied) cards introduced per deck. Default: 20 new cards per day per deck.

#### Scenario: New card limit respected
- **WHEN** user has already seen 20 new cards from a deck today and starts another session
- **THEN** no additional Unstudied cards from that deck SHALL appear in the session queue

