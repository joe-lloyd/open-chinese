# Payment provider decision

Decision date: 29 July 2026. Owner: OpenChinese product/engineering.

## Decision

OpenChinese will launch with Stripe through its existing `PaymentProvider`
adapter and hosted Checkout. Stripe selects the eligible methods for each
Checkout Session; OpenChinese does not maintain card fields or force a
card-only method list.

Published self-service pricing checked on the decision date:

| Provider | Relevant published price | Reach and methods | Tax role | Launch assessment |
|---|---|---|---|---|
| [Stripe Netherlands](https://stripe.com/en-nl/pricing) | Standard EEA cards: 1.5% + €0.25; iDEAL: €0.29. Billing pay-as-you-go adds 0.7% of Billing volume. | 135+ currencies, 100+ payment methods, 195 countries | Processor; OpenChinese owns VAT/OSS | Selected: broad practical reach, low direct launch cost, mature hosted flow, and an existing adapter |
| [Mollie Netherlands](https://www.mollie.com/nl/pricing?country=nl&currency=EUR) | EEA consumer cards: 1.8% + €0.25; iDEAL/Wero: €0.32 | Strong European local-method coverage | Processor; OpenChinese owns VAT/OSS | Good Netherlands-focused fallback, but slightly higher listed core fees and requires a new adapter |
| [Paddle](https://www.paddle.com/pricing) | 5% + $0.50 per Checkout transaction | Global SaaS checkout | Merchant of Record | Higher fee buys tax/compliance handling; reconsider if that work outweighs the margin |
| [Polar](https://docs.polar.sh/merchant-of-record/fees) | Merchant-of-Record base fee plus documented international/subscription surcharges | SaaS/digital-product checkout | Merchant of Record | Operationally appealing, but materially costlier for a low-price annual plan |
| [Adyen Netherlands](https://www.adyen.com/nl_NL/tarieven/) | €0.11 processing plus payment-method/interchange fee | Broad enterprise-grade global acquiring | Processor; OpenChinese owns VAT/OSS | Reconsider at scale; sales-led onboarding and operational complexity are premature |

Published prices are inputs, not guaranteed effective rates. The operator must
review current contract terms before live activation.

## Why Stripe

- The repository already has authenticated checkout and portal functions,
  signed webhook translation, idempotent entitlement updates, and Stripe tests.
- Hosted Checkout keeps payment credentials outside OpenChinese and lets Stripe
  display methods compatible with country, currency, device, and subscription
  mode. A method such as iDEAL is not promised for every recurring session.
- Test/live resources are isolated, Customer Portal is hosted, and webhook
  delivery/retry tooling is mature.
- The provider interface remains intact, so this decision does not couple
  entitlement storage or client UI to Stripe vocabulary.

Stripe is a payment processor, not the seller of record. OpenChinese remains
responsible for determining customer location, configuring tax collection,
registering where required, filing VAT/OSS returns, invoices, and refunds.
Obtain accounting advice before taking live payments.

## Review triggers

Repeat this comparison when any of these becomes true:

- processed volume exceeds €100,000 per month or qualifies for negotiated rates;
- the measured all-in Stripe fee is materially above an alternative;
- VAT/tax support for non-EEA revenue consumes enough time or professional fees
  to outweigh a Merchant-of-Record premium;
- a required country, currency, payout route, or payment method is unavailable;
- authorization, dispute, fraud, or payout reliability misses the team's target.

Compare effective fees from actual statements, conversion by payment method,
support burden, tax/admin cost, and migration risk before changing adapters.
