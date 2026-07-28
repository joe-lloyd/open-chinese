## MODIFIED Requirements

### Requirement: Inline dictionary search
The system SHALL provide a search input that queries the local word database by simplified character, traditional character, pinyin, or English definition. Search SHALL be a secondary mode of the Dictionary tab, reached from the personal dictionary; it SHALL NOT be the landing view. Results SHALL appear as a list below the search input.

Pinyin matching SHALL be insensitive to tone marks, tone digits, capitalisation, and syllable separators. A query and a stored pinyin value SHALL be compared after normalisation, which removes combining diacritics, lowercases, maps `v` to `u`, and strips tone digits `1`–`5` along with spaces, apostrophes, hyphens and middle dots.

Results SHALL be ranked with exact character matches first, then character prefixes, then exact normalised pinyin, then pinyin prefixes, then definition prefixes, then remaining substring matches; ties SHALL be broken by HSK level ascending. Results SHALL be capped at 50.

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
- **WHEN** user types `peng2you5`
- **THEN** `朋友` SHALL appear in the results

#### Scenario: Exact match ranked first
- **WHEN** user types a query that exactly matches one word's simplified form and appears inside several other words' definitions
- **THEN** the exact match SHALL be the first result

#### Scenario: Result annotated with personal status
- **GIVEN** the user has `朋友` at `status: Strong`
- **WHEN** `朋友` appears in search results
- **THEN** the result SHALL show that it is in the personal dictionary at status `Strong`

#### Scenario: Result not yet in the personal dictionary
- **GIVEN** a result the user has never encountered
- **WHEN** it appears in search results
- **THEN** it SHALL be shown as not yet in the personal dictionary
