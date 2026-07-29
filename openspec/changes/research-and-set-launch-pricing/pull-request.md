## Summary

- Adds a dated, source-linked launch pricing report and editable Firebase/unit-economics model.
- Launches Pro at €4.99 monthly and €39 yearly, with the 35%-saving yearly offer recommended.
- Makes one shared package authoritative for public Pro pricing across React and Astro.
- Maps monthly and yearly SKUs to distinct Stripe Price environment variables while granting identical Pro access.
- Adds consistency, calculation, checkout-mapping, and entitlement-parity checks plus deployment verification.

## Recommendation and assumptions

The offer undercuts Du Chinese, The Chairman's Bao, and Mandarin Bean while preserving
about €31.12 annual contribution before infrastructure, refunds, support, content, and
acquisition under the planning baseline: VAT-inclusive price, 21% VAT, standard EEA
card at 1.5% + €0.25, and Stripe Billing at 0.7%. Firebase operation counts and
location-specific prices remain editable and must be replaced with production data.
This PR does not create or modify remote Stripe products or tax settings.

## Launch guardrails

- Target annual first-purchase CAC ≤ €12.
- Do not scale a channel until it has at least 20 attributed annual purchases at or
  below the cap and the cohort meets the seven-day activation check.
- Review checkout conversion, plan mix, realized fees, Firebase cost/MAU, refunds,
  CAC, activation, and retention monthly during launch.
- Re-evaluate the CAC cap from measured contribution LTV after three months of paid
  cohort retention.

## Verification

- `node scripts/check-pricing.mjs`
- `tsc -p tsconfig.functions.json`
- `node scripts/check-functions-bundle.mjs`
- React TypeScript project build
- Vite production build
- Astro production build
- Responsive source/breakpoint review; the local browser backend was unavailable for
  screenshot capture
