# srs-engine Specification

## Purpose
TBD - created by archiving change open-chinese. Update Purpose after archive.
## Requirements
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
A word's lifecycle state SHALL reflect the weakest of its assessed intervals. `intervalAudio` SHALL be excluded from status calculation. `deriveStatus` SHALL remain a pure function of the three intervals; leech state SHALL NOT be inferred from intervals. The status persisted after a review SHALL be produced by `resolveStatus`, which layers leech precedence over `deriveStatus`.

#### Scenario: Status uses minimum of meaning and pinyin
- **WHEN** `deriveStatus` is called
- **THEN** it SHALL use `Math.min(intervalMeaning, intervalPinyin)` to determine the threshold bucket:
  - min = 0: Unstudied
  - min > 0 and ≤ 7: Weak
  - min > 7 and ≤ 21: Strong
  - min > 21 and ≤ 180: Memorized
  - min > 180: Mastered

#### Scenario: deriveStatus never returns Leech
- **WHEN** `deriveStatus` is called with any combination of interval values
- **THEN** the result SHALL be one of `Unstudied`, `Weak`, `Strong`, `Memorized`, or `Mastered`
- **AND** it SHALL NOT be `Leech`

#### Scenario: Persisted status comes from resolveStatus after a review
- **WHEN** a review is applied and the resulting state is written to storage
- **THEN** the written `status` SHALL be the value returned by `resolveStatus` for the post-review intervals and `consecutiveFails`

### Requirement: Mastery SHALL require both meaning and pinyin to exceed 180 days
`checkMastery` SHALL return true only if `intervalMeaning > 180` AND `intervalPinyin > 180`. `intervalAudio` SHALL NOT block mastery promotion. `checkMastery` SHALL be the single definition of the mastery predicate: `deriveStatus` SHALL call it to decide the `Mastered` bucket rather than duplicating the comparison inline.

#### Scenario: Word mastered when both assessed intervals exceed threshold
- **WHEN** `intervalMeaning` and `intervalPinyin` both exceed 180 days after a review
- **THEN** `checkMastery` SHALL return true and word status SHALL be set to `Mastered`

#### Scenario: Audio interval does not block mastery
- **WHEN** `intervalMeaning > 180` AND `intervalPinyin > 180` but `intervalAudio = 0`
- **THEN** `checkMastery` SHALL still return true

#### Scenario: deriveStatus delegates the Mastered decision to checkMastery
- **WHEN** `deriveStatus` evaluates whether a word is `Mastered`
- **THEN** it SHALL call `checkMastery` with the same three intervals
- **AND** it SHALL return `Mastered` if and only if `checkMastery` returns true

### Requirement: Interval calculation SHALL map binary result to Good or Again
The system SHALL apply Good multiplier for a known sub-skill and reset to 1 day for an unknown sub-skill.

- Known (true) maps to Good: `I_new = max(1, effectiveCurrent × 2.5 × easeFactor)` where `effectiveCurrent = max(1, current)`
- Unknown (false) maps to Again: `I_new = 1.0 day`

#### Scenario: Good response on previously zero interval
- **WHEN** interval is 0.0 and user knew the sub-skill
- **THEN** interval SHALL be treated as 1.0 before multiplying → `1.0 × 2.5 × 2.5 = 6.25 days`

### Requirement: Leech detection
The system SHALL increment `consecutiveFails` when BOTH sub-skills fail, and reset it to 0 when either sub-skill is known. When `consecutiveFails` exceeds 8, the word SHALL be tagged as a Leech and that tag SHALL be persisted as `status: 'Leech'` on the word's stored state.

`applyBinaryReview` SHALL return `isLeech` alongside the updated review state so callers can observe the transition. The persisted status SHALL be produced by `resolveStatus(intervalMeaning, intervalPinyin, intervalAudio, consecutiveFails)`, which SHALL return `'Leech'` when `consecutiveFails` exceeds 8 and SHALL otherwise delegate to `deriveStatus`. Leech SHALL take precedence over the interval-derived status bucket.

A word with `status: 'Leech'` SHALL be excluded from the normal due queue regardless of its `nextReviewDate`. Leech status SHALL be cleared automatically when `consecutiveFails` returns to 0.

#### Scenario: Word tagged as leech after 9 consecutive full-fail reviews
- **WHEN** a word receives `knewPronunciation: false` AND `knewMeaning: false` 9 consecutive times
- **THEN** `consecutiveFails` SHALL be 9
- **AND** `applyBinaryReview` SHALL return `isLeech: true`
- **AND** `resolveStatus` SHALL return `'Leech'`
- **AND** the word's persisted `status` SHALL be `'Leech'`

#### Scenario: Eighth consecutive full-fail does not tag a leech
- **WHEN** a word has `consecutiveFails: 7` and receives `knewPronunciation: false` AND `knewMeaning: false`
- **THEN** `consecutiveFails` SHALL be 8
- **AND** `applyBinaryReview` SHALL return `isLeech: false`
- **AND** the persisted `status` SHALL be the interval-derived status, not `'Leech'`

#### Scenario: Leech status overrides the interval-derived bucket
- **WHEN** `resolveStatus` is called with `consecutiveFails: 9` and intervals that `deriveStatus` would classify as `Weak`
- **THEN** the result SHALL be `'Leech'`

#### Scenario: Leech excluded from the normal due queue
- **WHEN** the study queue is built in due mode and a word has `status: 'Leech'` with `nextReviewDate` in the past
- **THEN** the word SHALL NOT appear in the returned queue
- **AND** the word SHALL NOT be counted toward the dashboard due count

#### Scenario: Reset leech re-enters the due queue
- **WHEN** the user clicks Reset on a leech in the dashboard leech panel
- **THEN** `consecutiveFails` SHALL be set to 0
- **AND** `status` SHALL be set to `'Weak'`
- **AND** `intervalMeaning` and `intervalPinyin` SHALL be set to 1
- **AND** `nextReviewDate` SHALL be set to now
- **AND** the word SHALL appear in the next due-mode queue build

#### Scenario: Passing review clears leech status
- **WHEN** a word with `consecutiveFails: 9` is reviewed and either sub-skill is known
- **THEN** `consecutiveFails` SHALL be reset to 0
- **AND** `applyBinaryReview` SHALL return `isLeech: false`
- **AND** `resolveStatus` SHALL return the interval-derived status instead of `'Leech'`

#### Scenario: Leeches surface in the dashboard leech panel
- **WHEN** the dashboard loads and one or more words have `status: 'Leech'`
- **THEN** each such word SHALL be listed in the leech panel with its simplified form, pinyin, and definition
- **AND** each SHALL offer Reset, Suspend, and Delete actions

### Requirement: ReviewHistory captures per-step knowledge state
Each completed card review SHALL create a `ReviewHistory` row with `knewPronunciation` and `knewMeaning` boolean fields.

#### Scenario: Per-step booleans stored on ReviewHistory
- **WHEN** `POST /api/session/review` is called with `{ wordId, knewPronunciation, knewMeaning }`
- **THEN** a `ReviewHistory` row SHALL be created with those fields populated
- **AND** `subskill` SHALL be set to `"combined"`
- **AND** `response` SHALL be: `"Good"` if both known, `"Again"` if neither, `"Hard"` if mixed

### Requirement: nextReviewDate SHALL be set to the earliest due sub-skill
After a binary review, the system SHALL set `nextReviewDate` to `now + min(newIntervalMeaning, newIntervalPinyin)` so the card surfaces when whichever sub-skill is due soonest. Intervals are floats measured in days and SHALL be applied with sub-day precision — the fractional part SHALL NOT be truncated. The date SHALL be computed by millisecond arithmetic (`now + days × 86 400 000`), not by whole-day date-component arithmetic.

#### Scenario: Asymmetric intervals produce earliest due date
- **WHEN** `newIntervalMeaning = 1` day and `newIntervalPinyin = 6.25` days after review
- **THEN** `nextReviewDate` SHALL be set to `now + 1 day`

#### Scenario: Fractional interval scheduled to sub-day precision
- **WHEN** the smallest new interval is `6.25` days
- **THEN** `nextReviewDate` SHALL be `now + 6 days 6 hours` (540 000 000 ms)
- **AND** it SHALL NOT be truncated to `now + 6 days`

#### Scenario: Whole-day interval unchanged by the precision fix
- **WHEN** the smallest new interval is exactly `4` days
- **THEN** `nextReviewDate` SHALL be `now + 4 days` to the millisecond

