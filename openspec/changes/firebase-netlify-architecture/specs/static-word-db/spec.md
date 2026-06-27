## ADDED Requirements

### Requirement: HSK vocabulary served as static SQLite file
The system SHALL serve a SQLite database file (`words.db`) from Netlify CDN at `/words.db`. The file SHALL be generated at build time from `server/src/data/hsk.json` and committed to `client/public/words.db`.

#### Scenario: words.db fetched on first app load
- **WHEN** the app initializes for the first time
- **THEN** the system SHALL fetch `/words.db` from the CDN and load it into a sql.js in-memory database
- **AND** subsequent queries SHALL execute against the in-memory database without network requests

### Requirement: words.db schema
The SQLite file SHALL contain a `words` table with columns: `id` (TEXT PRIMARY KEY), `simplified` (TEXT UNIQUE), `traditional` (TEXT), `pinyin` (TEXT), `definition` (TEXT), `hsk_level` (INTEGER), `deck_name` (TEXT), `notes` (TEXT).

#### Scenario: Word queried by simplified returns full record
- **WHEN** code queries `SELECT * FROM words WHERE simplified = '爱'`
- **THEN** the result SHALL include all columns for that word

### Requirement: Client-side WordDB module exposes query API
The system SHALL provide a `WordDB` module at `client/src/lib/worddb.ts` with methods: `loadDB()` (fetch and initialize), `getWord(simplified)`, `getWordsByLevel(hskLevel)`, `getAllWords()`, `searchWords(query)`.

#### Scenario: loadDB called once; subsequent calls return cached instance
- **WHEN** `loadDB()` is called multiple times
- **THEN** the SQLite file SHALL be fetched only once
- **AND** all calls SHALL resolve with the same in-memory database instance

#### Scenario: getWord returns null for unknown simplified
- **WHEN** `getWord('unknown')` is called
- **THEN** the result SHALL be `null`

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
