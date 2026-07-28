#!/usr/bin/env node
/**
 * Set a user's entitlement directly, without going through a payment.
 *
 * This is how the owner account gets permanent access, and how test personas are
 * switched while developing. It writes `users/{uid}/entitlements/current` with
 * the Firebase Admin SDK — the same path and the same credential the payment
 * webhook uses.
 *
 * It deliberately does NOT add a client-side admin flag. Security rules deny
 * every client write to that document, and the app streams it with onSnapshot,
 * so running this command changes what the running app shows within a second
 * without a reload and without a second, weaker code path that could be forged.
 *
 *   node scripts/entitlement.mjs <persona> [uid]
 *   pnpm entitlement <persona> [uid]
 *
 * With no uid, resolves the single account matching VITE_ALLOWED_EMAIL.
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'

const __dirname = dirname(fileURLToPath(import.meta.url))

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

/**
 * Every state the app can be in, as a ready-made document.
 *
 * `owner` is the one with no `currentPeriodEnd`: `isPro()` treats a grant with a
 * null period end as perpetual, which is exactly right for your own account and
 * exactly wrong for anything a customer can reach — hence Admin-SDK-only.
 */
const PERSONAS = {
  owner: {
    describe: 'Perpetual Pro. Never expires, no payment involved. Use for your own account.',
    doc: { plan: 'pro', planSource: 'grant', status: 'active', currentPeriodEnd: null, packs: [] },
  },
  free: {
    describe: 'Free tier. Sees the demo allowance and a paywall on everything else.',
    doc: { plan: 'free', planSource: null, status: null, currentPeriodEnd: null, packs: [] },
  },
  pro: {
    describe: 'Paying subscriber, one year out. What a real Stripe checkout produces.',
    doc: () => ({
      plan: 'pro',
      planSource: 'subscription',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + YEAR_MS),
      packs: [],
    }),
  },
  expiring: {
    describe: 'Pro that lapses in 3 days. For testing renewal nudges.',
    doc: () => ({
      plan: 'pro',
      planSource: 'subscription',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      packs: [],
    }),
  },
  expired: {
    describe: 'Lapsed subscription. Proves access stops but studied words are kept.',
    doc: () => ({
      plan: 'pro',
      planSource: 'subscription',
      status: 'expired',
      currentPeriodEnd: new Date(Date.now() - YEAR_MS),
      packs: [],
    }),
  },
  past_due: {
    describe: 'Payment failed but still inside the period — access continues.',
    doc: () => ({
      plan: 'pro',
      planSource: 'subscription',
      status: 'past_due',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      packs: [],
    }),
  },
  packs: {
    describe: 'Not Pro, owns the HSK 1 and HSK 2 packs outright.',
    doc: { plan: 'free', planSource: null, status: null, currentPeriodEnd: null, packs: ['hsk-1', 'hsk-2'] },
  },
}

function usage(msg) {
  if (msg) console.error(`\n  ${msg}\n`)
  console.error('  Usage: pnpm entitlement <persona> [uid]\n')
  for (const [name, p] of Object.entries(PERSONAS)) {
    console.error(`    ${name.padEnd(10)} ${p.describe}`)
  }
  console.error('\n    show       Print the current entitlement without changing it.\n')
  process.exit(1)
}

/** Same accepted shapes as the Netlify functions: raw JSON or base64. */
function loadServiceAccount() {
  let raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) {
    // Convenience for local use: a gitignored key file beside the repo root.
    try {
      raw = readFileSync(resolve(__dirname, '../service-account.json'), 'utf8')
    } catch {
      console.error(
        '\n  No credential found.\n\n' +
          '  Set FIREBASE_SERVICE_ACCOUNT (raw JSON or base64), or drop the key file at\n' +
          '  service-account.json in the repo root (already gitignored).\n\n' +
          '  Firebase console → Project settings → Service accounts → Generate new private key.\n'
      )
      process.exit(1)
    }
  }
  const json = raw.trimStart().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
  return JSON.parse(json)
}

async function resolveUid(explicit) {
  if (explicit) return explicit
  const email = process.env.VITE_ALLOWED_EMAIL
  if (!email) usage('No uid given and VITE_ALLOWED_EMAIL is not set — pass a uid explicitly.')
  try {
    const user = await getAuth().getUserByEmail(email)
    console.log(`  Resolved ${email} → ${user.uid}`)
    return user.uid
  } catch {
    usage(`No Firebase user for ${email}. Sign in to the app once first, then retry.`)
  }
}

async function main() {
  const [persona, uidArg] = process.argv.slice(2)
  if (!persona) usage()
  if (persona !== 'show' && !PERSONAS[persona]) usage(`Unknown persona "${persona}".`)

  if (getApps().length === 0) initializeApp({ credential: cert(loadServiceAccount()) })
  const db = getFirestore()
  const uid = await resolveUid(uidArg)
  const ref = db.doc(`users/${uid}/entitlements/current`)

  if (persona === 'show') {
    const snap = await ref.get()
    console.log(`\n  users/${uid}/entitlements/current\n`)
    console.log(snap.exists ? snap.data() : '  (no document — treated as free tier)')
    console.log()
    return
  }

  const spec = PERSONAS[persona]
  const fields = typeof spec.doc === 'function' ? spec.doc() : spec.doc

  // Written as a full replace, not a merge: a persona is a complete state, and a
  // merge would leave packs or a period end behind from whatever was set before.
  await ref.set({
    ...fields,
    currentPeriodEnd: fields.currentPeriodEnd ? Timestamp.fromDate(fields.currentPeriodEnd) : null,
    provider: 'manual',
    updatedAt: FieldValue.serverTimestamp(),
  })

  console.log(`\n  ✓ ${uid} is now: ${persona} — ${spec.describe}`)
  console.log('    The running app picks this up live; no reload needed.\n')
}

main().catch((e) => {
  console.error('\n  Failed:', e.message, '\n')
  process.exit(1)
})
