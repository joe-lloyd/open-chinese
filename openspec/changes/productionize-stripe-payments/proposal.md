## Why

OpenChinese already has a provider-agnostic checkout, webhook, portal, and entitlement architecture, but it lacks a documented production provider decision and operational safeguards. Stripe is the best launch fit because it has the lowest published EEA card fee among the evaluated broad providers, offers extensive international and local-method coverage, and is already implemented in this repository, avoiding a risky payment rewrite.

## What Changes

- Adopt Stripe as the documented production launch provider while retaining the existing adapter boundary for future providers.
- Configure hosted Stripe Checkout to present eligible payment methods automatically, with card and location-compatible wallets/local methods selected by Stripe.
- Add fail-fast server configuration validation, safe client-facing payment-unavailable responses, and deployment/runbook documentation.
- Harden and test checkout ownership, return URLs, webhook verification/idempotency, subscription lifecycle handling, pack grants, and billing-portal access.
- Record the provider comparison and revisit triggers for Mollie, Paddle/Polar, and Adyen, including the distinction between payment processing and Merchant of Record tax handling.

## Capabilities

### New Capabilities

- `payment-operations`: Defines production configuration, health checks, observability-safe errors, deployment verification, and incident/rollback procedures.

### Modified Capabilities

- `monetization`: Makes Stripe the launch provider, requires automatic eligible payment-method presentation in hosted checkout, and strengthens production failure behavior and lifecycle verification.

## Impact

- Affects Netlify payment functions, the Stripe adapter/provider registry, checkout client error handling, environment documentation, and payment tests.
- Uses the existing `stripe` dependency and hosted Checkout/Customer Portal; no card data enters OpenChinese.
- Introduces no entitlement-schema migration and keeps provider swapping possible through the existing interface.
- Stripe remains a payment processor, not Merchant of Record; VAT registration, collection configuration, and filing remain an operator responsibility.
