# dashboard Specification

## Purpose
Summarises the learner's progress on the landing page — study activity, vocabulary lifecycle distribution, retention, due workload, streaks, skill accuracy, HSK progress and leeches — from per-word and per-day Firestore aggregates, in a layout that is mobile-first and expands into the width a desktop gives it.
## Requirements
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

### Requirement: Activity heatmap
The system SHALL render a calendar heatmap showing daily study activity over a rolling 52-week (1-year) window. Each cell represents one day, colored by intensity proportional to cards reviewed that day.

#### Scenario: Active study day shown with color
- **WHEN** user reviewed 30 cards on a given day
- **THEN** that day's cell SHALL render with a non-zero intensity color

#### Scenario: No activity shown as empty cell
- **WHEN** no cards were reviewed on a given day
- **THEN** that day's cell SHALL render as the base/empty color (not hidden)

### Requirement: Vocabulary lifecycle stack chart
The system SHALL render a stacked bar or area chart showing the count of words in each lifecycle state: Unstudied, Weak, Strong, Memorized, Mastered. Chart SHALL update on page load to reflect current database state.

#### Scenario: Chart reflects current word distribution
- **WHEN** user has 200 Unstudied, 50 Weak, 30 Strong, 20 Memorized, 10 Mastered words
- **THEN** the chart SHALL show those exact proportions across the five state segments

### Requirement: Due cards summary
The system SHALL show a prominent counter on the dashboard for: cards due today, new cards available, and leeches requiring attention. Each counter SHALL link to the route that acts on it. The counters SHALL be laid out as a horizontal row when the dashboard is stacked and SHALL reflow to fit the secondary rail at `xl` without truncating their labels.

#### Scenario: Dashboard shows due card count
- **WHEN** user visits the dashboard
- **THEN** a summary card SHALL display the number of reviews due now and the count of leech words flagged

#### Scenario: Counters remain readable in the rail
- **WHEN** the dashboard is viewed at 1440px wide and the counters render inside the secondary rail
- **THEN** each counter's value and label SHALL remain fully visible without truncation

### Requirement: Leech management panel
The system SHALL display a list of words tagged as Leech with options to: reset the word's fail counter, suspend it indefinitely, or delete it.

#### Scenario: Leech word reset from dashboard
- **WHEN** user clicks Reset on a leech word
- **THEN** `consecutiveFails` SHALL be set to 0, status SHALL return to `Weak`, and the word SHALL re-enter the review queue

### Requirement: Retention rate from daily aggregates
The system SHALL track and display a rolling retention rate over the last 30 days, plotted as a line chart by day. Retention for a day SHALL be the percentage of that day's reviews where the user knew BOTH the pinyin and the meaning, computed as `correctCount / totalReviewed * 100` from the daily aggregate document at `users/{uid}/dailyStats/{date}`. The system SHALL NOT depend on per-review history documents, which no longer exist. Days on which no reviews were recorded SHALL be omitted from the series rather than plotted as 0%.

Daily aggregate documents written before the `correctCount` field existed record a `totalReviewed` greater than zero with no correct/incorrect split. The system SHALL distinguish an absent `correctCount` field from a recorded value of zero, and SHALL omit such days from the series rather than plotting them at 0%.

#### Scenario: Retention calculated from daily aggregates
- **WHEN** the dashboard loads and a day's `dailyStats` document records `totalReviewed: 100` and `correctCount: 80`
- **THEN** the retention line chart SHALL plot 80% for that day
- **AND** the value SHALL be derived from the `dailyStats` aggregates, not from a per-review history collection

#### Scenario: Both skills required for a review to count as correct
- **WHEN** the user knew the meaning but not the pinyin for a review
- **THEN** that review SHALL increment `incorrectCount` and SHALL NOT increment `correctCount`
- **AND** it SHALL lower that day's plotted retention rate

#### Scenario: Day with zero reviews is skipped
- **WHEN** a day within the 30-day window has no reviews recorded, or its aggregate reports `totalReviewed` of 0
- **THEN** that day SHALL be omitted from the retention series entirely
- **AND** the chart SHALL NOT plot a 0% point for that day

#### Scenario: Day predating the correctCount field is skipped
- **WHEN** a day's aggregate records `totalReviewed` greater than 0 but has no `correctCount` field at all
- **THEN** that day SHALL be omitted from the retention series
- **AND** the chart SHALL NOT plot a 0% point for that day

#### Scenario: Target band displayed on retention chart
- **WHEN** the retention chart is rendered
- **THEN** a shaded target band between 85% and 90% SHALL be visible as a reference guide
- **AND** the y-axis SHALL span 0% to 100%

#### Scenario: No aggregate data available
- **WHEN** the user has no `dailyStats` documents with recorded reviews in the last 30 days
- **THEN** the chart SHALL render an empty state rather than an empty or zeroed plot

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
The dashboard SHALL display a forecast of scheduled reviews for the next 14 days, bucketed by day from the `nextReviewDate` of each word document. Words with status `Mastered`, `Leech` or `Unstudied` SHALL be excluded. Reviews already overdue SHALL be aggregated into the first bucket ("today") rather than dropped, and that bucket SHALL be distinguishable from routine workload when it actually contains overdue reviews.

A word whose `nextReviewDate` cannot be interpreted as a date SHALL be omitted from the forecast entirely. It SHALL NOT be bucketed as overdue, and it SHALL NOT prevent the dashboard from rendering.

#### Scenario: Overdue cards fold into today
- **WHEN** 40 words have a `nextReviewDate` in the past and 10 are scheduled for today
- **THEN** the forecast's first bucket SHALL report 50
- **AND** that bucket SHALL be marked as containing overdue reviews

#### Scenario: Today bucket without overdue reviews
- **WHEN** cards are scheduled for today but none are overdue
- **THEN** the first bucket SHALL NOT be marked as containing overdue reviews

#### Scenario: Future days bucketed by date
- **WHEN** 12 words are scheduled three days from now
- **THEN** the bucket three days out SHALL report 12

#### Scenario: Mastered words excluded from the forecast
- **WHEN** a word has status `Mastered` with a `nextReviewDate` inside the 14-day window
- **THEN** it SHALL NOT be counted in any forecast bucket

#### Scenario: Uninterpretable review date does not break the page
- **WHEN** a word document carries a `nextReviewDate` that cannot be interpreted as a date
- **THEN** the word SHALL be omitted from every forecast bucket
- **AND** the dashboard SHALL render normally rather than replacing the page with an error

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

### Requirement: Available new word count reflects the study queue
The count of new words the dashboard reports as still available SHALL be derived by excluding every word that already has a user word document, not only those whose status has advanced past `Unstudied`. The study queue filters new cards against all existing document identifiers, so a count based on status would promise words the new-card queue will never serve — for example after a CSV import that creates documents with an unrecognised or blank status.

The count of words *studied*, and HSK level progress, SHALL continue to use the status-based definition.

#### Scenario: Imported unstudied documents are not offered as new
- **GIVEN** the static word database contains 5,000 words
- **AND** a CSV import created 1,000 documents whose status is `Unstudied`
- **WHEN** the dashboard reports how many new words are available
- **THEN** it SHALL report 4,000 rather than 5,000

#### Scenario: Studied count remains status-based
- **WHEN** the learner has 1,000 word documents of which 400 have advanced past `Unstudied`
- **THEN** the studied count SHALL be reported as 400

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

### Requirement: Day-keyed statistics share one calendar basis
Every statistic bucketed by day — the streak, the reviews-today count, the activity heatmap and the learning velocity series — SHALL use the same day-key basis as the `dailyStats` documents they read, and SHALL step between days in that key space rather than by mutating a local date. Any rule or label that interprets one of these statistics SHALL be evaluated against the same basis, so a claim about "today" is never tested against a different day than the one the data was bucketed in.

#### Scenario: Daylight saving transition neither skips nor duplicates a day
- **WHEN** a streak spans a daylight saving transition
- **THEN** each calendar day SHALL be counted exactly once

#### Scenario: Interpreting rule uses the same basis
- **WHEN** a rule tests how late in the day it is in order to interpret the reviews-today count
- **THEN** it SHALL measure lateness in the same calendar day that count is bucketed in

### Requirement: Unified chart presentation
Dashboard charts SHALL share one visual system: a single palette in which a given lifecycle status maps to the same hue in every chart, axis and tooltip styling driven by the same theme tokens so charts read correctly in both light and dark themes, and a consistent empty state for series with no data rendered at the height the chart would have occupied.

Lifecycle status SHALL be treated as an ordered progression rather than as unrelated identities, and SHALL therefore be encoded as a single-hue ramp whose lightness carries the order.

Colours reserved for status meaning SHALL NOT double as series colours, and SHALL always be accompanied by a visible label so that colour never carries the meaning alone.

#### Scenario: Status colour consistent across charts
- **WHEN** the `Weak` status appears in more than one chart
- **THEN** it SHALL be drawn in the same hue in each

#### Scenario: Lifecycle order visible in the colour
- **WHEN** the lifecycle chart is rendered
- **THEN** the progression from `Unstudied` to `Mastered` SHALL read as a monotone lightness ramp in a single hue

#### Scenario: Charts legible in dark theme
- **WHEN** the application is in dark theme
- **THEN** axis labels, gridlines and tooltip surfaces SHALL use the dark theme tokens rather than fixed light-theme colours

#### Scenario: Status colour carries a label
- **WHEN** a chart element is drawn in a reserved status colour
- **THEN** it SHALL also carry a visible label identifying what the status means
