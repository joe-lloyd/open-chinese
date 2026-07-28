# dictionary Specification

## Purpose
Provides search and browse over the static HSK word database, showing definitions, character breakdown and HSK level alongside the user's own SRS status and notes for each word.
## Requirements
### Requirement: Inline dictionary search
The system SHALL provide a search input that queries the local word database by simplified character, traditional character, pinyin, or English definition. Search SHALL be a secondary mode of the Dictionary tab, reached from the personal dictionary; it SHALL NOT be the landing view. Results SHALL appear as a list below the search input.

Pinyin matching SHALL be insensitive to tone marks, tone digits, capitalisation, and syllable separators. A query and a stored pinyin value SHALL be compared after normalisation, which removes combining diacritics, lowercases, maps `v` to `u`, and strips tone digits `0`–`5` along with spaces, apostrophes, hyphens and middle dots.

Results SHALL be ranked with exact character matches first, then character prefixes, then exact normalised pinyin, then pinyin prefixes, then definition prefixes, then remaining substring matches; ties SHALL be broken by HSK level ascending. Results SHALL be capped at 50.

Literal `%` and `_` characters in a query SHALL be matched literally rather than treated as wildcards.

Each result SHALL indicate whether the word is already in the user's personal dictionary and, if so, its `status`.

#### Scenario: Search by simplified character
- **WHEN** user types `朋友` in the search input
- **THEN** matching word entries SHALL appear in the results list immediately

#### Scenario: Search by traditional character
- **WHEN** user types a traditional form such as `朋友`
- **THEN** the entry whose `traditional` column matches SHALL appear in the results

#### Scenario: Search by English definition
- **WHEN** user types `friend` in the search input
- **THEN** words whose definition contains `friend` SHALL appear in the results

#### Scenario: Search by toneless pinyin
- **WHEN** user types `pengyou`
- **THEN** `朋友` SHALL appear in the results

#### Scenario: Search by tone-marked pinyin
- **WHEN** user types `péngyou`
- **THEN** `朋友` SHALL appear in the results

#### Scenario: Search by spaced pinyin
- **WHEN** user types `peng you`
- **THEN** `朋友` SHALL appear in the results

#### Scenario: Search by numbered pinyin
- **WHEN** user types `peng2you5` or `peng2you0`
- **THEN** `朋友` SHALL appear in the results

#### Scenario: Exact match ranked first
- **WHEN** user types a query that exactly matches one word's simplified form and appears inside several other words' definitions
- **THEN** the exact match SHALL be the first result

#### Scenario: Wildcard characters treated literally
- **WHEN** user types `%` or `_`
- **THEN** only words actually containing that character SHALL be returned

#### Scenario: Result annotated with personal status
- **GIVEN** the user has `朋友` at `status: Strong`
- **WHEN** `朋友` appears in search results
- **THEN** the result SHALL show that it is in the personal dictionary at status `Strong`

#### Scenario: Result not yet in the personal dictionary
- **GIVEN** a result the user has never encountered
- **WHEN** it appears in search results
- **THEN** it SHALL be shown as not yet in the personal dictionary

### Requirement: Character breakdown display
The system SHALL display a breakdown of each character in a word, showing: the character, its pinyin, its primary English meaning, and its radical with meaning.

#### Scenario: Word entry shows per-character breakdown
- **WHEN** user opens the dictionary entry for `朋友`
- **THEN** the view SHALL show breakdown for `朋` (péng, friend, radical: 月) and `友` (yǒu, friend, radical: 又)

### Requirement: Radical decomposition data
The system SHALL bundle a static radical decomposition dataset (derived from Unihan / CC-CEDICT compatible data) for offline lookup. No external API calls SHALL be required for character decomposition.

#### Scenario: Radical data available offline
- **WHEN** the app has no internet connection
- **THEN** character decomposition SHALL still render correctly from the bundled dataset

### Requirement: User notes on word entries
The system SHALL allow users to attach free-text notes to any word entry. Notes SHALL be stored in the database and displayed in the dictionary view.

#### Scenario: User adds a note to a word
- **WHEN** user types a note and saves it on a word's dictionary entry
- **THEN** the note SHALL persist in the database and be visible on future dictionary views of that word

#### Scenario: Note shown during study session
- **WHEN** a word with a user note is revealed during a study session
- **THEN** the note SHALL be displayed below the definition

### Requirement: HSK level badge
The system SHALL display the word's HSK level (1–9, or unlisted) as a badge on the dictionary entry and in search results.

#### Scenario: HSK level shown on entry
- **WHEN** a word has `hskLevel = 2`
- **THEN** an `HSK 2` badge SHALL be visible on its dictionary entry

