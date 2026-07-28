# personal-dictionary Specification

## Purpose
Makes the user's own vocabulary the primary view of the Dictionary tab: every word they have encountered, drawn from `users/{uid}/words` and joined against the static corpus, with per-word progress signal, filtering, sorting and the controls for marking a word fully known. Also owns the shared write path through which any surface — study, import, graded readers — adds an encountered word to the user's dictionary.

## Requirements
### Requirement: Personal dictionary is the default Dictionary view
The Dictionary tab SHALL open on the user's personal dictionary — every word with a document in `users/{uid}/words` — without requiring a search. Search SHALL be reachable from the same screen as a secondary mode.

#### Scenario: Dictionary opens on the user's words
- **WHEN** user navigates to the Dictionary tab
- **THEN** the view SHALL list the words the user has interacted with, drawn from `users/{uid}/words`
- **AND** no search query SHALL be required to populate the list

#### Scenario: Search reachable as a secondary mode
- **WHEN** user activates the search mode toggle
- **THEN** the search input SHALL be shown in place of the personal list
- **AND** returning to the personal mode SHALL restore the list with its filters intact

#### Scenario: Empty personal dictionary
- **WHEN** the user has no documents in `users/{uid}/words`
- **THEN** the view SHALL show an empty state directing the user to study or import words
- **AND** SHALL NOT show a filter bar or pagination controls

### Requirement: Per-word signal in the personal list
Each row in the personal dictionary SHALL show the simplified form, pinyin, definition, `status`, HSK level, deck name, knowledge percentage and last-reviewed date.

Knowledge percentage SHALL be computed as `correctMeaningCount / totalReviews * 100`, rounded to the nearest integer. A word with `totalReviews` absent or `0` SHALL render a placeholder rather than `0%`.

Pinyin, definition and HSK level SHALL be joined from the static word database by `simplified`. When the word is absent from the static database, the values SHALL fall back to the document's `customWordData` and its stored `hskLevel`.

#### Scenario: Reviewed word shows knowledge percentage
- **GIVEN** a word with `totalReviews: 10` and `correctMeaningCount: 7`
- **WHEN** the personal list renders that word
- **THEN** the row SHALL show `70%`

#### Scenario: Never-reviewed word shows no percentage
- **GIVEN** a word whose document has no `totalReviews` field
- **WHEN** the personal list renders that word
- **THEN** the row SHALL show a placeholder in place of a percentage
- **AND** SHALL NOT show `0%`

#### Scenario: Imported word not in the static database
- **GIVEN** a word present in `users/{uid}/words` but absent from `words.db`
- **WHEN** the personal list renders that word
- **THEN** pinyin and definition SHALL be taken from the document's `customWordData`

### Requirement: Personal list filtering and sorting
The personal dictionary SHALL be filterable by `status`, HSK level and deck name, and sortable by last reviewed, knowledge percentage, HSK level and alphabetical order. Filters SHALL combine conjunctively. The number of words matching the active filters SHALL be displayed.

#### Scenario: Filter by status
- **WHEN** user selects the `Weak` status filter
- **THEN** only words whose `status` is `Weak` SHALL be listed
- **AND** the displayed count SHALL reflect the filtered total

#### Scenario: Filters combine
- **WHEN** user selects status `Weak` and HSK level `2`
- **THEN** only words that are both `Weak` and HSK level 2 SHALL be listed

#### Scenario: Sort by knowledge percentage
- **WHEN** user sorts by knowledge percentage
- **THEN** words SHALL be ordered by knowledge percentage
- **AND** words with no reviews SHALL be ordered after every reviewed word

#### Scenario: Filter matches nothing
- **WHEN** the active filter combination matches no words
- **THEN** the list SHALL show an empty result message and a control to clear the filters

### Requirement: Personal list remains responsive at scale
The personal dictionary SHALL remain usable with several thousand words. The system SHALL NOT render every matching word at once; it SHALL render a bounded page of results with controls to move between pages.

#### Scenario: Large dictionary renders a bounded page
- **GIVEN** the user has 3000 words in `users/{uid}/words`
- **WHEN** the personal dictionary renders
- **THEN** at most one page of rows SHALL be present in the DOM
- **AND** navigation controls SHALL allow reaching the remaining words

#### Scenario: Changing a filter returns to the first page
- **WHEN** user changes a filter or sort while on a later page
- **THEN** the list SHALL return to the first page of the new result set

### Requirement: Mark words as fully known from the personal dictionary
The user SHALL be able to mark a word as `Mastered` from the personal dictionary — from a list row, from the word detail view, and for multiple words at once via multi-select. Marking SHALL set `intervalMeaning`, `intervalPinyin` and `intervalAudio` to 365, `status` to `Mastered`, and `nextReviewDate` to one year in the future.

Marking a word that has no document in `users/{uid}/words` SHALL first create the document with its `deckName` and `hskLevel` so that the word remains addressable by the deck and level filters.

#### Scenario: Mark a single word known from the list
- **WHEN** user activates "Mark as known" on a list row
- **THEN** that word SHALL be written as `Mastered` with all intervals at 365 and `nextReviewDate` one year out
- **AND** the row SHALL reflect the new status without a page reload

#### Scenario: Bulk mark known
- **WHEN** user selects several words and activates "Mark as known"
- **THEN** every selected word SHALL be written as `Mastered` in batched writes
- **AND** the selection SHALL be cleared

#### Scenario: Bulk write exceeding the Firestore batch limit
- **WHEN** the user marks more words known than a single Firestore batch permits
- **THEN** the writes SHALL be split across as many batches as required
- **AND** every selected word SHALL be written

#### Scenario: Mark known from a search result with no existing document
- **GIVEN** a word that has never been studied and has no document in `users/{uid}/words`
- **WHEN** user marks it known
- **THEN** the document SHALL be created carrying `deckName` and `hskLevel`
- **AND** SHALL then be written as `Mastered`

#### Scenario: Mastered word leaves the review queue
- **WHEN** a word has been marked known
- **THEN** it SHALL NOT appear in a subsequent due-review session

### Requirement: Unmark a fully known word
The user SHALL be able to reverse "mark as known" from the personal dictionary, individually or for a multi-select. Unmarking SHALL set `intervalMeaning`, `intervalPinyin` and `intervalAudio` to 1, `consecutiveFails` to 0, `status` to `Weak`, and `nextReviewDate` to the current time, leaving `easeFactor` unchanged.

`consecutiveFails` is cleared so that a word which was a `Leech` before being marked known is not resolved straight back to `Leech` on its next missed review.

#### Scenario: Unmark returns a word to the review queue
- **GIVEN** a word with `status: Mastered`
- **WHEN** user activates "Unmark"
- **THEN** its intervals SHALL be 1, its `consecutiveFails` SHALL be 0, its `status` SHALL be `Weak` and `nextReviewDate` SHALL be now
- **AND** it SHALL appear in the next due-review session

#### Scenario: Unmark unavailable for a word that is not mastered
- **WHEN** a word's status is not `Mastered`
- **THEN** no unmark control SHALL be actionable for that word

#### Scenario: Bulk unmark with no mastered words selected
- **WHEN** the current selection contains no `Mastered` word
- **THEN** the bulk unmark control SHALL be disabled rather than silently doing nothing
- **AND** it SHALL explain why it is unavailable

### Requirement: Word detail view
Selecting a word from the personal list or from search results SHALL open a detail view showing the word, its traditional form when different, pinyin, definition, HSK badge, character breakdown, the user's notes, the user's status, and — when the word has been reviewed — `totalReviews`, knowledge percentage, first seen and last reviewed. The mark-as-known and unmark controls SHALL be available from this view.

#### Scenario: Detail shows review statistics
- **GIVEN** a word with `totalReviews: 12`, `correctMeaningCount: 9` and a `lastReviewedAt` timestamp
- **WHEN** user opens its detail view
- **THEN** the view SHALL show the review count, `75%` knowledge, and the last-reviewed date

#### Scenario: Detail for an unstudied word
- **WHEN** user opens the detail view for a word with no Firestore document
- **THEN** the view SHALL show its dictionary content and a status of `Unstudied`
- **AND** SHALL offer to add it to the personal dictionary

#### Scenario: Notes persist from the detail view
- **WHEN** user edits and saves notes in the detail view
- **THEN** the notes SHALL be written to `users/{uid}/words/{simplified}` and shown on subsequent visits

### Requirement: Shared write path for adding encountered words
The system SHALL expose a single helper that adds words to `users/{uid}/words` at default SRS state without disturbing documents that already exist, so that every surface which causes a word to be "encountered" writes through the same path.

The helper SHALL accept a list of seeds carrying `simplified` and optionally `deckName` and `hskLevel`, SHALL create a document only for seeds with no existing document, SHALL set `firstSeenAt` on creation, and SHALL report which words it created.

#### Scenario: New words created at default state
- **WHEN** the helper is called with words that have no existing documents
- **THEN** each SHALL be created with intervals 0, `easeFactor` 2.5, `status` `Unstudied` and a `firstSeenAt` timestamp

#### Scenario: Existing documents left untouched
- **GIVEN** a word already at `status: Mastered`
- **WHEN** the helper is called with that word among its seeds
- **THEN** the existing document SHALL NOT be modified

#### Scenario: Encountered words appear in the personal dictionary
- **WHEN** words are added through the helper by any surface
- **THEN** they SHALL appear in the personal dictionary with `status` `Unstudied` and no knowledge percentage

#### Scenario: An encountered word is still introducible as a new card
- **GIVEN** a word added through the helper, so it has a document at `status` `Unstudied` with zero intervals
- **WHEN** the user starts a study session that would introduce new cards
- **THEN** that word SHALL remain eligible for the new-card pool
- **AND** the existence of its document alone SHALL NOT exclude it

### Requirement: Failed writes are surfaced
Every write the personal dictionary performs — mark known, unmark, add to dictionary, save notes — SHALL report failure to the user rather than failing silently.

#### Scenario: A rejected write is reported
- **WHEN** a Firestore write from the personal dictionary rejects
- **THEN** an error SHALL be displayed to the user
- **AND** the user SHALL be able to dismiss it
