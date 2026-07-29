import {
  configurationSummary,
  inspectPaymentConfiguration,
} from '../netlify/functions/_lib/payment-config'

const configuration = inspectPaymentConfiguration(process.env, 'checkout')
console.log(`Payment configuration: ${configurationSummary(configuration)}`)
if (configuration.status !== 'ready') process.exitCode = 1
