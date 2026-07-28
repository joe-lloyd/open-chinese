# static-word-db Specification

## Purpose
Serves the read-only HSK vocabulary corpus as a static SQLite file on the CDN, queried in-browser via sql.js. Identical content for every user, no server, no per-user writes — the counterpart to the per-user state in `firestore-user-data`.
## Requirements
### Requirement: HSK vocabulary served as static SQLite file
The system SHALL serve a SQLite database file (`words.db`) from Netlify CDN at `/words.db`. The file SHALL be generated at build time by running `pnpm build:words-db` (executes `scripts/build-words-db.ts` against `scripts/hsk.json`) and output to `client/public/words.db`. The file is NOT committed to the repository (covered by `*.db` in `.gitignore`) and MUST be regenerated before each Netlify deploy.

#### Scenario: words.db fetched on first app load
- **WHEN** the app initializes for the first time
- **THEN** the system SHALL fetch `/words.db` from the CDN and load it into a sql.js in-memory database
- **AND** subsequent queries SHALL execute against the in-memory database without network requests

### Requirement: words.db schema
The SQLite file SHALL contain a `words` table with columns: `id` (TEXT PRIMARY KEY), `simplified` (TEXT UNIQUE), `traditional` (TEXT), `pinyin` (TEXT), `pinyin_normalized` (TEXT), `definition` (TEXT), `hsk_level` (INTEGER), `deck_name` (TEXT), `notes` (TEXT).

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

### Requirement: words.db cached in browser after first fetch
The system SHALL use `Cache-Control` headers (set via Netlify `_headers` config) to cache `words.db` for 1 year with versioning via filename (e.g., `words-v1.db`). A build-time script SHALL update the filename reference when HSK data changes.

#### Scenario: Repeat page loads do not re-fetch words.db
- **WHEN** a user who has previously loaded the app returns
- **THEN** `words.db` SHALL be served from browser cache, not the network

### Requirement: sql.js WASM loaded lazily
The sql.js WebAssembly module (~700KB) SHALL be loaded only when the WordDB is first initialized. It SHALL NOT block initial app render.

#### Scenario: App renders before sql.js is loaded
- **WHEN** the app first renders the login or dashboard page
- **THEN** the sql.js WASM module SHALL NOT have been fetched yet
- **AND** the app SHALL be fully interactive on pages that do not require word data
