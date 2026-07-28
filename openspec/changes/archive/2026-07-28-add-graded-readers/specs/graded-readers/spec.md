## ADDED Requirements

### Requirement: Readers section with overall completion
The system SHALL provide a dedicated Readers section, reachable from the primary navigation on both desktop and mobile, that lists every available graded reader. The section SHALL display the user's overall completion as the number of finished chapters against the total number of chapters across all readers.

#### Scenario: Readers section reachable from navigation
- **WHEN** user opens the app
- **THEN** a "Readers" entry SHALL be present in the desktop sidebar and in the mobile bottom navigation
- **AND** activating it SHALL navigate to `/readers`

#### Scenario: Reader list shows every reader with its level
- **WHEN** user opens `/readers`
- **THEN** every reader in the content manifest SHALL be listed
- **AND** each entry SHALL show the reader's title, its English title, its target HSK level, and its chapter count

#### Scenario: Overall completion displayed
- **GIVEN** the user has finished 3 chapters out of 5 across all readers
- **WHEN** user opens `/readers`
- **THEN** the section SHALL display `3 / 5` chapters finished

#### Scenario: Per-reader completion displayed
- **GIVEN** the user has finished 2 of the 3 chapters in a reader
- **WHEN** user opens `/readers`
- **THEN** that reader's entry SHALL show `2 / 3` and a progress bar at 67%

### Requirement: Reader chapter list
The system SHALL provide a per-reader view at `/readers/:readerId` listing that reader's chapters in order. Each chapter entry SHALL indicate whether the user has finished it and how many of its words the user has not yet encountered.

#### Scenario: Chapter list shows completion state
- **GIVEN** the user has finished chapter 1 of a reader
- **WHEN** user opens `/readers/:readerId`
- **THEN** chapter 1 SHALL be marked as finished
- **AND** the remaining chapters SHALL be marked as unfinished

#### Scenario: Chapter list shows new-word count for the user
- **GIVEN** a chapter contains 18 distinct vocabulary words, 5 of which already have a document at `users/{uid}/words/{simplified}`
- **WHEN** user opens the chapter list
- **THEN** that chapter SHALL show `13 new words`

#### Scenario: Unknown reader id
- **WHEN** user opens `/readers/does-not-exist`
- **THEN** the system SHALL show a not-found message and a link back to `/readers`

### Requirement: Chapter reading surface
The system SHALL render a chapter at `/readers/:readerId/:chapterId` as running Chinese text in large type with generous line spacing, laid out paragraph by paragraph.

#### Scenario: Chapter text rendered in large type
- **WHEN** user opens a chapter
- **THEN** the chapter's paragraphs SHALL be rendered in sequence
- **AND** the Chinese text SHALL be rendered at a size and line height substantially larger than the app's body text

#### Scenario: Reading a chapter records it as the last read
- **WHEN** user opens a chapter
- **THEN** the system SHALL record `readerId` and `chapterId` as the user's last-read position

### Requirement: Pinyin toggle
The chapter reading surface SHALL provide a pinyin toggle. When enabled, each word SHALL display its pinyin as a ruby annotation above the characters. When disabled, no pinyin SHALL be shown inline. The toggle state SHALL persist across chapters within a browser session.

#### Scenario: Pinyin shown when toggled on
- **WHEN** user enables the pinyin toggle
- **THEN** every word token SHALL render its pinyin above the characters
- **AND** punctuation SHALL NOT receive a pinyin annotation

#### Scenario: Pinyin hidden by default
- **WHEN** user opens a chapter for the first time
- **THEN** the text SHALL render without inline pinyin

#### Scenario: Toggle persists between chapters
- **GIVEN** the user has enabled the pinyin toggle
- **WHEN** user navigates to a different chapter
- **THEN** pinyin SHALL still be shown

### Requirement: English translation toggle
The chapter reading surface SHALL provide an English translation toggle. When enabled, each paragraph SHALL display its English translation beneath the Chinese text.

#### Scenario: Translation shown when toggled on
- **WHEN** user enables the translation toggle
- **THEN** each paragraph SHALL show its English translation below the Chinese text

#### Scenario: Translation hidden by default
- **WHEN** user opens a chapter for the first time
- **THEN** no English translations SHALL be visible

### Requirement: Per-word lookup by hover or tap
The system SHALL let the user inspect any individual word in the chapter text. On devices that support hover, pointing at a word SHALL open a popover showing the word, its pinyin, and its English meaning. On all devices, tapping or clicking a word SHALL toggle the same popover. Punctuation SHALL NOT be interactive.

#### Scenario: Hover reveals meaning on desktop
- **GIVEN** the device supports hover
- **WHEN** user points at the word `朋友`
- **THEN** a popover SHALL appear showing `朋友`, `péng you`, and its English definition

#### Scenario: Tap reveals meaning on mobile
- **GIVEN** a touch device
- **WHEN** user taps the word `朋友`
- **THEN** a popover SHALL appear showing its pinyin and English definition
- **AND** tapping the same word again SHALL dismiss the popover

#### Scenario: Popover dismissed by outside interaction
- **GIVEN** a word popover is open
- **WHEN** user presses Escape, taps outside the popover, or scrolls the page
- **THEN** the popover SHALL close

#### Scenario: Punctuation is not interactive
- **WHEN** user taps a punctuation mark in the text
- **THEN** no popover SHALL appear

#### Scenario: Popover stays within the viewport
- **WHEN** a popover is opened for a word near the edge of the screen
- **THEN** the popover SHALL be positioned so that it remains fully visible within the viewport

### Requirement: Unencountered words are highlighted
The system SHALL visually highlight every word in the chapter that the user has not yet encountered. A word counts as encountered if and only if a document exists at `users/{uid}/words/{simplified}`, which covers both words studied in flashcards and words previously met in a reader. The chapter SHALL display a count of how many unencountered words it contains.

#### Scenario: Unencountered word highlighted
- **GIVEN** the user has no document at `users/{uid}/words/苹果`
- **WHEN** user opens a chapter containing `苹果`
- **THEN** every occurrence of `苹果` SHALL be visually highlighted

#### Scenario: Previously studied word not highlighted
- **GIVEN** the user has a document at `users/{uid}/words/朋友`
- **WHEN** user opens a chapter containing `朋友`
- **THEN** `朋友` SHALL render without highlighting

#### Scenario: Word encountered in an earlier chapter not highlighted
- **GIVEN** the user finished a chapter that introduced `苹果`
- **WHEN** user opens a later chapter containing `苹果`
- **THEN** `苹果` SHALL render without highlighting

### Requirement: Finishing a chapter adds its new words to the personal dictionary
The chapter reading surface SHALL provide an explicit control to mark the chapter as finished. Marking a chapter finished SHALL write a word document to `users/{uid}/words/{simplified}` for every word in the chapter the user had not yet encountered, SHALL record the chapter as completed for that reader, and SHALL show the user which words were added.

#### Scenario: Finishing a chapter writes the new words
- **GIVEN** a chapter contains 12 words the user has not encountered
- **WHEN** user marks the chapter as finished
- **THEN** 12 documents SHALL be written under `users/{uid}/words`
- **AND** each SHALL record that it was encountered in this reader and chapter

#### Scenario: Added words are reported to the user
- **WHEN** user marks a chapter as finished
- **THEN** the system SHALL display the list of words added to the personal dictionary

#### Scenario: Already-encountered words are not overwritten
- **GIVEN** the user has already studied `朋友` and it appears in the chapter
- **WHEN** user marks the chapter as finished
- **THEN** the existing SRS state of `朋友` SHALL NOT be modified

#### Scenario: Re-finishing a chapter is idempotent
- **GIVEN** the user has already finished a chapter
- **WHEN** the chapter is marked finished again
- **THEN** the reader's completed-chapter list SHALL still contain that chapter exactly once

#### Scenario: Next chapter offered after completion
- **GIVEN** the finished chapter is not the last in its reader
- **WHEN** user marks it as finished
- **THEN** the system SHALL offer a control to continue to the next chapter

### Requirement: Reader progress persisted per user
The system SHALL persist reader progress per user in Firestore and read it back to drive the completion indicators in the Readers section. Progress SHALL survive sign-out and sign-in on another device.

#### Scenario: Progress survives a reload
- **GIVEN** the user finished chapter 1 of a reader
- **WHEN** the user reloads the app
- **THEN** chapter 1 SHALL still be shown as finished

#### Scenario: Progress is per user
- **WHEN** a different user signs in
- **THEN** that user's own reader progress SHALL be shown and no other user's progress SHALL be visible
