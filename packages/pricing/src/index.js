/**
 * Public Pro offer configuration.
 *
 * Amounts are VAT-inclusive display prices in euro. Stripe Price objects remain
 * authoritative at checkout; DEPLOY.md requires operators to verify that those
 * remote amounts and intervals match this file before enabling payments.
 */
export const PRO_PRICING = Object.freeze({
  currency: 'EUR',
  locale: 'en-NL',
  monthly: Object.freeze({
    sku: 'pro-monthly',
    amountEur: 4.99,
    interval: 'month',
    intervalCount: 1,
    recommended: false,
  }),
  yearly: Object.freeze({
    sku: 'pro-yearly',
    amountEur: 39,
    interval: 'year',
    intervalCount: 1,
    recommended: true,
  }),
})

export function annualMonthlyTotalEur(pricing = PRO_PRICING) {
  return roundMoney(pricing.monthly.amountEur * 12)
}

export function annualSavingsEur(pricing = PRO_PRICING) {
  return roundMoney(annualMonthlyTotalEur(pricing) - pricing.yearly.amountEur)
}

export function annualSavingsPercent(pricing = PRO_PRICING) {
  return Math.round((annualSavingsEur(pricing) / annualMonthlyTotalEur(pricing)) * 100)
}

export function yearlyMonthlyEquivalentEur(pricing = PRO_PRICING) {
  return roundMoney(pricing.yearly.amountEur / 12)
}

export function formatEuro(amount, pricing = PRO_PRICING) {
  return new Intl.NumberFormat(pricing.locale, {
    style: 'currency',
    currency: pricing.currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function roundMoney(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100
}
