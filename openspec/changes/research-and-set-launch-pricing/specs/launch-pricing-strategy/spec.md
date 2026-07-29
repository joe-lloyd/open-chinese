## ADDED Requirements

### Requirement: Pricing research is dated and reproducible
The repository SHALL contain a report dated 29 July 2026 that links to primary provider, Firebase, and competitor pricing sources and clearly labels secondary advertising benchmarks. Every calculation SHALL list currency, tax assumption, payment-fee assumption, usage assumption, and exclusions so it can be recomputed when inputs change.

#### Scenario: Operator reviews a recommendation
- **WHEN** an operator reads the pricing report
- **THEN** they SHALL be able to distinguish sourced facts from OpenChinese assumptions
- **AND** SHALL be able to reproduce the annual and monthly contribution calculations

### Requirement: Launch offer has monthly and yearly choices
OpenChinese Pro SHALL be offered at a VAT-inclusive displayed price of €4.99 billed monthly and €39 billed yearly. The yearly plan SHALL be presented as the recommended option and SHALL accurately state its discount relative to twelve monthly payments. Prices SHALL not be described as permanent or discounted from an invented former price.

#### Scenario: Visitor compares plans
- **WHEN** a visitor opens an OpenChinese pricing surface
- **THEN** they SHALL see monthly and yearly billing intervals
- **AND** the yearly option SHALL be identified as recommended
- **AND** the displayed annual saving SHALL be calculated from the configured prices

#### Scenario: Price changes later
- **WHEN** an operator changes a configured price
- **THEN** all derived monthly equivalents and savings text SHALL update from configuration
- **AND** SHALL not require editing hard-coded marketing sentences

### Requirement: Unit economics model includes material launch costs
The pricing report SHALL model VAT, Stripe Payments and Billing fees, Firebase Authentication/Firestore usage, refunds or disputes as a tracked sensitivity, and paid acquisition. It SHALL include editable scenarios for 100, 1,000, and 10,000 monthly active users and SHALL not imply that free-tier quotas make infrastructure permanently free.

#### Scenario: Usage grows above Firebase free quota
- **WHEN** the 10,000-MAU scenario exceeds a daily Firestore allowance
- **THEN** the model SHALL calculate only usage above the free allowance using a configurable location-specific rate

#### Scenario: Payment mix changes
- **WHEN** the share of international cards or non-card methods changes
- **THEN** the model SHALL support replacing the standard EEA fee assumption
- **AND** SHALL preserve the original sourced baseline for comparison

### Requirement: Paid acquisition is governed by measured contribution
Paid acquisition SHALL begin as a bounded experiment. Annual first-purchase CAC SHALL target €12 or less. A channel SHALL NOT receive a scale increase until it has at least 20 attributed paid conversions at or below the cap and the cohort meets the documented activation check. A channel above the cap SHALL be paused or redesigned rather than justified by click volume alone.

#### Scenario: Campaign has cheap clicks but expensive customers
- **GIVEN** a campaign's click metrics look favorable but attributed paid CAC exceeds €12
- **WHEN** its initial test budget is exhausted
- **THEN** the campaign SHALL not scale

#### Scenario: Campaign qualifies for cautious scaling
- **GIVEN** a channel has at least 20 attributed annual purchases at CAC no greater than €12
- **WHEN** the cohort also meets the activation check
- **THEN** the channel SHALL become eligible for a bounded next budget increment
- **AND** SHALL remain monitored by cohort

### Requirement: Pricing is reviewed on evidence
Operators SHALL review price, realized payment fee, Firebase cost per active user, checkout conversion, plan mix, refunds, acquisition CAC, activation, and retention monthly during launch and at least quarterly after stabilization. A material assumption change SHALL trigger an updated dated recommendation.

#### Scenario: Retention data becomes available
- **WHEN** three months of paid cohort retention exists
- **THEN** the CAC guardrail SHALL be re-evaluated using measured contribution LTV
- **AND** the original first-purchase guardrail SHALL remain documented
