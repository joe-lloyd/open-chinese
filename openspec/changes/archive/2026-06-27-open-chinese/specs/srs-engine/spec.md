## ADDED Requirements

### Requirement: Multi-dimensional interval tracking
Each word SHALL have three independent float intervals: `intervalMeaning`, `intervalPinyin`, and `intervalAudio`. Intervals are stored in days and default to 0.0 for unstudied words.

#### Scenario: New word has zero intervals
- **WHEN** a word is first added to the database
- **THEN** all three intervals SHALL be 0.0 and `easeFactor` SHALL be 2.5

### Requirement: Binary per-subskill grading from two-phase reveal
The study session reviews pronunciation and meaning as two discrete binary judgements per card. The SRS engine SHALL accept `knewPronunciation: boolean` and `knewMeaning: boolean` instead of a single Again/Hard/Good/Easy response.

#### Scenario: Both known — Good applied to both intervals
- **WHEN** `knewPronunciation: true` AND `knewMeaning: true`
- **THEN** `intervalPinyin` SHALL be updated with Good multiplier (current × 2.5 × easeFactor)
- **AND** `intervalMeaning` SHALL be updated with Good multiplier
- **AND** `consecutiveFails` SHALL be reset to 0

#### Scenario: Pronunciation unknown — Again applied to pinyin interval only
- **WHEN** `knewPronunciation: false`
- **THEN** `intervalPinyin` SHALL be reset to 1.0 day
- **AND** `intervalMeaning` unaffected if `knewMeaning: true`

#### Scenario: Meaning unknown — Again applied to meaning interval only
- **WHEN** `knewMeaning: false`
- **THEN** `intervalMeaning` SHALL be reset to 1.0 day
- **AND** `intervalPinyin` unaffected if `knewPronunciation: true`

#### Scenario: Neither known — consecutiveFails incremented
- **WHEN** `knewPronunciation: false` AND `knewMeaning: false`
- **THEN** `consecutiveFails` SHALL increment by 1 and leech check SHALL run

#### Scenario: Either known — consecutiveFails reset
- **WHEN** `knewPronunciation: true` OR `knewMeaning: true`
- **THEN** `consecutiveFails` SHALL be reset to 0

### Requirement: Ease factor SHALL be adjusted based on combined result
The system SHALL decrement `easeFactor` by 0.15 (floor 1.3) when neither sub-skill was known. When either or both sub-skills were known, `easeFactor` SHALL remain unchanged.

#### Scenario: Neither known decrements ease factor
- **WHEN** `knewPronunciation: false` AND `knewMeaning: false`
- **THEN** `easeFactor` SHALL decrease by 0.15, clamped to minimum 1.3

#### Scenario: At least one known leaves ease factor unchanged
- **WHEN** `knewPronunciation: true` OR `knewMeaning: true`
- **THEN** `easeFactor` SHALL remain at its current value

### Requirement: intervalAudio not assessed in two-phase flow
`intervalAudio` SHALL remain unchanged during standard two-phase review. It exists for future whisper-based audio assessment only.

#### Scenario: Audio interval unchanged after review
- **WHEN** a binary review is submitted with `knewPronunciation` and `knewMeaning`
- **THEN** `intervalAudio` SHALL remain at its prior value and SHALL NOT affect word status or mastery

### Requirement: Word status SHALL be derived from minimum of meaning and pinyin intervals
A word's lifecycle state SHALL reflect the weakest of its assessed intervals. `intervalAudio` SHALL be excluded from status calculation.

#### Scenario: Status uses minimum of meaning and pinyin
- **WHEN** `deriveStatus` is called
- **THEN** it SHALL use `Math.min(intervalMeaning, intervalPinyin)` to determine the threshold bucket:
  - min = 0: Unstudied
  - min > 0 and ≤ 7: Weak
  - min > 7 and ≤ 21: Strong
  - min > 21 and ≤ 180: Memorized
  - min > 180: Mastered

### Requirement: Mastery SHALL require both meaning and pinyin to exceed 180 days
`checkMastery` SHALL return true only if `intervalMeaning > 180` AND `intervalPinyin > 180`. `intervalAudio` SHALL NOT block mastery promotion.

#### Scenario: Word mastered when both assessed intervals exceed threshold
- **WHEN** `intervalMeaning` and `intervalPinyin` both exceed 180 days after a review
- **THEN** `checkMastery` SHALL return true and word status SHALL be set to `Mastered`

#### Scenario: Audio interval does not block mastery
- **WHEN** `intervalMeaning > 180` AND `intervalPinyin > 180` but `intervalAudio = 0`
- **THEN** `checkMastery` SHALL still return true

### Requirement: Interval calculation SHALL map binary result to Good or Again
The system SHALL apply Good multiplier for a known sub-skill and reset to 1 day for an unknown sub-skill.

- Known (true) maps to Good: `I_new = max(1, effectiveCurrent × 2.5 × easeFactor)` where `effectiveCurrent = max(1, current)`
- Unknown (false) maps to Again: `I_new = 1.0 day`

#### Scenario: Good response on previously zero interval
- **WHEN** interval is 0.0 and user knew the sub-skill
- **THEN** interval SHALL be treated as 1.0 before multiplying → `1.0 × 2.5 × 2.5 = 6.25 days`

### Requirement: Leech detection
The system SHALL increment `consecutiveFails` when BOTH sub-skills fail. If `consecutiveFails` exceeds 8, the word SHALL be tagged as a Leech.

#### Scenario: Word tagged as leech after 9 consecutive full-fail reviews
- **WHEN** a word receives `knewPronunciation: false` AND `knewMeaning: false` 9 consecutive times
- **THEN** the word's `status` SHALL be set to `Leech`

### Requirement: ReviewHistory captures per-step knowledge state
Each completed card review SHALL create a `ReviewHistory` row with `knewPronunciation` and `knewMeaning` boolean fields.

#### Scenario: Per-step booleans stored on ReviewHistory
- **WHEN** `POST /api/session/review` is called with `{ wordId, knewPronunciation, knewMeaning }`
- **THEN** a `ReviewHistory` row SHALL be created with those fields populated
- **AND** `subskill` SHALL be set to `"combined"`
- **AND** `response` SHALL be: `"Good"` if both known, `"Again"` if neither, `"Hard"` if mixed

### Requirement: nextReviewDate SHALL be set to the earliest due sub-skill
After a binary review, the system SHALL set `nextReviewDate` to `now + min(newIntervalMeaning, newIntervalPinyin)` so the card surfaces when whichever sub-skill is due soonest.

#### Scenario: Asymmetric intervals produce earliest due date
- **WHEN** `newIntervalMeaning = 1` day and `newIntervalPinyin = 6.25` days after review
- **THEN** `nextReviewDate` SHALL be set to `now + 1 day`
