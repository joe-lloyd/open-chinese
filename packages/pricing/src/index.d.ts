export interface ProPrice {
  readonly sku: 'pro-monthly' | 'pro-yearly'
  readonly amountEur: number
  readonly interval: 'month' | 'year'
  readonly intervalCount: 1
  readonly recommended: boolean
}

export interface ProPricing {
  readonly currency: 'EUR'
  readonly locale: 'en-NL'
  readonly monthly: ProPrice
  readonly yearly: ProPrice
}

export const PRO_PRICING: ProPricing

export function annualMonthlyTotalEur(pricing?: ProPricing): number
export function annualSavingsEur(pricing?: ProPricing): number
export function annualSavingsPercent(pricing?: ProPricing): number
export function yearlyMonthlyEquivalentEur(pricing?: ProPricing): number
export function formatEuro(amount: number, pricing?: ProPricing): string
