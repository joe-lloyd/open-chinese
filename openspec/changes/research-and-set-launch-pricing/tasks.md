## 1. Market and Cost Research

- [x] 1.1 Write a dated source-linked competitor matrix for Du Chinese, The Chairman's Bao, Mandarin Bean, and any verified relevant alternative
- [x] 1.2 Record Firebase Auth/Firestore free quotas and an editable 100/1,000/10,000-MAU operations model
- [x] 1.3 Record Stripe Payments/Billing fees, 21% planning VAT assumption, exclusions, and monthly/yearly contribution calculations
- [x] 1.4 Record Google/Meta advertising benchmarks as secondary evidence and define the €12 paid-conversion CAC guardrail
- [x] 1.5 Add a sensitivity table for tax, payment mix, conversion, refunds, and CAC, clearly separating facts from assumptions

## 2. Catalogue and Checkout Mapping

- [x] 2.1 Extend catalogue types with recurring billing interval metadata
- [x] 2.2 Add `pro-monthly` at €4.99 and update `pro-yearly` to €39 while leaving pack pricing unchanged
- [x] 2.3 Add the monthly Stripe Price environment mapping and ensure webhook translation grants the same Pro entitlement for either SKU
- [x] 2.4 Add tests for both recurring SKUs, derived annual savings, and entitlement equivalence

## 3. Pricing Surfaces

- [x] 3.1 Update the React pricing page and upgrade/paywall entry points to offer monthly and recommended yearly plans
- [x] 3.2 Update the Astro marketing pricing surface from shared/generated configuration with accurate interval and savings copy
- [x] 3.3 Add consistency tests that fail if app, marketing, or catalogue Pro prices diverge
- [x] 3.4 Update environment and deployment documentation to verify displayed prices against Stripe Price amounts/intervals

## 4. Verification

- [x] 4.1 Run app/site/functions tests, typecheck, and production builds
- [x] 4.2 Verify pricing layouts at mobile and desktop widths and confirm no old €25 Pro claim remains
- [x] 4.3 Mark completed OpenSpec tasks and summarize recommendation, assumptions, and launch metrics in the PR description
