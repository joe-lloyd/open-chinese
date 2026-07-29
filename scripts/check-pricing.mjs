import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  annualMonthlyTotalEur,
  annualSavingsEur,
  annualSavingsPercent,
  PRO_PRICING,
  yearlyMonthlyEquivalentEur,
} from '../packages/pricing/src/index.js'
import { contribution, firebaseMonthly } from './pricing-model.mjs'

assert.equal(PRO_PRICING.monthly.sku, 'pro-monthly')
assert.equal(PRO_PRICING.monthly.amountEur, 4.99)
assert.equal(PRO_PRICING.monthly.interval, 'month')
assert.equal(PRO_PRICING.yearly.sku, 'pro-yearly')
assert.equal(PRO_PRICING.yearly.amountEur, 39)
assert.equal(PRO_PRICING.yearly.interval, 'year')
assert.equal(PRO_PRICING.yearly.recommended, true)
assert.equal(annualMonthlyTotalEur(), 59.88)
assert.equal(annualSavingsEur(), 20.88)
assert.equal(annualSavingsPercent(), 35)
assert.equal(yearlyMonthlyEquivalentEur(), 3.25)

const annual = contribution(PRO_PRICING.yearly.amountEur)
assert.ok(Math.abs(annual.beforeAcquisition - 31.123404958677686) < 1e-9)
assert.equal(firebaseMonthly(100).estimatedUsd, 0)
assert.equal(firebaseMonthly(1_000).estimatedUsd, 0)
assert.ok(Math.abs(firebaseMonthly(10_000).estimatedUsd - 3.96) < 1e-9)

const files = {
  catalog: await readFile('apps/app/src/lib/catalog.ts', 'utf8'),
  appPricing: await readFile('apps/app/src/pages/PricingPage.tsx', 'utf8'),
  siteConfig: await readFile('apps/site/site.config.ts', 'utf8'),
  sitePricing: await readFile('apps/site/src/pages/pricing.astro', 'utf8'),
  siteContent: await readFile('apps/site/src/data/content.ts', 'utf8'),
  serverCatalog: await readFile('netlify/functions/_lib/types.ts', 'utf8'),
  env: await readFile('.env.example', 'utf8'),
  deploy: await readFile('DEPLOY.md', 'utf8'),
}

assert.match(files.catalog, /PRO_PRICING\.monthly\.amountEur/)
assert.match(files.catalog, /PRO_PRICING\.yearly\.amountEur/)
assert.match(files.appPricing, /annualSavingsPercent\(\)/)
assert.match(files.siteConfig, /proPricing: PRO_PRICING/)
assert.match(files.sitePricing, /annualSavingsPercent\(SITE\.proPricing\)/)
assert.match(files.serverCatalog, /'pro-monthly': \{ recurring: true \}/)
assert.match(files.env, /STRIPE_PRICE_PRO_MONTHLY=/)
assert.match(files.deploy, /STRIPE_PRICE_PRO_MONTHLY/)

for (const [name, source] of Object.entries(files)) {
  if (name === 'deploy') continue
  assert.doesNotMatch(source, /€25\b/, `${name} still contains the old public Pro price`)
}

console.log('Pricing configuration, calculations, and public surfaces are consistent')
