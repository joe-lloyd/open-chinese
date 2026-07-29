## Context

The repository already contains a production-shaped payment boundary: authenticated Netlify checkout/portal endpoints, a `PaymentProvider` interface, Stripe and Coinbase adapters, signed/idempotent webhooks, Firestore entitlements, a client return screen, and hosted checkout. The remaining problem is operational ambiguity. `.env.example` describes the provider as undecided, configuration errors surface late, and no launch runbook proves the full lifecycle.

Provider research was checked on 29 July 2026:

- [Stripe Netherlands pricing](https://stripe.com/en-nl/pricing): no setup/monthly fee; standard EEA cards 1.5% + €0.25, iDEAL €0.29, 135+ currencies, 100+ payment methods, and availability in 195 countries. Stripe Billing pay-as-you-go adds 0.7% of billing volume.
- [Mollie Netherlands pricing](https://www.mollie.com/nl/pricing?country=nl&currency=EUR): EEA consumer cards 1.8% + €0.25 and iDEAL/Wero €0.32, with strong European method coverage but fewer payout currencies and a new adapter required.
- [Paddle pricing](https://www.paddle.com/pricing): 5% + $0.50 with Merchant of Record tax/compliance included.
- [Polar fees](https://docs.polar.sh/merchant-of-record/fees): Merchant of Record pricing is materially higher than direct processing and may add international/subscription charges.
- [Adyen Netherlands pricing](https://www.adyen.com/nl_NL/tarieven/): €0.11 processing plus method/interchange pricing, but its sales-led, enterprise-oriented operating model is premature for launch.

Stripe wins on launch cost, reach, reliability maturity, existing implementation, and migration risk. It does not solve VAT filing; that responsibility is documented explicitly rather than obscured.

## Goals / Non-Goals

**Goals:**

- Make Stripe the unambiguous, deployable launch provider.
- Present the widest set of eligible payment methods without custom payment UI.
- Fail safely and readably when provider configuration is incomplete.
- Prove subscription, one-off pack, portal, webhook, and rollback behavior.
- Retain the provider interface and a documented reconsideration threshold.

**Non-Goals:**

- Becoming a Merchant of Record or automating VAT returns.
- Replacing hosted Stripe Checkout with embedded card fields.
- Adding a second production adapter in this change.
- Creating Stripe products/prices or secrets from repository code.
- Changing product prices; that belongs to the pricing proposal.

## Decisions

### Select Stripe and keep the adapter boundary

`PAYMENT_PROVIDER=stripe` becomes the documented production value. The registry and `PaymentProvider` interface remain intact. Coinbase stays non-default and explicitly unsupported for recurring launch subscriptions.

Alternative: Mollie. It is an excellent Netherlands-focused provider, but its published EEA card and iDEAL fees are slightly higher than Stripe's, global breadth is lower, and adopting it would discard already-tested integration work.

Alternative: Paddle or Polar. Merchant of Record services reduce tax administration, but their materially higher per-transaction price damages a low annual price. Revisit when non-EU sales or tax/accounting work outweigh the spread.

Alternative: Adyen. Potentially attractive at scale, but the pricing/contract/onboarding model is not the cheapest operational choice for an early product.

### Let hosted Checkout determine eligible methods

Checkout Sessions will not hard-code `payment_method_types`. Stripe's dashboard and automatic method eligibility will determine which compatible methods are shown for the transaction's currency, country, mode, and Price. This keeps cards, Apple Pay/Google Pay, Link, and compatible local methods current without code deployments.

Not every one-time method supports recurring subscriptions. Tests assert that OpenChinese does not promise a specific method; the provider displays only methods compatible with that Checkout Session.

### Validate configuration at the server boundary

A pure configuration inspector will validate the provider, secret/webhook keys, public app URL, and only the price mappings for live catalogue SKUs. Checkout/portal/webhook functions will translate missing configuration into stable, non-secret error codes and operator logs. The client receives a helpful “payments temporarily unavailable” message, never an environment-variable name or provider stack trace.

### Add contract tests around security and lifecycle

Tests use mocked Stripe SDK boundaries; they do not call Stripe. Coverage includes verified uid binding, unknown SKU rejection, generated success/cancel URLs, automatic-method behavior, raw-body signature verification, duplicate events, stale subscription events, additive pack grants, canceled/expired subscriptions, portal ownership, and configuration failures.

### Write an operator runbook

The runbook covers test/live key separation, product/price setup, dashboard method configuration, webhook endpoint/events, local Stripe CLI verification, post-deploy smoke tests, secret rotation, VAT ownership, incident response, and the `VITE_PAYMENTS_ENABLED=false` rollback.

## Risks / Trade-offs

- [Stripe is not the tax seller] → Document VAT/OSS ownership and revisit a Merchant of Record before broad non-EU expansion.
- [Automatic methods vary by customer] → Describe them as “eligible methods” and never promise iDEAL or a wallet for every subscription.
- [Configuration validation blocks a deliberately unpriced pack] → Validate only live catalogue SKUs and keep unreleased packs out of the purchasable catalogue.
- [Provider errors expose secrets] → Map to stable public codes and log sanitized context only.
- [Webhook regression removes paid access] → Keep idempotency/out-of-order tests, monitor Stripe delivery failures, and document a manual entitlement-grant recovery path.

## Migration Plan

1. Create matching Stripe test-mode products/prices for currently purchasable SKUs.
2. Configure test environment variables and automatic payment methods.
3. Register a test webhook endpoint and execute the runbook's lifecycle smoke tests.
4. Repeat with live-mode resources and deploy with payments disabled.
5. Verify configuration/health, then enable payments.
6. Roll back by setting `VITE_PAYMENTS_ENABLED=false`; existing entitlements remain readable and no data migration is needed.

## Open Questions

None for launch. Re-evaluate provider selection when monthly processed volume exceeds €100,000, when a meaningful non-EEA revenue share makes tax administration material, or when Stripe's effective blended fee is no longer competitive.
