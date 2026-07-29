/**
 * Bundles the Netlify Functions the way Netlify does, loads the result, and
 * exercises the paths that must work without any provider configured.
 *
 * This exists because `tsc` says nothing about bundling. `firebase-admin` pulls
 * in google-gax/grpc, which uses `__dirname` and loads `.proto` files from disk
 * at runtime — inlining it produces functions that typecheck, bundle, and then
 * throw on their first Firestore call. That failure is invisible until a real
 * webhook arrives in production, by which point a customer has already paid.
 *
 * Keep `external` here in sync with `external_node_modules` in netlify.toml.
 */

import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ENTRIES = ['checkout', 'webhook', 'portal']
const EXTERNAL = ['firebase-admin']

// Output inside node_modules, not the OS temp dir: the externalised packages
// have to resolve the way they will on Netlify, where node_modules ships
// alongside the bundle.
const outdir = await mkdtemp(join('node_modules', '.oc-fn-check-'))
let failures = 0

function check(label, actual, expected) {
  const ok = actual === expected
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label} — expected ${expected}, got ${actual}`)
}

try {
  await build({
    entryPoints: ENTRIES.map((n) => `netlify/functions/${n}.ts`),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    external: EXTERNAL,
    // The shim Netlify injects when an ESM function pulls in CommonJS deps.
    banner: { js: "import{createRequire as __cr}from'module';const require=__cr(import.meta.url);" },
    outdir,
    logLevel: 'warning',
  })

  const handlers = {}
  for (const name of ENTRIES) {
    const mod = await import(pathToFileURL(join(outdir, `${name}.js`)).href)
    check(`${name} bundles and exports a handler`, typeof mod.default, 'function')
    handlers[name] = mod.default
  }

  const req = (method, body) => new Request('https://example.test/', { method, body })

  check('webhook rejects GET', (await handlers.webhook(req('GET'))).status, 405)
  check('webhook 503s with no provider', (await handlers.webhook(req('POST', '{}'))).status, 503)
  check('checkout 503s with no provider', (await handlers.checkout(req('POST', '{}'))).status, 503)
  check('portal 503s with no provider', (await handlers.portal(req('POST', '{}'))).status, 503)

  // With a provider configured but no valid signature, the webhook must reject
  // before touching Firestore.
  process.env.PAYMENT_PROVIDER = 'stripe'
  process.env.VITE_PAYMENTS_ENABLED = 'true'
  process.env.PUBLIC_SITE_URL = 'https://example.test'
  process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder'
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder'
  process.env.STRIPE_PRICE_PRO_YEARLY = 'price_placeholder'

  check('webhook rejects a forged signature', (await handlers.webhook(req('POST', '{"id":"evt_1"}'))).status, 400)
  check('checkout rejects a missing token', (await handlers.checkout(req('POST', '{"sku":"pro-yearly"}'))).status, 401)
} finally {
  await rm(outdir, { recursive: true, force: true })
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll function bundle checks passed')
