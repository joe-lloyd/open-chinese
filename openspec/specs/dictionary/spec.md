# dictionary Specification

## Purpose
TBD - created by archiving change open-chinese. Update Purpose after archive.
## Requirements
### Requirement: Inline dictionary search
The system SHALL provide a search input that queries the local word database by simplified character, traditional character, pinyin, or English definition. Results SHALL appear as a list below the search input.

#### Scenario: Search by simplified character
- **WHEN** user types `朋友` in the search input
- **THEN** matching word entries SHALL appear in the results list immediately

#### Scenario: Search by English definition
- **WHEN** user types `friend` in the search input
- **THEN** words whose definition contains `friend` SHALL appear in the results

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

