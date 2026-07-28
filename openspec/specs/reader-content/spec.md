# reader-content Specification

## Purpose
Defines how graded reader prose gets into the app: an authored, pre-segmented token format under `content/readers/`, a build step that enriches it from the same HSK word data that produces `words.db`, and the quality gates that decide whether content is fit to ship. The gates encode the machine-checkable half of "is this a good graded reader?", so the format can be targeted by a human author or a generator without changing what ships.

## Requirements
### Requirement: Reader content is authored as pre-segmented tokens
Reader content SHALL be authored as JSON under `content/readers/<readerId>.json`, with each paragraph expressed as an ordered array of tokens rather than as a single string. A token SHALL be either a bare string (resolved against the bundled HSK word data) or an object supplying `text`, `pinyin` and `definition` inline for words absent from that data. The client SHALL NOT perform word segmentation at runtime.

#### Scenario: Paragraph authored as a token array
- **WHEN** an author writes the sentence `我叫小明。`
- **THEN** the source SHALL express it as the tokens `我`, `叫`, `小明`, `。`

#### Scenario: Out-of-dictionary token carries an inline gloss
- **WHEN** a token such as a proper noun is not present in the HSK word data
- **THEN** the author SHALL supply `text`, `pinyin` and `definition` inline for that token

#### Scenario: Client does not segment
- **WHEN** the client renders a chapter
- **THEN** it SHALL render the token array as authored and SHALL NOT split or join tokens

### Requirement: Build-time enrichment from the HSK word data
A build script SHALL transform authored reader sources into runtime assets, resolving every bare word token against the same HSK word data that produces `words.db` and attaching that word's pinyin and definition to the token. Punctuation tokens SHALL be marked as non-vocabulary and SHALL NOT carry pinyin or a definition.

#### Scenario: Bare token enriched from the word data
- **GIVEN** `朋友` is present in the HSK word data with pinyin `péng you`
- **WHEN** the build script processes a chapter containing the bare token `朋友`
- **THEN** the runtime token SHALL carry that pinyin and the word's definition

#### Scenario: Punctuation classified
- **WHEN** the build script encounters `。`, `，`, `？`, `！` or a similar mark
- **THEN** the emitted token SHALL be marked as punctuation and SHALL carry no pinyin or definition

#### Scenario: Runtime assets emitted per reader
- **WHEN** the build script runs
- **THEN** it SHALL emit one JSON asset per reader plus a manifest listing every reader
- **AND** the manifest SHALL include each reader's id, title, English title, HSK level and chapter count

### Requirement: Content quality gates enforced at build time
The build script SHALL validate every chapter and SHALL fail the build, naming the offending reader, chapter and tokens, when any of the following is violated:
- every word token resolves to a non-empty pinyin and a non-empty definition, whether it was resolved from the HSK word data or supplied as an inline gloss
- no token is empty
- chapter ids are unique within a reader
- each chapter introduces between 10 and 20 words not already introduced by an earlier chapter of the same reader
- each word a chapter introduces appears at least 3 times within that chapter
- every paragraph has a non-empty English translation
- every token that the HSK word data knows is at or below the reader's declared HSK level, including tokens supplied as an inline gloss

#### Scenario: Unresolvable token fails the build
- **WHEN** a chapter contains a bare word token absent from the HSK word data and with no inline gloss
- **THEN** the build SHALL fail and report the reader, chapter and token

#### Scenario: Too many new words fails the build
- **WHEN** a chapter introduces 25 words not seen in earlier chapters of the same reader
- **THEN** the build SHALL fail and report the new-word count

#### Scenario: Insufficient repetition fails the build
- **WHEN** a chapter introduces the word `苹果` but contains only 2 occurrences of it
- **THEN** the build SHALL fail and report that word and its occurrence count

#### Scenario: Missing translation fails the build
- **WHEN** a paragraph has an empty or absent English translation
- **THEN** the build SHALL fail and report the reader, chapter and paragraph index

#### Scenario: Inline gloss with an empty pinyin or definition fails the build
- **WHEN** a chapter contains an inline token whose `pinyin` or `definition` is empty
- **THEN** the build SHALL fail and report the reader, chapter and token

#### Scenario: Above-level vocabulary fails the build
- **GIVEN** a reader declares HSK level 2
- **WHEN** a chapter contains a token resolved from the HSK word data at level 3
- **THEN** the build SHALL fail and report the token and its level

#### Scenario: An inline gloss cannot smuggle above-level vocabulary
- **GIVEN** a reader declares HSK level 1
- **WHEN** a chapter supplies an inline gloss for a word the HSK word data knows at level 3
- **THEN** the build SHALL fail and report the token and its level

#### Scenario: Empty token fails the build
- **WHEN** a chapter contains a token that is an empty or whitespace-only string, or an inline token with empty `text`
- **THEN** the build SHALL fail and report the reader and chapter

#### Scenario: Duplicate chapter id fails the build
- **WHEN** two chapters of the same reader declare the same `id`
- **THEN** the build SHALL fail and report the duplicated id

#### Scenario: Valid content builds cleanly
- **WHEN** every chapter satisfies all gates
- **THEN** the build SHALL emit the runtime assets and exit successfully

### Requirement: Generated reader assets are build artefacts
Runtime reader assets SHALL be generated into the client's static asset directory, SHALL be excluded from version control, and SHALL be produced by the deployment build. The authored sources under `content/readers/` SHALL be the single committed source of truth.

#### Scenario: Generated assets not committed
- **WHEN** the build script runs locally
- **THEN** the emitted assets SHALL be ignored by version control

#### Scenario: Deployment build produces the assets
- **WHEN** the site is built for deployment
- **THEN** the reader build script SHALL run before the client bundle is produced

### Requirement: Content is served statically with no runtime generation
Reader content SHALL be fetched as static assets from the application's own origin. The client SHALL NOT call any external content or language-model service to obtain, translate, gloss or generate reader text.

#### Scenario: No external requests while reading
- **WHEN** user opens and reads a chapter
- **THEN** the only network requests for content SHALL be to the application's own static assets

#### Scenario: Reader available without a network round trip after load
- **WHEN** a reader's asset has been fetched
- **THEN** every chapter of that reader SHALL be readable without a further content request
