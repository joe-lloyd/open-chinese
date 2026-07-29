## ADDED Requirements

### Requirement: Pro catalogue supports monthly and yearly intervals
The product catalogue SHALL define distinct `pro-monthly` and `pro-yearly` recurring entries with billing interval, interval count, euro display price, and entitlement target. Both SHALL grant the same Pro entitlement; only billing cadence and price differ. Checkout SHALL resolve each SKU to its own server-side provider Price id.

#### Scenario: Monthly Pro purchase
- **WHEN** an authenticated user purchases `pro-monthly`
- **THEN** hosted checkout SHALL use the configured monthly recurring Price
- **AND** a successful verified webhook SHALL grant Pro

#### Scenario: Yearly Pro purchase
- **WHEN** an authenticated user purchases `pro-yearly`
- **THEN** hosted checkout SHALL use the configured yearly recurring Price
- **AND** a successful verified webhook SHALL grant the same Pro access

### Requirement: Public pricing is configuration-driven and consistent
The app pricing page, paywall/upgrade surfaces, and Astro marketing pricing page SHALL render Pro amounts, intervals, annual equivalent, and savings from shared catalogue configuration or a generated shared pricing export. No public surface SHALL own a conflicting hard-coded Pro amount.

#### Scenario: Catalogue consistency test
- **WHEN** automated pricing tests compare every public Pro surface
- **THEN** monthly and yearly amounts and interval labels SHALL match the shared configuration

#### Scenario: Checkout remains authoritative
- **WHEN** the configured display price and the provider's actual Checkout price do not match during deployment verification
- **THEN** payments SHALL not be enabled until the mismatch is resolved
