# dashboard-recommendations Specification

## Purpose
Selects and ranks the personalized "what should I do next" calls to action shown on the dashboard, from the learner's current SRS, activity and reading state. Rules are pure functions over an explicit context so selection is reproducible and testable, and every recommendation deep-links to the route that performs the action.
## Requirements
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

### Requirement: A rule may suppress rules it makes redundant
A rule SHALL be able to declare which lower-ranked rules it renders redundant when it fires, and a suppressed rule SHALL NOT be displayed even when its own condition holds. Ranking alone SHALL NOT be relied on to express "recommend this *instead of* that", because ranking only orders candidates and never removes them.

#### Scenario: Backlog session replaces the plain due session
- **WHEN** the backlog rule and the plain due-review rule both fire
- **THEN** only the backlog recommendation SHALL be displayed
- **AND** the plain due-review recommendation SHALL be absent rather than merely ranked lower

#### Scenario: New learner sees only the starting action
- **WHEN** the learner has no word documents
- **THEN** the starting recommendation SHALL be the only one displayed
- **AND** no fallback or catch-up recommendation SHALL appear alongside it

### Requirement: One activity category may not take every slot
Each recommendation SHALL declare the kind of activity it leads to. When candidates from more than one category are available, a single category SHALL NOT occupy every displayed slot. If applying that limit leaves slots unfilled, the remaining slots SHALL be backfilled in rank order rather than left empty.

#### Scenario: Reading action survives a crowd of study actions
- **WHEN** four study recommendations and one reading recommendation all fire
- **THEN** the reading recommendation SHALL be displayed
- **AND** at most two of the displayed recommendations SHALL be study recommendations

#### Scenario: Slots backfilled when only one category fired
- **WHEN** three study recommendations fire and no other category does
- **THEN** all three SHALL be displayed rather than only two

### Requirement: A recommendation is always available
The engine SHALL always return at least one recommendation. When no state-specific rule fires, it SHALL fall back to a general action appropriate to whether the learner has started studying at all.

The fallback SHALL be produced only when no rule fires, and SHALL NOT be a rule that competes for a slot alongside other recommendations — its copy asserts that the learner is caught up, which would contradict any other card displayed beside it.

#### Scenario: Brand new learner
- **WHEN** the learner has no word documents and no recorded study days
- **THEN** the engine SHALL recommend starting with the first HSK level
- **AND** the recommendation SHALL link to the HSK levels route

#### Scenario: Fully caught up learner
- **WHEN** the learner has nothing due, no leeches, has already studied today, and no other rule fires
- **THEN** the engine SHALL still return at least one recommendation

#### Scenario: Fallback absent when any rule fires
- **WHEN** at least one state-specific rule fires
- **THEN** the general fallback recommendation SHALL NOT be displayed

### Requirement: Backlog triggers a time-boxed session recommendation
When the number of due cards exceeds a defined backlog threshold, the engine SHALL recommend a time-boxed session in preference to an open-ended due-review session, and the recommendation SHALL link to the study route with a duration parameter.

The destination SHALL target the scheduled-review queue, which is ordered by `nextReviewDate` and therefore actually reduces the backlog. It SHALL NOT use the cram mode: cram ignores `nextReviewDate` entirely and selects the lowest-ease cards across the whole collection including `Mastered` and `Leech`, so it does not address a backlog of due cards.

#### Scenario: Large backlog recommends a time-boxed session
- **WHEN** 250 cards are due
- **THEN** a backlog recommendation SHALL be returned and the plain due-review recommendation SHALL be suppressed
- **AND** its destination SHALL carry a duration parameter and SHALL target the scheduled-review queue

#### Scenario: Backlog destination does not use cram mode
- **WHEN** the backlog recommendation is produced
- **THEN** its destination SHALL NOT carry the cram mode

#### Scenario: Small due count recommends a normal session
- **WHEN** 12 cards are due
- **THEN** the plain due-review recommendation SHALL be returned and the backlog recommendation SHALL NOT fire

### Requirement: Streak-at-risk recommendation
When the learner has an active multi-day streak, has reviewed nothing today, and the day is nearly over, the engine SHALL recommend a short session framed around preserving the streak, linking to a duration-limited study session.

"Nearly over" SHALL be measured against the same calendar day that the reviewed-today count and the streak are bucketed in. Because those are keyed in UTC, the lateness test SHALL use the UTC hour. A local-hour test SHALL NOT be used while day keys are UTC: for a learner west of Greenwich the local evening falls in the *next* UTC day, whose review count is legitimately zero, and the rule would tell a learner who studied that morning that they had not studied today.

#### Scenario: Late in the day with an unstudied day and a live streak
- **WHEN** the learner has a 12-day streak, has reviewed 0 cards in the current day key, and the context time is late in that same UTC day
- **THEN** a streak-preserving recommendation SHALL fire referencing the 12-day streak
- **AND** its destination SHALL carry a short duration parameter

#### Scenario: Learner west of Greenwich who already studied
- **GIVEN** a learner at UTC-7 who reviewed 40 cards at 09:00 local, recorded against that moment's UTC day key
- **WHEN** the dashboard loads at 17:00 local, by which point the UTC day has rolled over
- **THEN** the streak-preserving recommendation SHALL NOT claim they have not studied today

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

The reader route SHALL exist before any writer begins recording a reading position. The application's catch-all route silently redirects unknown paths to the dashboard, so a recommendation offered ahead of its route would return the learner to where they started.

#### Scenario: Unfinished chapter resumes
- **WHEN** the context carries a last-read position for reader `r1`, chapter `c3`, 40% through
- **THEN** a recommendation to continue reading SHALL fire naming the reader
- **AND** its destination SHALL address reader `r1` and chapter `c3`

#### Scenario: Reading position without progress
- **WHEN** the context carries a valid last-read position that records no progress value
- **THEN** the recommendation SHALL still fire
- **AND** its detail text SHALL omit the percentage rather than showing a placeholder

#### Scenario: No reading data present
- **WHEN** the context carries no last-read position
- **THEN** no reading recommendation SHALL be produced
- **AND** the remaining recommendations SHALL be unaffected

#### Scenario: Malformed reading data ignored
- **WHEN** the context carries a last-read position missing its reader or chapter identifier
- **THEN** it SHALL be treated as absent
