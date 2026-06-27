# dashboard Specification

## Purpose
TBD - created by archiving change open-chinese. Update Purpose after archive.
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

### Requirement: Retention rate line chart
The system SHALL track and display a rolling retention rate: percentage of reviews answered Good or Easy (not Again or Hard) over the last 30 days, plotted as a line chart by day.

#### Scenario: Retention calculated from review history
- **WHEN** user answered 80 Good/Easy out of 100 reviews in the past 30 days
- **THEN** the retention line chart SHALL show an average of ~80% for that period

#### Scenario: Target band displayed on retention chart
- **WHEN** retention chart is rendered
- **THEN** a shaded target band between 85% and 90% SHALL be visible as a reference guide

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

