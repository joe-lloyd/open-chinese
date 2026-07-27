# queue-manager Specification

## Purpose
TBD - created by archiving change open-chinese. Update Purpose after archive.
## Requirements
### Requirement: Deck list view
The system SHALL display every word list imported from the `List Name` CSV column as a sortable deck entry, each showing the deck's word count and due count. Decks SHALL be rendered in the user's saved priority order from `users/{uid}.deckPriority`; decks with no saved rank SHALL be listed after all ranked decks.

#### Scenario: Deck list shows all imported lists
- **WHEN** user navigates to the queue manager
- **THEN** all distinct `List Name` values from imported words SHALL appear as deck entries
- **AND** each entry SHALL show that deck's word count and due count

#### Scenario: Deck list opens in saved priority order
- **WHEN** user opens the queue manager having previously reordered decks
- **THEN** decks SHALL render in the order recorded in `users/{uid}.deckPriority`
- **AND** any deck absent from that map SHALL render after every ranked deck

#### Scenario: No decks imported yet
- **WHEN** user has imported no words
- **THEN** the queue manager SHALL show an empty state prompting the user to import a CSV

### Requirement: Drag-and-drop deck priority ordering
The system SHALL allow users to reorder decks by drag-and-drop and SHALL persist the resulting order to `users/{uid}.deckPriority` as a rank map of `{ deckName: index }`, index `0` being highest priority.

The priority order SHALL determine which deck's cards are presented first in a mixed review session. The session queue builder SHALL sort due cards by deck rank ascending as the primary key and by `nextReviewDate` ascending as the tiebreaker. Cards belonging to a deck with no saved rank SHALL sort after all cards from ranked decks. Priority SHALL act as an ordering only, never as a filter: lower-priority decks are reached once higher-priority cards are exhausted or the session card cap is not yet met.

#### Scenario: Dragged deck updates priority
- **WHEN** user drags a deck from position 3 to position 1
- **THEN** the deck's rank SHALL be written to `deckPriority` as `0`
- **AND** the ranks of the decks it displaced SHALL be rewritten to match the new visual order

#### Scenario: Mixed session draws from the highest-priority deck first
- **WHEN** user starts a session with no deck scope and cards are due in decks ranked `0` and `1`
- **THEN** all due cards from the rank `0` deck SHALL be queued ahead of any due card from the rank `1` deck
- **AND** within each deck, cards SHALL be ordered by `nextReviewDate` ascending

#### Scenario: Deck with no saved rank sorts last
- **WHEN** a session includes due cards from a deck absent from `deckPriority`
- **THEN** those cards SHALL appear after due cards from every ranked deck

#### Scenario: Session cap truncates from the lowest priority
- **WHEN** the number of due cards exceeds the session card cap
- **THEN** the cards dropped SHALL be those from the lowest-priority decks
- **AND** the highest-priority deck's due backlog SHALL be presented first

### Requirement: Targeted study modes
The system SHALL support targeted study modes selectable per deck. Each deck entry SHALL expose a mode selector and a "Start session" control.

The selected mode SHALL be persisted to `users/{uid}.deckModes` as `{ deckName: mode }` and SHALL be restored into the selector when the queue manager is reloaded. A deck with no saved mode SHALL default to Standard.

Activating "Start session" SHALL navigate to `/study?deck=<deckName>&mode=<mode>`. The study page SHALL read the `deck` and `mode` search params and pass them to the session queue builder, which SHALL restrict every source of cards — both the user's reviewed words and the unstudied word pool — to the named deck. An unrecognised `mode` value SHALL fall back to Standard; an absent `deck` param SHALL build an unscoped session across all decks.

The supported modes are:
- **Standard** (`due`): cards in the deck whose `nextReviewDate` is at or before now, plus unstudied cards from the deck up to the remaining global daily new-card allowance
- **Refresh Weak** (`refreshWeak`): only cards with status `Weak`, regardless of `nextReviewDate`; no new cards are introduced
- **Cram** (`cram`): all cards in the deck regardless of `nextReviewDate` and regardless of status, including `Unstudied`, ordered hardest first by `easeFactor` ascending
- **Hard-Only** (`hardOnly`): only cards with `consecutiveFails > 0` — cards the user missed on both pinyin and meaning at their most recent review; no new cards are introduced

`consecutiveFails` is reset to `0` whenever the user answers either subskill correctly and incremented only when both are missed, so a non-zero value identifies exactly those cards whose latest review was a full miss and has not since been recovered. Standard SHALL be the only mode bound by the daily new-card allowance.

#### Scenario: Mode selection persists across reloads
- **WHEN** user selects Cram on a deck and later reloads the queue manager
- **THEN** the mode SHALL have been written to `users/{uid}.deckModes` for that deck
- **AND** the deck's selector SHALL show Cram

#### Scenario: Start session launches the deck in the selected mode
- **WHEN** user selects Refresh Weak on the deck "HSK 3" and activates "Start session"
- **THEN** the app SHALL navigate to `/study?deck=HSK%203&mode=refreshWeak`
- **AND** the session queue SHALL be built with that deck name and mode

#### Scenario: Refresh Weak mode filters to weak cards
- **WHEN** user selects Refresh Weak on a deck and starts a session
- **THEN** only cards with `status = Weak` from that deck SHALL appear in the queue
- **AND** cards SHALL be included regardless of their `nextReviewDate`
- **AND** no unstudied cards SHALL be introduced

#### Scenario: Cram mode ignores due dates
- **WHEN** user selects Cram mode on a deck and starts a session
- **THEN** all cards in the deck SHALL be included regardless of their `nextReviewDate`
- **AND** cards with status `Unstudied` SHALL be included
- **AND** cards SHALL be ordered by `easeFactor` ascending

#### Scenario: Hard-Only mode selects recently failed cards
- **WHEN** user selects Hard-Only on a deck and starts a session
- **THEN** only cards from that deck with `consecutiveFails > 0` SHALL appear in the queue
- **AND** cards with status `Unstudied` SHALL be excluded
- **AND** cards SHALL be included regardless of their `nextReviewDate`

#### Scenario: A recovered card leaves the Hard-Only queue
- **WHEN** a card previously missed on both subskills is reviewed and the user answers either pinyin or meaning correctly
- **THEN** its `consecutiveFails` SHALL be `0`
- **AND** it SHALL NOT appear in a subsequent Hard-Only session

#### Scenario: Standard mode respects the daily new-card allowance
- **WHEN** user starts a Standard session on a deck
- **THEN** due cards from that deck SHALL be queued
- **AND** unstudied cards from that deck SHALL be added only up to the remaining global daily new-card allowance

#### Scenario: Unrecognised mode falls back to Standard
- **WHEN** user opens `/study?deck=HSK%201&mode=nonsense`
- **THEN** the session SHALL be built in Standard mode scoped to that deck

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

