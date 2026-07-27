## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Retention rate line chart
**Reason**: The requirement defined retention as the "percentage of reviews answered Good or Easy (not Again or Hard)" over the last 30 days. That describes a four-button Anki-style rating scale this application has never had. The study flow is two binary self-assessments — knew pinyin, knew meaning — and the SRS engine derives only `Good`, `Hard` or `Again` from them; `Easy` is never produced, so the stated grading buckets cannot be evaluated. Its "Retention calculated from review history" scenario also depends on the per-review history collection deleted in commit `5986ae3`, leaving the requirement with no data source and the chart permanently showing its empty state.

**Migration**: Replaced by `Retention rate from daily aggregates`, which defines retention against the binary self-assessment the app actually performs and sources it from the `correctCount` / `totalReviewed` counters already written per day to `users/{uid}/dailyStats/{date}`. The "Target band displayed on retention chart" scenario carries over unchanged. No data migration is required — the aggregates are already being written — but days recorded before the `correctCount` field existed cannot be backfilled and are omitted from the series.
