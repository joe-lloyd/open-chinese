## ADDED Requirements

### Requirement: Responsive dashboard layout scales to available width
The dashboard SHALL be laid out mobile-first and SHALL progressively use additional horizontal space at wider breakpoints rather than remaining a fixed narrow column. The page container SHALL be capped at 1600px and centered.

At the base breakpoint every region SHALL be a single stacked column. At `md` (≥768px) regions that hold several small widgets SHALL flow into two columns. At `xl` (≥1280px) the dashboard SHALL split into a primary content region and a narrower secondary rail.

The page body SHALL NOT scroll horizontally at any viewport width. Content that is intrinsically wider than its container — the activity heatmap in particular — SHALL scroll inside its own container.

#### Scenario: Narrow viewport stacks every widget
- **WHEN** the dashboard is viewed at 375px wide
- **THEN** every widget SHALL occupy the full content width in a single column
- **AND** the page body SHALL NOT scroll horizontally

#### Scenario: Wide viewport uses the full width
- **WHEN** the dashboard is viewed at 1440px wide
- **THEN** the content SHALL fill a container up to 1600px wide
- **AND** the primary content region and the secondary rail SHALL render side by side

#### Scenario: Heatmap overflow is contained
- **WHEN** the 53-week activity heatmap is wider than its container
- **THEN** the heatmap SHALL scroll horizontally within its own card
- **AND** the surrounding page SHALL NOT gain a horizontal scrollbar

### Requirement: Study streak
The dashboard SHALL display the learner's current study streak and longest study streak in days, derived from the `dailyStats` documents already fetched for the activity heatmap. A day counts toward a streak when its `totalReviewed` is greater than zero.

The current streak SHALL be counted backwards from today. A day with no reviews today SHALL NOT break a streak that is still alive from yesterday — the streak SHALL be reported as intact until the day after the last studied day has fully passed.

#### Scenario: Consecutive study days counted
- **WHEN** the learner reviewed cards on each of the last five days including today
- **THEN** the current streak SHALL be reported as 5

#### Scenario: Today not yet studied keeps yesterday's streak alive
- **WHEN** the learner reviewed cards on each of the four days ending yesterday and has not studied today
- **THEN** the current streak SHALL be reported as 4

#### Scenario: Gap resets the streak
- **WHEN** the learner's most recent study day is three days ago
- **THEN** the current streak SHALL be reported as 0
- **AND** the longest streak SHALL still reflect the longest historical run

### Requirement: Upcoming review workload forecast
The dashboard SHALL display a forecast of scheduled reviews for the next 14 days, bucketed by day from the `nextReviewDate` of each word document. Words with status `Mastered`, `Leech` or `Unstudied` SHALL be excluded. Reviews already overdue SHALL be aggregated into the first bucket ("today") rather than dropped.

#### Scenario: Overdue cards fold into today
- **WHEN** 40 words have a `nextReviewDate` in the past and 10 are scheduled for today
- **THEN** the forecast's first bucket SHALL report 50

#### Scenario: Future days bucketed by date
- **WHEN** 12 words are scheduled three days from now
- **THEN** the bucket three days out SHALL report 12

#### Scenario: Mastered words excluded from the forecast
- **WHEN** a word has status `Mastered` with a `nextReviewDate` inside the 14-day window
- **THEN** it SHALL NOT be counted in any forecast bucket

### Requirement: Pronunciation versus meaning accuracy split
The dashboard SHALL display lifetime accuracy separately for the two graded subskills, computed by summing `correctPronCount` and `incorrectPronCount` across all word documents for pronunciation accuracy, and `correctMeaningCount` and `incorrectMeaningCount` for meaning accuracy. Each SHALL be expressed as a percentage of that subskill's total graded attempts.

#### Scenario: Split computed from per-word counters
- **WHEN** the learner's word documents sum to 800 correct and 200 incorrect pronunciation attempts, and 900 correct and 100 incorrect meaning attempts
- **THEN** pronunciation accuracy SHALL be shown as 80% and meaning accuracy as 90%

#### Scenario: No graded attempts yet
- **WHEN** every word document has zero pronunciation and meaning attempts
- **THEN** the split SHALL render an empty state rather than 0% or NaN

### Requirement: HSK level progress
The dashboard SHALL display, for each HSK level present in the static word database, the number of words the learner has studied out of that level's total, as a labelled progress meter. A word counts as studied when it has a user word document whose status is not `Unstudied`.

#### Scenario: Level progress reported
- **WHEN** HSK 1 contains 150 words and the learner has studied 120 of them
- **THEN** HSK 1 SHALL be reported as 120 / 150 and 80%

#### Scenario: Progress meter deep-links to study
- **WHEN** the learner activates an HSK level's progress row
- **THEN** the application SHALL navigate to the study route scoped to that level

### Requirement: Learning velocity
The dashboard SHALL display the number of new words seen per week over the last 12 weeks, summed from `dailyStats.newCardsSeen` for the days in each week. Weeks with no recorded activity SHALL be plotted as zero so the time axis stays continuous.

#### Scenario: Weekly new-word counts plotted
- **WHEN** the learner saw 20 new words spread across days in a given week
- **THEN** that week SHALL be plotted at 20

#### Scenario: Inactive week plotted at zero
- **WHEN** a week within the 12-week window has no `dailyStats` documents
- **THEN** that week SHALL be plotted at zero rather than omitted

### Requirement: Dashboard read budget
The dashboard SHALL derive every statistic it displays from a single batch of Firestore reads issued once per load: one collection read of `users/{uid}/words`, one range query over `users/{uid}/dailyStats`, and one document read of `users/{uid}`. It SHALL NOT issue a per-word or per-day follow-up read, and SHALL NOT issue additional reads as a side effect of adding statistics.

#### Scenario: No per-statistic fan-out
- **WHEN** the dashboard loads and renders streak, forecast, accuracy split, HSK progress and velocity
- **THEN** the number of Firestore queries issued SHALL be exactly three
- **AND** adding a statistic SHALL NOT increase that number

### Requirement: Unified chart presentation
Dashboard charts SHALL share one visual system: a single categorical palette in which a given lifecycle status maps to the same hue in every chart, axis and tooltip styling driven by the same theme tokens so charts read correctly in both light and dark themes, and a consistent empty state for series with no data.

#### Scenario: Status colour consistent across charts
- **WHEN** the `Weak` status appears in more than one chart
- **THEN** it SHALL be drawn in the same hue in each

#### Scenario: Charts legible in dark theme
- **WHEN** the application is in dark theme
- **THEN** axis labels, gridlines and tooltip surfaces SHALL use the dark theme tokens rather than fixed light-theme colours

## MODIFIED Requirements

### Requirement: Due cards summary
The system SHALL show a prominent counter on the dashboard for: cards due today, new cards available, and leeches requiring attention. Each counter SHALL link to the route that acts on it. The counters SHALL be laid out as a horizontal row when the dashboard is stacked and SHALL reflow to fit the secondary rail at `xl` without truncating their labels.

#### Scenario: Dashboard shows due card count
- **WHEN** user visits the dashboard
- **THEN** a summary card SHALL display the number of reviews due now and the count of leech words flagged

#### Scenario: Counters remain readable in the rail
- **WHEN** the dashboard is viewed at 1440px wide and the counters render inside the secondary rail
- **THEN** each counter's value and label SHALL remain fully visible without truncation
