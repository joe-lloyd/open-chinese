/**
 * Firebase Admin access for the payment functions.
 *
 * The Admin SDK bypasses Firestore security rules, which is exactly why
 * `entitlements/**` and `billing/**` can be `allow write: if false` for every
 * client. This module is the only thing in the repo that can write them.
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import type { EntitlementUpdate } from './types'

function ensureApp(): void {
  if (getApps().length > 0) return
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set')
  // Accept the raw JSON or a base64 blob — Netlify's env UI is happier with the latter.
  const json = raw.trimStart().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
  initializeApp({ credential: cert(JSON.parse(json)) })
}

function db() {
  ensureApp()
  return getFirestore()
}

export interface VerifiedUser {
  uid: string
  email: string | null
}

/**
 * The uid comes from here and nowhere else. A uid in the request body is never
 * read, so a client cannot buy — or claim to have bought — for another account.
 */
export async function verifyRequestUser(headers: Headers): Promise<VerifiedUser | null> {
  const header = headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  try {
    ensureApp()
    const decoded = await getAuth().verifyIdToken(header.slice(7).trim())
    return { uid: decoded.uid, email: decoded.email ?? null }
  } catch (e) {
    console.error('[auth] token verification failed', e)
    return null
  }
}

/**
 * Claim a webhook event id. Returns false if it was already processed.
 *
 * `create` fails when the document exists, which makes the claim atomic even if
 * a provider redelivers while the first delivery is still in flight. Providers
 * retry aggressively and none guarantee once-only delivery, so this is load
 * bearing rather than defensive.
 */
export async function claimEvent(eventId: string): Promise<boolean> {
  try {
    await db()
      .doc(`webhookEvents/${eventId}`)
      .create({ receivedAt: FieldValue.serverTimestamp() })
    return true
  } catch {
    return false
  }
}

/** Release a claim so the provider's retry can have another go after a failure. */
export async function releaseEvent(eventId: string): Promise<void> {
  try {
    await db().doc(`webhookEvents/${eventId}`).delete()
  } catch (e) {
    console.error('[webhook] failed to release event claim', eventId, e)
  }
}

export async function applyEntitlementUpdate(update: EntitlementUpdate): Promise<void> {
  const firestore = db()
  const data: Record<string, unknown> = {
    provider: update.provider,
    updatedAt: FieldValue.serverTimestamp(),
  }
  if (update.plan !== undefined) data.plan = update.plan
  if (update.planSource !== undefined) data.planSource = update.planSource
  if (update.status !== undefined) data.status = update.status
  if (update.currentPeriodEnd !== undefined) {
    data.currentPeriodEnd = update.currentPeriodEnd ? Timestamp.fromDate(update.currentPeriodEnd) : null
  }
  // arrayUnion is idempotent and additive, so a redelivered purchase cannot
  // duplicate a pack and a subscription change cannot wipe one.
  if (update.addPacks?.length) data.packs = FieldValue.arrayUnion(...update.addPacks)

  await firestore.doc(`users/${update.uid}/entitlements/current`).set(data, { merge: true })

  if (update.customerId) {
    await firestore.doc(`users/${update.uid}/billing/customer`).set(
      {
        provider: update.provider,
        customerId: update.customerId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
  }
}

export async function getCustomerId(uid: string, provider: string): Promise<string | null> {
  const snap = await db().doc(`users/${uid}/billing/customer`).get()
  const data = snap.data()
  if (!data || data.provider !== provider || typeof data.customerId !== 'string') return null
  return data.customerId
}
