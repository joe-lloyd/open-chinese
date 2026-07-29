## MODIFIED Requirements

### Requirement: Build-time enrichment from the HSK word data
A build script SHALL transform authored reader sources into runtime assets, resolving every bare word token against the same HSK word data that produces `words.db` and attaching that word's pinyin and definition to the token. Punctuation tokens SHALL be marked as non-vocabulary and SHALL NOT carry pinyin or a definition. Optional authored cover metadata SHALL be validated and copied into the per-reader asset and manifest.

Declared cover metadata SHALL contain an extensionless static asset base path, a non-empty artwork description, a focal position expressed as two percentages, and a six-digit hexadecimal accent color. The build SHALL verify that required 480px and 960px WebP files exist and have the expected portrait dimensions.

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
- **AND** the manifest SHALL include each reader's id, title, English title, HSK level, chapter count, and validated optional cover metadata

#### Scenario: Declared cover asset is missing
- **WHEN** a reader declares cover metadata but a required WebP variant is absent
- **THEN** the build SHALL fail and report the reader id and missing path

#### Scenario: Cover metadata is malformed
- **WHEN** focal position, accent, alt description, or image base path fails its validation
- **THEN** the build SHALL fail and identify the reader and invalid field

#### Scenario: Reader intentionally has no cover
- **WHEN** a reader omits optional cover metadata
- **THEN** its content SHALL still build successfully
- **AND** its runtime manifest entry SHALL permit the UI fallback
