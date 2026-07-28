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
 *
 * `checkRevoked` costs an extra lookup, which is irrelevant at the handful of
 * calls per user lifetime these endpoints see, and closes the window where a
 * disabled account's token stays usable for up to an hour.
 */
export async function verifyRequestUser(headers: Headers): Promise<VerifiedUser | null> {
  const header = headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  try {
    ensureApp()
    const decoded = await getAuth().verifyIdToken(header.slice(7).trim(), true)
    return { uid: decoded.uid, email: decoded.email ?? null }
  } catch (e) {
    console.error('[auth] token verification failed', e)
    return null
  }
}

/**
 * A claim older than this is assumed to belong to an attempt that died before it
 * could finish. Comfortably longer than a function's execution limit.
 */
const STALE_CLAIM_MS = 5 * 60 * 1000

export type ClaimResult = 'claimed' | 'duplicate'

function toMillis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null
}

/**
 * Claim a webhook event id for processing.
 *
 * Two-phase on purpose. Marking an event processed *before* doing the work would
 * mean a function killed mid-flight — timeout, OOM, instance recycle — leaves a
 * claim nothing can clear: every provider retry sees "already done", the
 * provider gives up, and a paying customer never receives what they bought.
 * So the claim records `processing`, and only a completed write records `done`.
 *
 * A `processing` claim older than STALE_CLAIM_MS is therefore evidence of a
 * dead attempt and is taken over. Two instances racing to take over the same
 * stale claim is harmless: `arrayUnion` and the staleness guard in
 * `applyEntitlementUpdate` make the write idempotent.
 */
export async function claimEvent(eventId: string): Promise<ClaimResult> {
  const ref = db().doc(`webhookEvents/${eventId}`)
  try {
    await ref.create({ status: 'processing', claimedAt: FieldValue.serverTimestamp() })
    return 'claimed'
  } catch {
    const data = (await ref.get()).data()
    if (!data || data.status === 'done') return 'duplicate'
    const claimedAt = toMillis(data.claimedAt)
    // A fresh claim means a concurrent delivery is genuinely still in flight.
    if (claimedAt !== null && Date.now() - claimedAt < STALE_CLAIM_MS) return 'duplicate'
    await ref.set({ status: 'processing', claimedAt: FieldValue.serverTimestamp() }, { merge: true })
    return 'claimed'
  }
}

/** Mark the work done. Only after this will a retry be treated as a duplicate. */
export async function completeEvent(eventId: string): Promise<void> {
  await db()
    .doc(`webhookEvents/${eventId}`)
    .set({ status: 'done', completedAt: FieldValue.serverTimestamp() }, { merge: true })
}

/** Release a claim so the provider's retry can have another go after a failure. */
export async function releaseEvent(eventId: string): Promise<void> {
  try {
    await db().doc(`webhookEvents/${eventId}`).delete()
  } catch (e) {
    console.error('[webhook] failed to release event claim', eventId, e)
  }
}

/**
 * @param eventAt the provider's own timestamp for the event, used to reject
 *   out-of-order deliveries. Null disables the ordering guard.
 */
export async function applyEntitlementUpdate(
  update: EntitlementUpdate,
  eventAt: Date | null
): Promise<void> {
  const firestore = db()
  const ref = firestore.doc(`users/${update.uid}/entitlements/current`)

  await firestore.runTransaction(async (tx) => {
    const existing = (await tx.get(ref)).data()

    const data: Record<string, unknown> = {
      provider: update.provider,
      updatedAt: FieldValue.serverTimestamp(),
    }

    // Packs are additive and order-independent, so they apply regardless of
    // arrival order. arrayUnion also makes a redelivery a no-op.
    if (update.addPacks?.length) data.packs = FieldValue.arrayUnion(...update.addPacks)

    // Subscription state is a snapshot, not a delta, so a late-delivered older
    // event would overwrite a newer one. Providers do not guarantee ordering: an
    // `updated` event generated before a cancellation can arrive after it and
    // resurrect access for the rest of the period. Each event has its own id, so
    // the dedupe ledger cannot catch this — only comparing timestamps can.
    const previous = toMillis(existing?.lastEventAt)
    const incoming = eventAt?.getTime() ?? null
    const stale = incoming !== null && previous !== null && incoming < previous

    if (stale) {
      console.warn('[webhook] dropped out-of-order entitlement update for', update.uid)
    } else {
      if (update.plan !== undefined) data.plan = update.plan
      if (update.planSource !== undefined) data.planSource = update.planSource
      if (update.status !== undefined) data.status = update.status
      if (update.currentPeriodEnd !== undefined) {
        data.currentPeriodEnd = update.currentPeriodEnd
          ? Timestamp.fromDate(update.currentPeriodEnd)
          : null
      }
      if (incoming !== null) data.lastEventAt = Timestamp.fromMillis(incoming)
    }

    tx.set(ref, data, { merge: true })
  })

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
