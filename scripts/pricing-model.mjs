import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { PRO_PRICING } from '../packages/pricing/src/index.js'

export const DEFAULTS = Object.freeze({
  vatRate: 0.21,
  paymentPercent: 0.015,
  paymentFixedEur: 0.25,
  billingPercent: 0.007,
  refundRate: 0,
  annualCacEur: 12,
  dauShare: 0.2,
  readsPerDauPerDay: 120,
  writesPerDauPerDay: 15,
  freeReadsPerDay: 50_000,
  freeWritesPerDay: 20_000,
  readUsdPer100k: 0.06,
  writeUsdPer100k: 0.18,
  daysPerMonth: 30,
})

export function contribution(grossEur, assumptions = DEFAULTS) {
  const revenueExVat = grossEur / (1 + assumptions.vatRate)
  const paymentFee = grossEur * assumptions.paymentPercent + assumptions.paymentFixedEur
  const billingFee = grossEur * assumptions.billingPercent
  const refundAllowance = grossEur * assumptions.refundRate
  return {
    grossEur,
    revenueExVat,
    paymentFee,
    billingFee,
    refundAllowance,
    beforeAcquisition: revenueExVat - paymentFee - billingFee - refundAllowance,
  }
}

export function firebaseMonthly(mau, assumptions = DEFAULTS) {
  const dau = mau * assumptions.dauShare
  const readsPerDay = dau * assumptions.readsPerDauPerDay
  const writesPerDay = dau * assumptions.writesPerDauPerDay
  const billableReadsPerMonth =
    Math.max(0, readsPerDay - assumptions.freeReadsPerDay) * assumptions.daysPerMonth
  const billableWritesPerMonth =
    Math.max(0, writesPerDay - assumptions.freeWritesPerDay) * assumptions.daysPerMonth
  const estimatedUsd =
    (billableReadsPerMonth / 100_000) * assumptions.readUsdPer100k +
    (billableWritesPerMonth / 100_000) * assumptions.writeUsdPer100k
  return { mau, dau, readsPerDay, writesPerDay, billableReadsPerMonth, billableWritesPerMonth, estimatedUsd }
}

export function model(assumptions = DEFAULTS) {
  return {
    assumptions,
    monthly: contribution(PRO_PRICING.monthly.amountEur, assumptions),
    yearly: contribution(PRO_PRICING.yearly.amountEur, assumptions),
    firebase: [100, 1_000, 10_000].map((mau) => firebaseMonthly(mau, assumptions)),
  }
}

function envNumber(name, fallback) {
  const raw = process.env[name]
  if (raw == null || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`)
  return value
}

export function assumptionsFromEnv() {
  return {
    ...DEFAULTS,
    vatRate: envNumber('PRICING_VAT_RATE', DEFAULTS.vatRate),
    paymentPercent: envNumber('PRICING_PAYMENT_PERCENT', DEFAULTS.paymentPercent),
    paymentFixedEur: envNumber('PRICING_PAYMENT_FIXED_EUR', DEFAULTS.paymentFixedEur),
    billingPercent: envNumber('PRICING_BILLING_PERCENT', DEFAULTS.billingPercent),
    refundRate: envNumber('PRICING_REFUND_RATE', DEFAULTS.refundRate),
    annualCacEur: envNumber('PRICING_ANNUAL_CAC_EUR', DEFAULTS.annualCacEur),
    dauShare: envNumber('PRICING_DAU_SHARE', DEFAULTS.dauShare),
    readsPerDauPerDay: envNumber('PRICING_READS_PER_DAU_DAY', DEFAULTS.readsPerDauPerDay),
    writesPerDauPerDay: envNumber('PRICING_WRITES_PER_DAU_DAY', DEFAULTS.writesPerDauPerDay),
    readUsdPer100k: envNumber('PRICING_READ_USD_PER_100K', DEFAULTS.readUsdPer100k),
    writeUsdPer100k: envNumber('PRICING_WRITE_USD_PER_100K', DEFAULTS.writeUsdPer100k),
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  console.log(JSON.stringify(model(assumptionsFromEnv()), null, 2))
}
