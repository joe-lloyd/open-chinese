## MODIFIED Requirements

### Requirement: words.db schema
The SQLite file SHALL contain a `words` table with columns: `id` (TEXT PRIMARY KEY), `simplified` (TEXT UNIQUE), `traditional` (TEXT), `pinyin` (TEXT), `definition` (TEXT), `pinyin_normalized` (TEXT), `hsk_level` (INTEGER), `deck_name` (TEXT), `notes` (TEXT).

`pinyin_normalized` SHALL be derived at build time from `pinyin` by the same normalisation the client applies to a search query: NFD decomposition with combining marks removed, lowercased, `v` mapped to `u`, and tone digits `0`–`5`, spaces, apostrophes, hyphens and middle dots stripped. The column SHALL be indexed.

#### Scenario: Word queried by simplified returns full record
- **WHEN** code queries `SELECT * FROM words WHERE simplified = '爱'`
- **THEN** the result SHALL include all columns for that word

#### Scenario: Normalized pinyin stored without tones or separators
- **GIVEN** a word whose `pinyin` is `péng you`
- **WHEN** the database is built
- **THEN** its `pinyin_normalized` SHALL be `pengyou`

### Requirement: Client-side WordDB module exposes query API
The system SHALL provide a `WordDB` module at `client/src/lib/worddb.ts` with methods: `loadDB()` (fetch and initialize), `getWord(simplified)`, `getWords(simplifieds)`, `getWordsByLevel(hskLevel)`, `getAllWords()`, `searchWords(query)`.

`getWords(simplifieds)` SHALL return the records for a list of simplified forms in a bounded number of queries, so that a caller holding many words does not need to load the entire corpus.

The module SHALL also export `normalizePinyin(value)`, the single normalisation implementation shared by the build script and by `searchWords`.

`searchWords` SHALL query `pinyin_normalized` when that column is present. When it is absent — an out-of-date `words.db` — `searchWords` SHALL fall back to matching the tone-marked `pinyin` column rather than failing.

#### Scenario: loadDB called once; subsequent calls return cached instance
- **WHEN** `loadDB()` is called multiple times
- **THEN** the SQLite file SHALL be fetched only once
- **AND** all calls SHALL resolve with the same in-memory database instance

#### Scenario: getWord returns null for unknown simplified
- **WHEN** `getWord('unknown')` is called
- **THEN** the result SHALL be `null`

#### Scenario: getWords returns only known words
- **WHEN** `getWords(['爱', '朋友', 'notaword'])` is called
- **THEN** the result SHALL contain the records for `爱` and `朋友` only

#### Scenario: getWords handles a list larger than the SQL parameter limit
- **WHEN** `getWords` is called with several thousand simplified forms
- **THEN** the query SHALL be chunked and the combined result returned

#### Scenario: Search degrades gracefully against an old words.db
- **GIVEN** a `words.db` built before `pinyin_normalized` existed
- **WHEN** `searchWords` is called
- **THEN** it SHALL match against `pinyin` instead of failing
