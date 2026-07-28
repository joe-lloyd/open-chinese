## ADDED Requirements

### Requirement: Recommendations are pure functions over an explicit context
The recommendation engine SHALL be implemented as pure functions in a standalone module that take a single plain context object and return an ordered array of recommendations. It SHALL NOT read from Firestore, the router, the DOM, or the current time implicitly — the current time SHALL be supplied on the context. Recommendation selection SHALL NOT be expressed as conditionals inside JSX.

#### Scenario: Same context yields same recommendations
- **WHEN** the engine is called twice with an identical context object
- **THEN** it SHALL return identical recommendations in identical order

#### Scenario: No implicit I/O
- **WHEN** the engine runs
- **THEN** it SHALL NOT perform network, storage or clock access

### Requirement: Top recommendations surfaced on the dashboard
The dashboard SHALL display between one and three recommendations, chosen by ranking all candidate rules that fire against the learner's current state and taking the highest ranked. Each displayed recommendation SHALL have a title, a one-line supporting detail derived from the learner's own numbers, and a link that performs the action.

At most one recommendation per distinct destination SHALL be shown, so two rules that resolve to the same route do not both appear.

#### Scenario: Three recommendations shown when many rules fire
- **WHEN** five candidate rules fire for the learner's state
- **THEN** the three highest ranked SHALL be displayed

#### Scenario: Duplicate destinations collapsed
- **WHEN** two firing rules resolve to the same destination route
- **THEN** only the higher ranked of the two SHALL be displayed

#### Scenario: Detail text uses the learner's numbers
- **WHEN** the learner has 137 cards due
- **THEN** the recommendation's detail text SHALL reference 137 rather than generic phrasing

### Requirement: A recommendation is always available
The engine SHALL always return at least one recommendation. When no state-specific rule fires, it SHALL fall back to a general action appropriate to whether the learner has started studying at all.

#### Scenario: Brand new learner
- **WHEN** the learner has no word documents and no recorded study days
- **THEN** the engine SHALL recommend starting with the first HSK level
- **AND** the recommendation SHALL link to the HSK levels route

#### Scenario: Fully caught up learner
- **WHEN** the learner has nothing due, no leeches, has already studied today, and no other rule fires
- **THEN** the engine SHALL still return at least one recommendation

### Requirement: Backlog triggers a cram recommendation
When the number of due cards exceeds a defined backlog threshold, the engine SHALL recommend a time-boxed cram session in preference to a plain due-review session, and the recommendation SHALL link to the study route with the cram mode and a duration parameter.

#### Scenario: Large backlog recommends cram
- **WHEN** 250 cards are due
- **THEN** a cram recommendation SHALL be returned ranked above the plain due-review recommendation
- **AND** its destination SHALL carry the cram mode and a duration parameter

#### Scenario: Small due count recommends a normal session
- **WHEN** 12 cards are due
- **THEN** the plain due-review recommendation SHALL be returned and the cram recommendation SHALL NOT fire

### Requirement: Streak-at-risk recommendation
When the learner has an active multi-day streak, has reviewed nothing today, and the local time is late in the day, the engine SHALL recommend a short session framed around preserving the streak, linking to a duration-limited study session.

#### Scenario: Evening with an unstudied day and a live streak
- **WHEN** the learner has a 12-day streak, has reviewed 0 cards today, and the context time is 20:00 local
- **THEN** a streak-preserving recommendation SHALL fire referencing the 12-day streak
- **AND** its destination SHALL carry a short duration parameter

#### Scenario: Streak already safe
- **WHEN** the learner has a 12-day streak and has already reviewed cards today
- **THEN** the streak-preserving recommendation SHALL NOT fire

#### Scenario: No streak to protect
- **WHEN** the learner's current streak is 0
- **THEN** the streak-preserving recommendation SHALL NOT fire

### Requirement: Leech accumulation recommendation
When the number of leech words reaches a defined threshold, the engine SHALL recommend addressing them, linking to a study session restricted to cards the learner has been failing.

#### Scenario: Leeches piling up
- **WHEN** the learner has 9 leeches
- **THEN** a leech recommendation SHALL fire referencing 9 words
- **AND** its destination SHALL be a study session scoped to repeatedly failed cards

#### Scenario: Few leeches ignored
- **WHEN** the learner has 1 leech
- **THEN** the leech recommendation SHALL NOT fire

### Requirement: Nearly complete HSK level recommendation
When an HSK level is between a defined proportion complete and not yet fully complete, the engine SHALL recommend finishing it, linking to a study session scoped to that level with the new-words mode. The closest level to completion SHALL be chosen.

#### Scenario: Level close to done
- **WHEN** HSK 2 is 88% studied and HSK 3 is 20% studied
- **THEN** the recommendation SHALL target HSK 2
- **AND** its destination SHALL carry the HSK level and the new-words mode

#### Scenario: Completed level not recommended
- **WHEN** HSK 1 is 100% studied
- **THEN** no recommendation SHALL target HSK 1

### Requirement: Continue reading recommendation degrades gracefully
The engine SHALL accept an optional last-read position describing an unfinished reader chapter. When present it SHALL produce a recommendation to resume that chapter, linking to the reader route for that reader and chapter. When the position is absent, malformed, or already complete, no reading recommendation SHALL be produced and no error SHALL surface.

#### Scenario: Unfinished chapter resumes
- **WHEN** the context carries a last-read position for reader `r1`, chapter `c3`, 40% through
- **THEN** a recommendation to continue reading SHALL fire naming the reader
- **AND** its destination SHALL address reader `r1` and chapter `c3`

#### Scenario: No reading data present
- **WHEN** the context carries no last-read position
- **THEN** no reading recommendation SHALL be produced
- **AND** the remaining recommendations SHALL be unaffected

#### Scenario: Malformed reading data ignored
- **WHEN** the context carries a last-read position missing its reader or chapter identifier
- **THEN** it SHALL be treated as absent
