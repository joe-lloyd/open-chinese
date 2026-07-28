## MODIFIED Requirements

### Requirement: words.db schema
The SQLite file SHALL contain a `words` table with columns: `id` (TEXT PRIMARY KEY), `simplified` (TEXT UNIQUE), `traditional` (TEXT), `pinyin` (TEXT), `definition` (TEXT), `hsk_level` (INTEGER), `deck_name` (TEXT), `notes` (TEXT), `sentence_zh` (TEXT), `sentence_en` (TEXT), `sentence_pinyin` (TEXT).

`sentence_pinyin` SHALL hold a tone-marked pinyin reading of `sentence_zh`, and SHALL be `NULL` whenever `sentence_zh` is `NULL`.

#### Scenario: Word queried by simplified returns full record
- **WHEN** code queries `SELECT * FROM words WHERE simplified = '爱'`
- **THEN** the result SHALL include all columns for that word

#### Scenario: Word with an example sentence carries its reading
- **WHEN** a word row has a non-null `sentence_zh`
- **THEN** `sentence_pinyin` SHALL be a non-empty tone-marked reading of that sentence

#### Scenario: Word without an example sentence carries no reading
- **WHEN** a word row has a null `sentence_zh`
- **THEN** `sentence_pinyin` SHALL be null

## ADDED Requirements

### Requirement: Example sentence pinyin generated at build time
The build script SHALL populate `sentence_pinyin` from `sentence_zh` using a segmentation-aware pinyin generator, so that polyphonic characters are read according to their context. If a source record supplies an explicit `sentencePinyin`, that value SHALL be used verbatim in preference to the generated one, so an incorrect generated reading can be corrected at source.

The generator SHALL run only at build time. No pinyin generation library SHALL be included in the client bundle.

#### Scenario: Reading generated from the sentence
- **WHEN** a source record supplies `sentenceZh` but no `sentencePinyin`
- **THEN** the build SHALL generate the reading and store it in `sentence_pinyin`

#### Scenario: Polyphonic characters read in context
- **WHEN** the build generates a reading for a sentence containing a polyphonic character such as 行 in 银行
- **THEN** the stored reading SHALL use the contextually correct syllable (`yín háng`, not `yín xíng`)

#### Scenario: Authored reading overrides generation
- **WHEN** a source record supplies both `sentenceZh` and `sentencePinyin`
- **THEN** the authored value SHALL be stored unchanged
- **AND** no reading SHALL be generated for that record

#### Scenario: Generator is absent from the client bundle
- **WHEN** the client is built
- **THEN** no pinyin generation library SHALL be present in the client's dependency graph
