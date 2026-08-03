## Why

The current commercial price is not grounded in competitor positioning, infrastructure cost, VAT, payment fees, or paid-acquisition economics. A documented launch price and measurement plan are needed so OpenChinese can acquire users without selling below a sustainable first-year contribution margin.

## What Changes

- Add a dated, source-linked market report covering direct Chinese-reading/character-learning competitors, Firebase operating costs, payment fees, VAT assumptions, and advertising benchmarks.
- Define conservative launch unit-economics scenarios for 100, 1,000, and 10,000 active users, with assumptions separated from sourced facts.
- Set the public Pro launch offer to €4.99 monthly or €39 yearly, with annual emphasized as the default and existing permanent content packs left unchanged.
- Define a paid-acquisition guardrail: validate conversion and retention before scaling, target first-purchase CAC at or below €12, and pause channels that cannot meet the contribution-margin threshold.
- Add an experiment and review cadence so price changes are evidence-led rather than silently hard-coded.

## Capabilities

### New Capabilities

- `launch-pricing-strategy`: Defines the researched price, unit-economics model, acquisition guardrails, assumptions, evidence, and review process.

### Modified Capabilities

- `monetization`: Adds monthly and yearly Pro catalogue offers and requires consistent, configuration-driven display of the selected launch prices across the app and marketing site.

## Impact

- Affects the shared product catalogue, Stripe price environment mapping, app and Astro pricing copy, tests, and operator documentation.
- Does not create Stripe products or change live prices remotely; deployment requires the operator to supply matching monthly/yearly Stripe Price IDs.
- Research conclusions are dated July 2026 and must be revisited when provider fees, Firebase usage, taxes, conversion, or retention materially change.
