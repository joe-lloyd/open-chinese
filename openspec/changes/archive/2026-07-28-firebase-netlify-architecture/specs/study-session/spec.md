## MODIFIED Requirements

### Requirement: Card queue built client-side from Firestore and SQLite
The system SHALL build the study queue without any server API call. Due cards SHALL be fetched from Firestore (`users/{uid}/words` where `nextReviewDate <= now` and `status` not `Mastered` or `Leech`). Unstudied cards SHALL come from words in SQLite that have no corresponding Firestore document, up to the daily new-card limit.

#### Scenario: Session queue built from due Firestore cards
- **WHEN** user starts a review session
- **THEN** the system SHALL query Firestore for all words where `nextReviewDate <= now`
- **AND** SHALL cross-reference with SQLite to get word content (simplified, pinyin, definition)
- **AND** SHALL assemble the queue sorted by `nextReviewDate` ascending

#### Scenario: Unstudied cards fill remaining queue slots up to daily limit
- **WHEN** fewer due cards exist than the session size
- **THEN** the system SHALL add Unstudied words (from SQLite, not in Firestore) up to `dailyNewLimit - newCardsSeen` for today
- **AND** new words SHALL be ordered by `hsk_level` ascending then `id` ascending

#### Scenario: Daily new-card limit respected
- **WHEN** `newCardsSeen` for today already equals `dailyNewLimit`
- **THEN** no Unstudied cards SHALL be added to the queue

#### Scenario: HSK-filtered session bypasses daily new-card limit
- **WHEN** user starts a session with `hskLevel` option set
- **THEN** the system SHALL only include cards whose `simplified` is in `getWordsByLevel(hskLevel)`
- **AND** SHALL NOT enforce `dailyNewLimit` — all remaining slots are filled with new cards from that level

### Requirement: Review result written directly to Firestore
After the user completes both grading phases for a card, the computed SRS state SHALL be written to `users/{uid}/words/{simplified}` via the Firestore adapter. No server API call is made.

#### Scenario: Card graded and Firestore updated
- **WHEN** user grades both pronunciation and meaning
- **THEN** the client SHALL call `applyBinaryReview` and write the result to Firestore
- **AND** the next card in the queue SHALL be presented immediately (optimistic update; no await block on UI)

### Requirement: Failed cards re-queued within session for active recall
When a card is failed (meaning not known), it SHALL be re-inserted into the queue approximately 3 positions ahead, up to a maximum of 2 re-queues per card per session.

#### Scenario: Failed card reappears shortly after
- **WHEN** user fails the meaning for a card
- **THEN** the card SHALL be inserted at `currentIndex + 3` in the queue (or at the end if fewer remain)
- **AND** this SHALL happen at most 2 times per card per session

### Requirement: Timer expiry lets current card and outstanding failed cards finish
When a timed session timer reaches zero, the session SHALL NOT end immediately. The user SHALL complete the card currently on screen. Any cards that were failed and re-queued (and are still ahead in the queue) SHALL also be shown before the session ends. Cards not yet seen that are not re-queued failures SHALL be dropped.

#### Scenario: Timer expires mid-card
- **WHEN** the timer reaches zero while a card is being reviewed
- **THEN** the current card SHALL be completed normally
- **AND** any re-queued failed cards remaining in the queue SHALL be shown
- **AND** unseen cards that were never attempted SHALL be dropped from the queue

#### Scenario: No outstanding failed cards when timer expires
- **WHEN** the timer reaches zero and no failed re-queued cards are in the remaining queue
- **THEN** after the current card is graded the session SHALL end immediately

### Requirement: Audio plays automatically when a word is failed/revealed
When the user presses "I don't know" at any phase (triggering the `failAndReveal` path), the word TTS audio SHALL play automatically as the answer is revealed. This reinforces the correct pronunciation at the moment of failure.

#### Scenario: Fail path triggers automatic audio
- **WHEN** user presses `←` or "I don't know" at any phase
- **THEN** the full card SHALL be revealed AND the word audio SHALL play immediately
- **AND** the user does not need to press the audio button manually

### Requirement: User can mark a word as fully known from the study card
When the meaning is revealed, a "Mark as known" button SHALL be available. Pressing it SHALL mark the word as `Mastered` in Firestore and advance to the next card. This is for words the user already knows well and does not need to review.

#### Scenario: Mark as known during study
- **WHEN** the meaning is revealed and user clicks "Mark as known"
- **THEN** `markWordsKnown([simplified])` SHALL be called
- **AND** the card SHALL advance immediately without counting as a graded review
- **AND** the word SHALL not reappear in future due queues

### Requirement: Keyboard controls follow left=fail, right=pass convention
- `→` / `Space` — reveal answer at hidden phases; grade as "knew it" at revealed phases
- `←` — at any phase, immediately reveal the full card (pinyin + definition) and mark the card as failed (both pronunciation and meaning = false). Plays word audio automatically.
- `↑` / `R` — replay TTS audio at any phase
- `↓` — play example sentence audio when meaning is revealed
- `?` — toggle keyboard help overlay

#### Scenario: Left arrow pressed before answer is revealed
- **WHEN** user presses `←` during `pron-hidden`, `pron-revealed`, or `meaning-hidden`
- **THEN** the system SHALL immediately show the full card (transition to `meaning-revealed` state)
- **AND** SHALL set `revealedByFail = true`
- **AND** SHALL play the word TTS audio
- **AND** pressing `→`, `←`, or `Space` SHALL advance to the next card with `knewPronunciation = false` and `knewMeaning = false`

### Requirement: Study card layout must not shift between phases

The card UI SHALL hold all regions at fixed size across all phases. No element may appear/disappear in a way that shifts surrounding content.

#### Rules
- The hanzi character SHALL render at the same position regardless of phase (never conditional)
- The traditional character row SHALL always occupy its vertical space; hidden by `opacity-0` when not applicable, not by `display:none`
- The pinyin area SHALL occupy a fixed height (e.g., `h-14`) at all phases; content fades in via `opacity-0 → opacity-100`
- The definition card SHALL occupy its space at all phases; hidden by `opacity-0 pointer-events-none` until meaning is revealed
- The button area SHALL have a fixed minimum height (e.g., `min-h-28`); button labels swap in-place, not append/remove rows
- Example sentences SHALL appear inside the definition card when meaning is revealed; their presence or absence SHALL NOT affect the card's outer height (the card holds space for them)

#### Scenario: Phase transition does not reflow the page
- **WHEN** any phase transition occurs (hidden → revealed, or card advance)
- **THEN** the hanzi character SHALL remain at the same Y position
- **AND** the button row SHALL remain at the same Y position
- **AND** no scroll jump SHALL occur
