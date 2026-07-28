## ADDED Requirements

### Requirement: The unstudied pool is defined by review history, not document existence
The pool of unstudied words available to a session SHALL be every word in the static word database that the user has not yet studied. A word counts as studied when its document has a `status` other than `Unstudied` or an `intervalMeaning` greater than `0`. The mere existence of a `users/{uid}/words/{simplified}` document SHALL NOT remove a word from the unstudied pool.

This makes words that gained a document without ever being reviewed — words encountered in a graded reader, or words that only received a user note — still eligible to be introduced as new cards.

#### Scenario: Word encountered while reading is still offered as a new card
- **GIVEN** `苹果` has a document with `status` `Unstudied` and `intervalMeaning` `0`, written when the user finished a reader chapter
- **WHEN** the user starts a Standard session covering that word's deck
- **THEN** `苹果` SHALL be eligible as a new card in that session

#### Scenario: Word with only a note is still offered as a new card
- **GIVEN** a word whose only document field is a user note, leaving `status` `Unstudied` and `intervalMeaning` `0`
- **WHEN** the user starts a Standard session covering that word's deck
- **THEN** that word SHALL be eligible as a new card

#### Scenario: Reviewed word is excluded from the unstudied pool
- **GIVEN** a word has been reviewed and has `intervalMeaning` `1`
- **WHEN** a session is built
- **THEN** that word SHALL NOT be offered as a new card
- **AND** it SHALL be scheduled through the normal due-review path

#### Scenario: Daily new-card allowance still applies
- **GIVEN** several reader-encountered words are eligible as new cards
- **WHEN** the user starts a Standard session and the daily new-card allowance is exhausted
- **THEN** no new cards SHALL be introduced
