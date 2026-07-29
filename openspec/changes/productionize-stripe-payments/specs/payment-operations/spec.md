## ADDED Requirements

### Requirement: Production payment configuration is validated
The server SHALL expose a pure configuration validation path for the selected payment provider. For Stripe it SHALL require the secret key, webhook signing secret, canonical application URL, and a Stripe Price id for every currently purchasable catalogue SKU. It SHALL NOT require price ids for hidden or unreleased catalogue entries.

#### Scenario: Stripe launch configuration is complete
- **GIVEN** Stripe is selected and every required server variable and live-SKU Price id is present
- **WHEN** payment configuration is validated
- **THEN** validation SHALL succeed without making a provider network request

#### Scenario: Live SKU has no Price id
- **GIVEN** a SKU is purchasable in the catalogue but its Stripe Price id is missing
- **WHEN** payment configuration is validated or checkout is requested for that SKU
- **THEN** the server SHALL reject the operation before calling Stripe
- **AND** SHALL identify the missing configuration in sanitized operator output

#### Scenario: Unreleased pack has no Price id
- **GIVEN** a pack is not exposed as purchasable
- **WHEN** payment configuration is validated
- **THEN** its absent Price id SHALL NOT make production configuration invalid

### Requirement: Payment failures are safe and actionable
Payment endpoints SHALL map configuration and provider failures to stable HTTP statuses and public error codes. Public responses SHALL contain no secret, stack trace, raw provider payload, service-account detail, or environment-variable value. The app SHALL translate a temporary payment failure into a retryable message without falsely indicating that a purchase succeeded.

#### Scenario: Provider is unavailable
- **WHEN** Stripe checkout creation fails transiently
- **THEN** the endpoint SHALL return a retryable 5xx response with a stable public code
- **AND** the client SHALL keep the user in OpenChinese and offer retry/back actions

#### Scenario: Server is misconfigured
- **WHEN** a required Stripe setting is absent
- **THEN** the endpoint SHALL respond with a payment-unavailable status
- **AND** the response body SHALL NOT name or reveal a secret value

### Requirement: Operators have a payment launch and recovery runbook
The repository SHALL document test/live resource separation, required environment variables, hosted payment-method configuration, required webhook events, local verification, post-deploy smoke tests, monitoring, key rotation, VAT ownership, incident response, and the payments-disabled rollback.

#### Scenario: Operator prepares a live deployment
- **WHEN** an operator follows the runbook
- **THEN** they SHALL be able to configure Stripe Checkout, Customer Portal, prices, and webhooks without inferring undocumented values from code

#### Scenario: Checkout must be stopped quickly
- **WHEN** an operator activates the documented payments-disabled rollback
- **THEN** new purchase prompts and checkout attempts SHALL stop
- **AND** existing user data and entitlements SHALL remain intact

### Requirement: Provider selection has explicit review triggers
The repository SHALL record Stripe as the launch provider and SHALL document that the decision must be revisited when processed volume qualifies for negotiated pricing, tax administration becomes material, geographic/payment-method requirements are unmet, or the measured blended fee materially exceeds an alternative.

#### Scenario: Launch assumptions change
- **WHEN** any documented review trigger is reached
- **THEN** operators SHALL compare current effective fees and operational burden before changing the provider adapter
