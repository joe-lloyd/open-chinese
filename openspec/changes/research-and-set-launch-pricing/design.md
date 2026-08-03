## Context

OpenChinese currently displays a €25 yearly Pro subscription and €6/€12 pack prices, but the price is not connected to a dated market or cost model. The product now spans HSK vocabulary, SRS study, progress analytics, graded readers, and chapter audio, while its closest reading competitors charge materially more.

Research checked on 29 July 2026:

| Evidence | Published price/cost | Implication |
|---|---:|---|
| [Du Chinese](https://duchinese.net/pricing) | $14.99 monthly; $119.99 yearly | Premium reading benchmark and category ceiling |
| [The Chairman's Bao](https://www.thechairmansbao.com/plans/) | $11 monthly; $88 yearly | Direct graded-reading competitor |
| [Mandarin Bean](https://mandarinbean.com/product-category/membership/) | $49 yearly | Lower-priced reading benchmark |
| [Stripe Netherlands](https://stripe.com/en-nl/pricing) | EEA card 1.5% + €0.25; Billing 0.7% | Primary variable payment cost |
| [Firebase pricing](https://firebase.google.com/pricing) | Auth with Identity Platform: 50,000 MAU no-cost allowance | Authentication is not an early pricing driver |
| [Firestore pricing](https://firebase.google.com/docs/firestore/pricing) | 50k reads/day, 20k writes/day, 1 GiB, 10 GiB egress free | Typical early usage remains inexpensive |
| [2025 Google Ads benchmark](https://www.wordstream.com/blog/2025-google-ads-benchmarks) | Education CPC $6.23; lead cost $90.02 | Generic paid search cannot support a €39 first purchase |
| [2025 Meta benchmark](https://localiq.com/blog/facebook-advertising-benchmarks/) | Education traffic CPC $0.86 | Small, conversion-measured social tests may fit |

Prices are public list prices, not adjusted for temporary promotions, local app-store pricing, or exchange rates. Advertising benchmarks are broad industry direction, not OpenChinese forecasts.

## Goals / Non-Goals

**Goals:**

- Set a defensible launch price below direct competitors.
- Model VAT, Stripe, Firebase, and acquisition economics transparently.
- Offer a lower-friction monthly option while making annual the best-value default.
- Keep prices configuration-driven across the app and Astro site.
- Define metrics and stop conditions before spending on advertising.

**Non-Goals:**

- Guaranteeing conversion, churn, CAC, or profitability from benchmark data.
- Remotely creating Stripe products/prices or changing tax registrations.
- Pricing institutions, classrooms, lifetime access, or native app stores.
- Treating generated content or founder time as zero-cost forever.
- Changing existing one-time pack prices in this proposal.

## Decisions

### Launch at €4.99 monthly and €39 yearly, VAT-inclusive

The yearly price is 35% below twelve monthly payments (€59.88), below Mandarin Bean's $49 entry benchmark, and less than half the annual prices of the two strongest direct readers. It positions OpenChinese as an accessible, focused tool while retaining contribution margin.

At 21% Netherlands VAT and standard EEA Stripe pricing:

- €39 yearly → €32.23 revenue excluding VAT; about €0.84 processing + €0.27 Billing; about €31.12 before infrastructure, refunds, content, and acquisition.
- €4.99 monthly → €4.12 excluding VAT; about €0.32 processing + €0.03 Billing; about €3.77 monthly contribution before other costs.

These are planning examples. Tax depends on customer location and actual Stripe method/card mix.

Alternative: retain €25 yearly. It would yield roughly €19.8 before infrastructure/acquisition under the same simplified assumptions, leaving almost no room for a plausible paid CAC.

Alternative: €49–€59 yearly. This better matches the lower competitor tier but asks the market to value a newer, smaller catalogue before retention is proven. Treat it as a later tested price, not launch.

### Make the catalogue the single price source

The catalogue will represent billing interval and price explicitly. App and Astro pricing surfaces will consume or mirror one shared export rather than each owning independent numbers. Server checkout still treats Stripe Price ids as authoritative for billing; display configuration must be validated against the intended offer during deployment.

### Treat Firebase as a monitored minor cost, not the price anchor

Scenario assumptions:

| MAU | 20% DAU | Reads/user/day | Writes/user/day | Expected Firebase posture |
|---:|---:|---:|---:|---|
| 100 | 20 | 120 | 15 | Within free quotas |
| 1,000 | 200 | 120 | 15 | Within daily read/write quotas |
| 10,000 | 2,000 | 120 | 15 | ~240k reads and 30k writes/day; small usage charge above free quotas |

The model SHALL keep operation counts editable and use the deployed Firestore location's current Google Cloud rates. Static word/reader assets and browser speech are not Firestore operations. Firebase is unlikely to dominate first-year unit economics; VAT, payment fees, content quality, support, and acquisition matter more.

### Cap first-purchase CAC at €12 for annual

€12 preserves roughly €19 of first-year contribution after the simplified VAT/Stripe calculation. No channel scales from click/lead benchmarks alone. A channel earns more budget only after at least 20 attributed paid conversions with CAC ≤ €12 and acceptable early activation/retention.

Google Search starts excluded except narrow brand/high-intent experiments because $6.23 education CPC is incompatible with the cap at ordinary conversion rates. Initial tests prioritize organic search/content, Chinese-learning communities, creator affiliates, referral loops, and tightly limited Meta creative tests. Meta's $0.86 traffic CPC implies CAC of €8.60 at a strong 10% click-to-paid conversion and €17.20 at 5%; the product must measure its own result.

## Risks / Trade-offs

- [Competitor price does not equal willingness to pay] → Instrument plan selection and test one variable at a time.
- [VAT differs by customer jurisdiction] → Label the model's 21% assumption and use actual tax reports for monthly review.
- [Monthly fixed payment fee is proportionally high] → Emphasize annual and monitor monthly churn/LTV before acquisition.
- [Display and Stripe prices drift] → Add catalogue tests and a deployment checklist that verifies Stripe Price amounts/intervals.
- [Broad ad benchmarks overstate product performance] → Enforce a small budget, paid-conversion attribution, sample threshold, and automatic pause rule.
- [Low launch price anchors future expectations] → Describe it as the current launch offer and grandfather only when explicitly decided.

## Migration Plan

1. Add monthly/yearly catalogue entries and update app/site copy and tests.
2. Create matching Stripe test-mode recurring Prices outside the codebase.
3. Supply test Price ids and verify both intervals through checkout/webhook/portal.
4. Configure VAT/tax handling before live enablement.
5. Create live Prices and deploy; verify displayed and charged amounts.
6. Existing yearly subscribers retain their Stripe subscription Price unless intentionally migrated.
7. Roll back new sales by disabling payments; do not silently change existing subscription contracts.

## Open Questions

- Whether prices are displayed as explicitly VAT-inclusive in every target country must be confirmed with the operator's tax/accounting setup before live sales.
- The €12 CAC cap should be replaced by a cohort-LTV-based cap after at least three months of measured retention.
