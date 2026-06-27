## ADDED Requirements

### Requirement: Card queue construction
The system SHALL build a study queue from all words with `nextReviewDate ≤ now` and status not `Mastered` or `Leech`. Queue size SHALL be configurable (default 50 cards per session).

#### Scenario: Session queue built from due cards
- **WHEN** user starts a review session
- **THEN** the system SHALL load all due cards sorted by `nextReviewDate` ascending, limited to the configured session size

#### Scenario: No cards due returns empty state
- **WHEN** no words have `nextReviewDate ≤ now`
- **THEN** the UI SHALL show an "all caught up" empty state with time until next review

### Requirement: Two-phase reveal flow per card
Each card SHALL be assessed in two sequential phases: pronunciation then meaning. Both phases MUST be completed before advancing to the next card. A word is only considered known if the user correctly self-assesses BOTH phases.

#### Scenario: Pronunciation phase precedes meaning phase
- **WHEN** a card is presented
- **THEN** the pronunciation phase SHALL be active first; the meaning phase SHALL not be visible until pronunciation is revealed

#### Scenario: Both phases required for advancement
- **WHEN** pronunciation phase is complete but meaning phase is not
- **THEN** the system SHALL show the meaning phase and SHALL NOT advance to the next card

### Requirement: Phase 1 — Pronunciation self-assessment
The system SHALL display the Simplified character prominently and ask the user if they know how to pronounce it. The user SHALL claim knowledge before the answer is revealed.

Two buttons are presented:
- **"I think I know"** — user claims to know; both paths reveal the pinyin
- **"Show me"** — user admits they don't know; reveals the pinyin

After pinyin is revealed, two grading buttons appear:
- **"I knew it"** (keyboard: Y or Enter) — records `knewPronunciation: true`
- **"I didn't know it"** (keyboard: N) — records `knewPronunciation: false`

#### Scenario: User claims pronunciation knowledge correctly
- **WHEN** user clicks "I think I know" then "I knew it" after seeing pinyin
- **THEN** `knewPronunciation` SHALL be recorded as `true` and the meaning phase SHALL begin

#### Scenario: User admits they don't know pronunciation
- **WHEN** user clicks "Show me"
- **THEN** pinyin SHALL be revealed immediately; grading buttons SHALL appear

#### Scenario: Space key reveals pronunciation
- **WHEN** user presses Space in pronunciation claim phase
- **THEN** the pinyin SHALL be revealed (equivalent to "Show me")

### Requirement: Phase 2 — Meaning self-assessment
After pronunciation is resolved, the system SHALL show the character plus its revealed pinyin and ask the user if they know the meaning.

Two buttons are presented:
- **"I think I know the meaning"** — user claims to know
- **"Show me the meaning"** — user admits they don't know

After meaning is revealed, two grading buttons appear:
- **"I knew it"** (keyboard: Y or Enter) — records `knewMeaning: true`
- **"I didn't know it"** (keyboard: N) — records `knewMeaning: false`

#### Scenario: User knows meaning after knowing pronunciation
- **WHEN** user completes pronunciation phase with `knewPronunciation: true` and then confirms meaning
- **THEN** `knewMeaning` SHALL be recorded and the SRS update SHALL be submitted

#### Scenario: Meaning phase shown with pinyin visible
- **WHEN** meaning phase begins
- **THEN** the pinyin SHALL remain visible on screen throughout the meaning phase

### Requirement: SRS submission after both phases
After both phases are complete, the system SHALL submit a single review record containing `knewPronunciation` and `knewMeaning` and advance to the next card.

#### Scenario: Full card reviewed
- **WHEN** user completes both phases
- **THEN** a POST to `/api/session/review` SHALL be made with `{ wordId, knewPronunciation, knewMeaning }` and the next card SHALL load

### Requirement: Centered study layout
The study interface SHALL be centered both horizontally and vertically within the viewport. The character SHALL be displayed at a minimum of 6rem font size.

#### Scenario: Character fills center of screen
- **WHEN** a card is presented
- **THEN** the character SHALL be rendered in the center of the page with substantial vertical whitespace above and below

### Requirement: Session progress bar
The system SHALL display a progress bar showing cards completed vs total session size and an elapsed session timer.

#### Scenario: Progress increments after both phases
- **WHEN** a user completes both phases of a card
- **THEN** the progress counter SHALL increment by 1

### Requirement: Audio replay
The system SHALL play the word's audio when user presses R during any phase of review.

#### Scenario: R key triggers audio
- **WHEN** user presses R
- **THEN** the word's TTS audio SHALL play immediately regardless of current phase

### Requirement: Session completion summary
The system SHALL display a summary screen after the last card showing: cards reviewed, pronunciation accuracy %, meaning accuracy %, combined accuracy %, and session duration.

#### Scenario: Session end shows per-dimension accuracy
- **WHEN** the last card is completed
- **THEN** the summary SHALL show separate accuracy percentages for pronunciation and meaning, plus a combined "fully known" percentage
