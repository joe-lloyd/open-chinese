# OpenChinese launch pricing recommendation

**Research date:** 29 July 2026
**Recommendation:** launch Pro at **€4.99/month** or **€39/year**, displayed VAT-inclusive. Recommend the yearly plan.

This is a launch hypothesis, not a promise of profitability. Public list prices and
provider fees were checked on the date above. OpenChinese assumptions are explicitly
labelled and can be recomputed with `pnpm pricing:model`.

## Executive decision

The yearly offer is deliberately below the closest specialist reading products while
leaving materially more first-year contribution than the previous €25 idea. Twelve
monthly payments total €59.88, so €39/year saves €20.88, or 35%. Both intervals grant
the same Pro entitlement.

Use the launch period to validate willingness to pay and retention. Do not scale a paid
channel until it produces at least 20 attributed annual purchases at CAC no greater
than €12 and the cohort meets the activation check defined below.

## Market evidence

These are public web prices, quoted in their published currencies. They are not
currency-converted, and temporary promotions, app-store regional prices, classroom
plans, and taxes may differ.

| Product | Free entry | Monthly | Yearly | Positioning / source |
|---|---|---:|---:|---|
| Du Chinese | Limited free lessons | $14.99 | $119.99 | Large Mandarin graded-reading library; [official pricing](https://duchinese.net/pricing) |
| The Chairman's Bao | Sample content | $11 | $88 | Graded news and reading app; [official plans](https://www.thechairmansbao.com/plans/) |
| Mandarin Bean | Limited free content | — | $49 | Lower-priced reading benchmark; one-time payment for 12 months rather than auto-renewing; [official plan](https://mandarinbean.com/subscription-plan/) |
| OpenChinese launch | Half of HSK 1 | €4.99 | €39 | SRS, HSK path, dictionary, reader library, and browser-based audio/pronunciation features |

Inference: OpenChinese should enter below established specialist readers because its
library and retention are not yet proven. A €39 annual price is still close enough to
Mandarin Bean's lower tier to avoid communicating “throwaway” value.

## Sourced operating inputs

| Input | Sourced fact checked 29 July 2026 | Model treatment |
|---|---|---|
| Stripe Payments, standard EEA card | 1.5% + €0.25; no setup or monthly account fee on standard pricing ([Stripe Netherlands](https://stripe.com/en-nl/pricing)) | Baseline variable fee |
| Stripe Billing | Pay-as-you-go Billing is 0.7% of Billing volume ([Stripe Netherlands](https://stripe.com/en-nl/pricing)) | Added to recurring revenue |
| Firebase Authentication | Identity Platform pricing includes a 50,000 MAU no-cost tier for most providers; phone auth is separate ([Firebase pricing](https://firebase.google.com/pricing)) | No early auth charge through the modelled 10,000 MAU; Google sign-in only |
| Cloud Firestore free quota | 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day, 1 GiB stored data, and 10 GiB/month outbound ([Firestore pricing](https://firebase.google.com/docs/firestore/pricing)) | Read/write overage is modelled; storage, deletes, PITR/backups, and egress remain monitored exclusions |
| Illustrative Firestore rates | Google's billing example uses $0.06/100k reads and $0.18/100k writes ([official billing example](https://firebase.google.com/docs/firestore/billing-example)) | Editable example only; replace with the deployed database location's current rate |
| Netherlands VAT | The Dutch standard VAT rate is 21% ([European Commission Taxes in Europe](https://ec.europa.eu/taxation_customs/tedb/#/vat-search)) | Planning assumption for a VAT-inclusive price; actual tax follows customer location and the operator's registrations |

Static HSK databases and reader files are CDN assets, not Firestore reads. Browser
speech synthesis is performed on-device. Netlify hosting, support, content creation,
refund administration, accounting, and founder time are excluded from the Firebase
number and must not be mistaken for zero cost.

## Reproducible contribution calculations

### Baseline assumptions

- Currency: EUR for product/payment calculations; USD for illustrative Firestore rates.
- Display prices include 21% VAT.
- Payment mix: 100% standard EEA cards at 1.5% + €0.25.
- Billing fee: 0.7% of gross recurring amount.
- Refund/dispute allowance: 0% in the baseline, varied below.
- Infrastructure and CAC: excluded from “before acquisition” contribution.

Formula:

```text
revenue ex VAT = gross price / (1 + VAT rate)
payment fee = gross price × payment percent + fixed fee
billing fee = gross price × Billing percent
contribution before acquisition = revenue ex VAT − payment fee − billing fee − refund allowance
```

| Offer | Gross | Revenue ex 21% VAT | Stripe Payments | Stripe Billing | Before infrastructure / refunds / CAC |
|---|---:|---:|---:|---:|---:|
| Monthly | €4.99 | €4.12 | €0.32 | €0.03 | **€3.76/month** |
| Yearly | €39.00 | €32.23 | €0.84 | €0.27 | **€31.12/year** |
| Rejected €25 yearly alternative | €25.00 | €20.66 | €0.63 | €0.18 | €19.85/year |

At the €12 CAC guardrail, the recommended annual offer retains about €19.12 of
first-year contribution before Firebase, hosting, refunds, support, and content.

## Editable Firebase scale model

OpenChinese assumptions: 20% DAU/MAU, 120 document reads and 15 writes per daily
active user, 30 days/month, no billable deletes. The operations values are deliberately
conservative placeholders until production telemetry exists.

| MAU | Assumed DAU | Reads/day | Writes/day | Billable reads/month | Billable writes/month | Illustrative Firestore cost |
|---:|---:|---:|---:|---:|---:|---:|
| 100 | 20 | 2,400 | 300 | 0 | 0 | $0.00 |
| 1,000 | 200 | 24,000 | 3,000 | 0 | 0 | $0.00 |
| 10,000 | 2,000 | 240,000 | 30,000 | 5.7m | 300k | about $3.96/month |

The estimate applies free quotas per day and charges only overage. It does not assert
that Firebase stays free: multi-database use, listener reconnects, security-rule
dependent reads, storage, index-entry reads, egress, backups, or a different region can
change the result.

To edit assumptions without changing the script:

```powershell
$env:PRICING_READS_PER_DAU_DAY='180'
$env:PRICING_WRITES_PER_DAU_DAY='25'
$env:PRICING_READ_USD_PER_100K='0.08'
pnpm pricing:model
```

## Scale scenario (assumption, not forecast)

For directional planning only, assume 5% of MAU pays, 80% of paid users choose yearly,
and annual revenue/contribution is accrued monthly. No churn, failed payments, refunds,
or new acquisition timing is represented.

| MAU | Assumed paid users | Yearly / monthly mix | Gross recurring value per month | Contribution before Firebase / CAC |
|---:|---:|---:|---:|---:|
| 100 | 5 | 4 / 1 | €17.99 | €14.14 |
| 1,000 | 50 | 40 / 10 | €179.90 | €141.38 |
| 10,000 | 500 | 400 / 100 | €1,799.00 | €1,413.35 |

The conversion and plan mix are editable business assumptions, not competitor facts.
Replace them with actual checkout and cohort data.

## Sensitivity and failure conditions

Yearly contribution before infrastructure and acquisition:

| Change from baseline | Result | Interpretation |
|---|---:|---|
| 0% VAT assumption | €37.89 | Upper bound only; not a valid default for EU consumer sales |
| 21% VAT, standard EEA card | €31.12 | Baseline |
| 25% VAT | €30.09 | Higher-tax customer sensitivity |
| International card at 3.25% + €0.25 | €30.44 | Payment mix lowers contribution |
| iDEAL at €0.29, no percentage payment fee | €31.67 | Method-specific example; eligibility and recurring support must be checked in Stripe |
| 2% gross refund allowance | €30.34 | Track actual refunds and disputes separately |
| €12 annual first-purchase CAC | €19.12 | Launch guardrail |
| €20 annual first-purchase CAC | €11.12 | Do not scale at this level before measured renewal LTV supports it |

The method fee examples come from [Stripe Netherlands pricing](https://stripe.com/en-nl/pricing).
Actual results depend on country, card, currency conversion, payment method, taxes,
failed payments, and disputes.

## Advertising evidence and guardrail

Advertising figures are **secondary industry benchmarks**, not OpenChinese forecasts:

- WordStream's [2025 Google Ads benchmarks](https://www.wordstream.com/blog/2025-google-ads-benchmarks)
  report an Education & Instruction search CPC of $6.23 and CPL of $90.02.
- LocaliQ's [2025 Facebook benchmark](https://localiq.com/blog/facebook-advertising-benchmarks/)
  reports an Education & Instruction traffic CPC of $0.86.

At €0.86 per click, click-to-paid conversion produces roughly:

| Click-to-paid conversion | Implied CAC |
|---:|---:|
| 2% | €43.00 |
| 5% | €17.20 |
| 7.2% | about €12.00 |
| 10% | €8.60 |

The currencies and traffic markets in those benchmarks are not normalized to the
OpenChinese target audience. They show why cheap clicks are insufficient evidence.
Generic paid search at $6.23 CPC cannot fit a €12 first-purchase CAC without an
implausibly high click-to-paid conversion.

### Launch acquisition rule

1. Prioritize product-led referrals, Chinese-learning communities, creator affiliates,
   reader/HSK search content, and a small retargeting or Meta creative test.
2. Attribute completed Stripe purchases, not leads or clicks.
3. Define activation as completing either three study sessions or one reader chapter
   within seven days; instrument this before scaling.
4. A channel becomes eligible for one bounded budget increase only after at least 20
   attributed annual purchases at CAC ≤ €12 and an acceptable measured activation rate.
5. Pause or redesign a channel above €12. Do not use click volume to waive the rule.
6. After three months of paid cohort retention, replace the first-purchase cap with a
   conservative contribution-LTV-based cap.

## Launch checklist and review cadence

- Create test-mode Stripe Prices matching €4.99/month and €39/year; do not infer amounts
  from environment variable names.
- Confirm Checkout displays the same amount, currency, interval, tax wording, and
  renewal behavior as the public pages before enabling payments.
- Confirm both Price IDs grant identical Pro access through verified webhooks.
- Confirm VAT registration, OSS handling, invoices, and tax-display wording with a
  qualified adviser. This report is planning analysis, not tax advice.
- Review monthly during launch: checkout conversion, plan mix, realized payment fee,
  refunds/disputes, Firebase cost/MAU, CAC, seven-day activation, monthly churn, annual
  renewal intent, and support/content cost.
- Review at least quarterly after stabilization, and issue a new dated recommendation
  whenever tax, provider fees, catalogue value, conversion, or retention materially
  changes.

The public price lives in `packages/pricing/src/index.js`. `pnpm check:pricing` fails
when known app, marketing, server mapping, environment, or deployment surfaces drift.
