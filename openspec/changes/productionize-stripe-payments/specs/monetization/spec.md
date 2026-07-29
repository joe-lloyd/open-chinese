## MODIFIED Requirements

### Requirement: Payment funnel uses hosted checkout only
The system SHALL never collect, transmit or store card numbers, CVCs, bank details or any other sensitive payment data. All payment collection SHALL occur on Stripe's hosted Checkout page for launch, through the provider adapter. Checkout SHALL allow Stripe to present payment methods that are eligible for the customer's location, currency, device, and transaction mode rather than hard-coding a card-only list. No payment provider secret key SHALL be present in the client bundle or in any `VITE_`-prefixed variable.

#### Scenario: Upgrade flow
- **WHEN** a user selects a plan or pack and confirms
- **THEN** the client SHALL request a checkout URL from the server-side checkout endpoint
- **AND** SHALL redirect the browser to Stripe's hosted page
- **AND** SHALL render no payment input fields of its own

#### Scenario: Eligible methods are provider-managed
- **WHEN** the server creates a Stripe Checkout Session
- **THEN** it SHALL NOT hard-code a card-only `payment_method_types` list
- **AND** Stripe SHALL determine the compatible enabled methods for that session

#### Scenario: Recurring method is incompatible
- **GIVEN** a locally enabled payment method cannot create a reusable mandate for the selected subscription
- **WHEN** Stripe renders the subscription Checkout Session
- **THEN** that method SHALL not be promised or forced by OpenChinese
- **AND** compatible methods SHALL remain available

#### Scenario: No secrets in the client bundle
- **WHEN** the client bundle is built
- **THEN** it SHALL contain no payment provider secret key, webhook signing secret, or Firebase service account credential

### Requirement: Payment provider integration is swappable behind one interface
All provider-specific behaviour SHALL be confined to an adapter implementing a `PaymentProvider` interface exposing checkout session creation, billing portal session creation, webhook verification, and translation of a verified event into an entitlement update. Stripe SHALL be the documented launch provider and the active provider SHALL be selected by a server-side environment variable. Adding a provider, including a cryptocurrency processor, SHALL require implementing that interface and registering it, with no change to the endpoints, entitlement model, or UI.

#### Scenario: Production launch provider
- **WHEN** an operator configures the production environment according to the runbook
- **THEN** `PAYMENT_PROVIDER` SHALL select the registered Stripe adapter

#### Scenario: Provider swap
- **WHEN** the active provider environment variable is changed to another registered adapter
- **THEN** the checkout, portal and webhook endpoints SHALL operate against the new provider with no other code change

#### Scenario: No provider configured
- **WHEN** no provider is configured
- **THEN** the checkout endpoint SHALL respond 503
- **AND** the client SHALL present payments as unavailable rather than failing opaquely

#### Scenario: Provider vocabulary stays in the adapter
- **WHEN** the webhook endpoint handles an event
- **THEN** it SHALL not reference any provider-specific event name or payload field directly

## ADDED Requirements

### Requirement: Stripe payment lifecycle is covered by contract tests
Automated tests SHALL cover authenticated checkout ownership, catalogue validation, return URL construction, Customer Portal ownership, webhook signature verification, duplicate delivery, out-of-order subscription events, subscription activation/cancellation/expiry, and additive one-off pack grants at the provider boundary.

#### Scenario: Payment test suite runs without live Stripe calls
- **WHEN** the repository test suite executes
- **THEN** payment lifecycle tests SHALL use mocked provider SDK boundaries
- **AND** SHALL require no Stripe secret or network connection
