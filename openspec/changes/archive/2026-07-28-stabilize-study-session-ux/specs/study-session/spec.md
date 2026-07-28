## MODIFIED Requirements

### Requirement: Centered study layout
The study interface SHALL be centered both horizontally and vertically within the viewport. The character SHALL be displayed at a minimum of 6rem font size for single-character words.

The study card column SHALL have a deterministic height: every region — HSK badge, character, traditional form, pinyin and pronunciation practice, definition and example, and the grading button area — SHALL reserve a fixed height that does not vary with its content, with each region's content centered within its reserved box. As a consequence the character SHALL occupy identical pixel coordinates on every card and in every reveal phase.

The character's font size SHALL be derived from the word's character count, the width available to its row, and the height of its reserved box — never from anything else — so that a word of any length renders on a single line without wrapping, always fits inside its box, and is as large as those constraints allow. Words of different lengths SHALL therefore share the same optical center.

Content that exceeds its reserved region SHALL scroll within that region rather than resize it.

Transient chrome that is not part of the card — such as the failed-write banner — SHALL be overlaid rather than inserted into the column, so that its appearance and dismissal do not displace the character.

#### Scenario: Character fills center of screen
- **WHEN** a card is presented
- **THEN** the character SHALL be rendered in the center of the page with substantial vertical whitespace above and below

#### Scenario: Character does not move between cards
- **WHEN** the session advances from a one-character word to a four-character word, or between words with and without a traditional form, an example sentence, or an HSK level
- **THEN** the character SHALL be rendered at the same position
- **AND** no region of the card SHALL change height

#### Scenario: Character does not move between reveal phases
- **WHEN** the pronunciation is revealed, and then the meaning is revealed, for the same card
- **THEN** the character SHALL remain at the same position throughout
- **AND** the grading button area SHALL keep the same height across all four phases

#### Scenario: Multi-character word does not wrap
- **WHEN** a card whose simplified form is three or four characters is presented
- **THEN** the characters SHALL render on a single line
- **AND** the font size SHALL be reduced so the line fits the viewport width

#### Scenario: Character never overflows its reserved box
- **WHEN** a card is presented at any viewport width, including widths either side of a layout breakpoint
- **THEN** the rendered character SHALL be no taller than its reserved box

#### Scenario: Failed-write banner does not move the character
- **WHEN** a Firestore write fails mid-session and the error banner appears, and is later dismissed
- **THEN** the character SHALL remain at the same position throughout
- **AND** the height of the study column SHALL NOT change

#### Scenario: Long definition scrolls inside its region
- **WHEN** a card's definition is too tall for its reserved region
- **THEN** the definition region SHALL scroll internally
- **AND** SHALL NOT grow, and SHALL NOT displace the character

### Requirement: Session progress bar
The system SHALL display a progress bar showing cards completed vs total session size and an elapsed session timer. The progress row SHALL also carry the control that opens the in-session menu.

#### Scenario: Progress increments after both phases
- **WHEN** a user completes both phases of a card
- **THEN** the progress counter SHALL increment by 1

#### Scenario: Menu control is reachable during a session
- **WHEN** a session is in progress in any phase
- **THEN** a menu control SHALL be visible in the progress row
- **AND** activating it SHALL open the in-session menu

## ADDED Requirements

### Requirement: Revealed content hides instantly on advance
Revealed regions — the pinyin block, the definition and example panel, and the example sentence's pinyin line — SHALL fade in when revealed and SHALL hide without any transition when the session advances to the next card. Hiding SHALL complete within the same frame in which the next card is rendered, so no part of the previous card's answer is ever painted over the next card.

This SHALL hold on every path that advances a card: the meaning grading buttons, the keyboard shortcuts, the "Next card" control on the fail-reveal path, and "Mark as fully known".

#### Scenario: Rapid grading does not leak the previous answer
- **WHEN** the user grades a card and the next card is presented within the duration of the reveal animation
- **THEN** the previous card's pinyin, definition and example SHALL already be invisible on the first frame of the next card
- **AND** no fade-out SHALL be observable

#### Scenario: Reveal still fades in
- **WHEN** the user reveals the pronunciation or the meaning of a card
- **THEN** the revealed region SHALL fade in

#### Scenario: Fail-reveal path also hides instantly
- **WHEN** the user answers "I don't know", the full card is revealed, and the user then advances with "Next card"
- **THEN** the revealed content SHALL be invisible on the first frame of the next card

### Requirement: Example sentence pinyin reveal
When a card's meaning is revealed and the card has an example sentence with a stored pinyin reading, the system SHALL offer to reveal that reading. The reading SHALL be revealed by hovering the sentence with a mouse, by tapping the sentence on a touch device, or by pressing `P`. Tapping and pressing `P` SHALL toggle it; mouse hover SHALL reveal it for the duration of the hover.

The line that holds the reading SHALL reserve its space unconditionally, so revealing or hiding it SHALL NOT change the height of any region.

The reveal control SHALL NOT be reachable by keyboard focus, so that keys bound to the study flow cannot be routed to it. The reveal state SHALL reset when the session advances to another card.

The keyboard help overlay SHALL list `P` as the sentence-pinyin toggle.

#### Scenario: Mouse hover reveals the reading
- **WHEN** the meaning is revealed and the user hovers the example sentence with a mouse
- **THEN** the sentence's pinyin SHALL become visible
- **AND** it SHALL be hidden again when the pointer leaves

#### Scenario: Tap toggles the reading on touch
- **WHEN** the meaning is revealed and the user taps the example sentence on a touch device
- **THEN** the sentence's pinyin SHALL become visible and SHALL remain visible until tapped again
- **AND** the synthesised hover that follows the tap SHALL NOT leave it latched on

#### Scenario: P toggles the reading
- **WHEN** the meaning is revealed for a card with an example sentence and the user presses `P`
- **THEN** the sentence's pinyin SHALL toggle between visible and hidden

#### Scenario: Reveal state does not survive the card
- **WHEN** the sentence pinyin is visible and the session advances to the next card
- **THEN** the next card's sentence pinyin SHALL be hidden

#### Scenario: Card without a stored reading offers no reveal
- **WHEN** a card has an example sentence but no stored pinyin reading
- **THEN** no reveal control SHALL be offered
- **AND** pressing `P` SHALL do nothing

#### Scenario: Space is never routed to the reveal control
- **WHEN** the user drives the session entirely from the keyboard
- **THEN** focus SHALL never land on the sentence pinyin control
- **AND** Space SHALL always act on the study flow

### Requirement: In-session menu
The system SHALL provide a menu, opened from the study screen, that presents session-scoped actions and settings in a panel anchored to the right edge of the viewport. The panel SHALL be usable at mobile widths.

While the menu is open it SHALL be modal. No control behind it SHALL be reachable — by key, by pointer, or by focus. `Escape` SHALL close the menu. Dismissing the backdrop SHALL close the menu.

The panel SHALL paint above every other fixed element in the app, including the mobile bottom navigation, which SHALL NOT be tappable while the menu is open.

Opening the menu SHALL move focus into the panel; closing it SHALL return focus to the control that opened it. While the menu is closed, no control inside the panel SHALL be reachable by keyboard.

The menu SHALL contain a TTS volume control and an "End session now" action, and SHALL be structured so further entries can be added without restructuring it.

#### Scenario: Menu opens as a right-hand panel
- **WHEN** the user activates the menu control during a session
- **THEN** a panel SHALL slide in from the right edge over a backdrop
- **AND** it SHALL be legible and operable at mobile widths

#### Scenario: Study shortcuts are inert while the menu is open
- **WHEN** the menu is open and the user presses `→`, `←`, or Space
- **THEN** the card SHALL NOT be graded, revealed, or advanced

#### Scenario: Grading controls cannot be reached by focus behind the panel
- **WHEN** the menu is open and the user presses Tab repeatedly and then Enter
- **THEN** focus SHALL NOT reach any control behind the backdrop
- **AND** no card SHALL be graded or advanced

#### Scenario: Bottom navigation cannot be tapped through the panel
- **WHEN** the menu is open at a mobile width and the user taps where the bottom navigation sits
- **THEN** the panel or its backdrop SHALL receive the tap
- **AND** the app SHALL NOT navigate away from the running session

#### Scenario: Focus enters the panel and returns on close
- **WHEN** the user opens the menu and then closes it
- **THEN** focus SHALL move into the panel on open
- **AND** SHALL return to the menu control on close

#### Scenario: Closed panel is out of the tab order
- **WHEN** the menu is closed and the user tabs through the study screen
- **THEN** focus SHALL NOT land on the volume control or any action inside the panel

#### Scenario: Escape closes the menu
- **WHEN** the menu is open and the user presses `Escape`
- **THEN** the menu SHALL close
- **AND** the study shortcuts SHALL become active again

#### Scenario: The keyboard help overlay is equally inert
- **WHEN** the keyboard help overlay is open and the user presses `→` or `←`
- **THEN** the card SHALL NOT be graded or advanced
- **AND** `Escape` or `?` SHALL close the overlay

### Requirement: End session on demand
The in-session menu SHALL provide an "End session now" action that ends the current session gracefully. Activating it SHALL stop the session timer and present the standard end-of-session summary for the cards graded so far, rather than navigating away from the study screen.

All cards graded before the action SHALL already be persisted, since each review is written when it is graded. The card displayed at the moment the session is ended SHALL NOT be graded and SHALL NOT be written.

#### Scenario: Ending a session shows the normal summary
- **WHEN** the user has graded some cards and activates "End session now"
- **THEN** the session summary SHALL be shown with the counts, accuracies and duration for the cards graded in this session
- **AND** the user SHALL remain on the study screen

#### Scenario: Progress is kept
- **WHEN** a session is ended early
- **THEN** every review graded before the action SHALL remain persisted
- **AND** the card on screen at the time SHALL remain due

#### Scenario: Ending before grading anything
- **WHEN** the user activates "End session now" without having graded any card
- **THEN** the summary SHALL be shown reporting zero cards
- **AND** no error SHALL be raised
