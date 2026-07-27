# dashboard Specification

## Purpose
Summarises the learner's progress on the landing page — study activity, vocabulary lifecycle distribution, retention, due workload and leeches — from per-word and per-day Firestore aggregates.
## Requirements
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
The system SHALL show a prominent counter on the dashboard for: cards due today, new cards available, and leeches requiring attention.

#### Scenario: Dashboard shows due card count
- **WHEN** user visits the dashboard
- **THEN** a summary card SHALL display the number of reviews due now and the count of leech words flagged

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

