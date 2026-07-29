## 1. Provider Decision and Configuration

- [x] 1.1 Add a dated provider comparison recording fees, method/geographic reach, Merchant of Record distinction, selection rationale, and revisit triggers
- [x] 1.2 Update environment documentation to make Stripe the launch provider and distinguish test/live keys, Price ids, webhook secrets, and canonical URL
- [x] 1.3 Implement a pure server configuration validator for provider settings and currently purchasable SKU Price ids
- [x] 1.4 Add unit tests for complete, missing, hidden-SKU, unknown-provider, and disabled-payment configurations

## 2. Checkout and Failure Hardening

- [x] 2.1 Verify Stripe Checkout delegates eligible payment-method selection rather than hard-coding a card-only list
- [x] 2.2 Map configuration/provider failures to stable sanitized endpoint responses and operator logs
- [x] 2.3 Update client checkout handling with retry/back behavior and no false success state
- [x] 2.4 Ensure portal ownership, uid binding, catalogue validation, and return URL behavior remain enforced

## 3. Lifecycle Tests

- [x] 3.1 Add mocked Stripe contract tests for checkout session shape and provider-managed methods
- [x] 3.2 Add or complete tests for raw-body signature rejection, duplicate delivery, interrupted delivery, and unhandled events
- [x] 3.3 Add or complete tests for activation, cancellation/expiry, stale subscription events, and additive pack grants
- [x] 3.4 Run functions/app tests, typecheck, and production builds without live Stripe credentials

## 4. Operations

- [x] 4.1 Write the launch runbook covering Stripe resources, dashboard methods, webhook events, local verification, live smoke tests, monitoring, and rotation
- [x] 4.2 Document VAT/OSS ownership, Merchant of Record alternatives, manual recovery, and the payments-disabled rollback
- [x] 4.3 Mark completed OpenSpec tasks and summarize security/operational decisions in the PR description
