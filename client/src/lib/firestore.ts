import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  increment,
  query,
  where,
  orderBy,
  documentId,
} from 'firebase/firestore'
import { db } from './firebase'
import type { ReviewState } from './srs'
import type { StudyMode } from './session'

/**
 * Per-word learning analytics. Already stored on every word document; mapped
 * here so consumers (the dashboard's accuracy split) never need a second read.
 */
export interface WordAnalytics {
  totalReviews: number
  correctMeaningCount: number
  incorrectMeaningCount: number
  correctPronCount: number
  incorrectPronCount: number
  hskLevel: number | null
  firstSeenAt: Date | null
  lastReviewedAt: Date | null
}

export interface WordState extends ReviewState {
  simplified: string
  status: string
  deckName: string
  notes?: string
  analytics: WordAnalytics
  customWordData?: {
    simplified: string
    traditional: string | null
    pinyin: string
    definition: string
  }
}

/** Identifies a word to add to `users/{uid}/words`, with the metadata the personal dictionary filters on. */
export interface WordSeed {
  simplified: string
  deckName?: string
  hskLevel?: number | null
}

/**
 * The learner's most recent reading position, written by the graded-readers
 * feature. Optional and defensively parsed — see `normalizeLastRead`.
 */
export interface LastReadPosition {
  readerId: string
  chapterId: string
  readerTitle?: string
  chapterTitle?: string
  /** `[0, 1)`; 1 or more means the chapter is finished. Optional. */
  progress?: number
  /** Accepted from either `updatedAt` or `at` on the stored document. */
  updatedAt?: Date
}

export interface UserProfile {
  email: string
  name: string
  picture: string
  dailyNewLimit: number
  deckPriority?: Record<string, number>
  deckModes?: Record<string, StudyMode>
  /** Unvalidated as stored; run it through `normalizeLastRead` before use. */
  lastRead?: unknown
}

/** Firestore caps `in` filters at 30 values and batched writes at 500 operations. */
const IN_QUERY_LIMIT = 30
const BATCH_LIMIT = 500

const DEFAULT_REVIEW_STATE: ReviewState = {
  intervalMeaning: 0,
  intervalPinyin: 0,
  intervalAudio: 0,
  easeFactor: 2.5,
  consecutiveFails: 0,
  nextReviewDate: new Date(0),
  lastSubskill: null,
}

function tsToDate(val: unknown): Date {
  return tsToDateOrUndefined(val) ?? new Date(0)
}

/** Distinguishes "never happened" from the epoch — the personal dictionary renders them differently. */
function tsToDateOrUndefined(val: unknown): Date | undefined {
  if (val instanceof Timestamp) return val.toDate()
  if (val instanceof Date) return val
  return undefined
}

/**
 * Like `tsToDate` but distinguishes "never" from the epoch. `nextReviewDate`
 * wants the epoch fallback (it means "due now"); `firstSeenAt` does not.
 */
function tsToDateOrNull(val: unknown): Date | null {
  if (val instanceof Timestamp) return val.toDate()
  if (val instanceof Date) return val
  return null
}

function num(val: unknown): number {
  return typeof val === 'number' ? val : 0
}

function dataToAnalytics(data: Record<string, unknown>): WordAnalytics {
  return {
    totalReviews: num(data.totalReviews),
    correctMeaningCount: num(data.correctMeaningCount),
    incorrectMeaningCount: num(data.incorrectMeaningCount),
    correctPronCount: num(data.correctPronCount),
    incorrectPronCount: num(data.incorrectPronCount),
    hskLevel: typeof data.hskLevel === 'number' ? data.hskLevel : null,
    firstSeenAt: tsToDateOrNull(data.firstSeenAt),
    lastReviewedAt: tsToDateOrNull(data.lastReviewedAt),
  }
}

function dataToWordState(simplified: string, data: Record<string, unknown>): WordState {
  return {
    simplified,
    ...dataToState(data),
    status: (data.status as string) ?? 'Unstudied',
    deckName: (data.deckName as string) ?? '',
    notes: data.notes as string | undefined,
    analytics: dataToAnalytics(data),
    customWordData: data.customWordData as WordState['customWordData'],
  }
}

/**
 * Validates a `users/{uid}.lastRead` value written by the graded-readers
 * feature. This is the tolerant side of a cross-branch contract, so it accepts
 * the union of the shapes in play rather than one exact spelling:
 *
 * - required: non-empty string `readerId` and `chapterId`
 * - optional: `readerTitle`, `chapterTitle`
 * - optional timestamp under either `at` or `updatedAt`
 * - optional `progress` in `[0, 1)`
 *
 * `progress` is genuinely optional — a writer that omits it still produces a
 * valid position, and the CTA simply drops the percentage from its copy.
 * Anything else, including the field being absent entirely, is "no reading
 * position". A chapter already read to the end is too, as is a nonsensical
 * negative progress, which would otherwise render as "-500% through".
 */
export function normalizeLastRead(value: unknown): LastReadPosition | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const readerId = typeof raw.readerId === 'string' ? raw.readerId.trim() : ''
  const chapterId = typeof raw.chapterId === 'string' ? raw.chapterId.trim() : ''
  if (!readerId || !chapterId) return null

  let progress: number | undefined
  if (typeof raw.progress === 'number' && Number.isFinite(raw.progress)) {
    if (raw.progress < 0 || raw.progress >= 1) return null
    progress = raw.progress
  }

  return {
    readerId,
    chapterId,
    readerTitle: typeof raw.readerTitle === 'string' ? raw.readerTitle : undefined,
    chapterTitle: typeof raw.chapterTitle === 'string' ? raw.chapterTitle : undefined,
    progress,
    updatedAt: tsToDateOrNull(raw.updatedAt ?? raw.at) ?? undefined,
  }
}

function dataToState(data: Record<string, unknown>): ReviewState {
  return {
    intervalMeaning: (data.intervalMeaning as number) ?? 0,
    intervalPinyin: (data.intervalPinyin as number) ?? 0,
    intervalAudio: (data.intervalAudio as number) ?? 0,
    easeFactor: (data.easeFactor as number) ?? 2.5,
    consecutiveFails: (data.consecutiveFails as number) ?? 0,
    nextReviewDate: tsToDate(data.nextReviewDate),
    lastSubskill: (data.lastSubskill as ReviewState['lastSubskill']) ?? null,
  }
}

export function getDefaultState(): ReviewState {
  return { ...DEFAULT_REVIEW_STATE, nextReviewDate: new Date(0) }
}

export async function getUserWord(uid: string, simplified: string): Promise<WordState | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'words', simplified))
  if (!snap.exists()) return null
  return dataToWordState(simplified, snap.data() as Record<string, unknown>)
}

export async function setUserWord(
  uid: string,
  simplified: string,
  state: ReviewState & { status: string; deckName: string; notes?: string },
  review?: { isNew: boolean; knewPronunciation: boolean; knewMeaning: boolean; hskLevel?: number | null }
): Promise<void> {
  const ref = doc(db, 'users', uid, 'words', simplified)

  // Write SRS state with plain values only — no FieldValue transforms
  await setDoc(
    ref,
    {
      intervalMeaning: state.intervalMeaning,
      intervalPinyin: state.intervalPinyin,
      intervalAudio: state.intervalAudio,
      easeFactor: state.easeFactor,
      consecutiveFails: state.consecutiveFails,
      nextReviewDate: Timestamp.fromDate(state.nextReviewDate),
      lastSubskill: state.lastSubskill,
      status: state.status,
      deckName: state.deckName,
      ...(state.notes !== undefined ? { notes: state.notes } : {}),
      ...(review?.hskLevel != null ? { hskLevel: review.hskLevel } : {}),
    },
    { merge: true }
  )

  // Write analytics separately using updateDoc (supports increment + serverTimestamp cleanly)
  if (review != null) {
    await updateDoc(ref, {
      totalReviews: increment(1),
      correctMeaningCount: increment(review.knewMeaning ? 1 : 0),
      incorrectMeaningCount: increment(review.knewMeaning ? 0 : 1),
      correctPronCount: increment(review.knewPronunciation ? 1 : 0),
      incorrectPronCount: increment(review.knewPronunciation ? 0 : 1),
      lastReviewedAt: serverTimestamp(),
      ...(review.isNew ? { firstSeenAt: serverTimestamp() } : {}),
    })
  }
}

export async function getAllUserWords(uid: string): Promise<WordState[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'words'))
  return snap.docs.map((d) => dataToWordState(d.id, d.data() as Record<string, unknown>))
}

export async function upsertDailyStats(
  uid: string,
  date: string,
  isNew: boolean,
  correct: boolean
): Promise<void> {
  const ref = doc(db, 'users', uid, 'dailyStats', date)
  // Ensure doc exists with plain date field first
  await setDoc(ref, { date }, { merge: true })
  // Then apply increments separately
  await updateDoc(ref, {
    totalReviewed: increment(1),
    correctCount: increment(correct ? 1 : 0),
    incorrectCount: increment(correct ? 0 : 1),
    ...(isNew ? { newCardsSeen: increment(1) } : {}),
  })
}

export async function getNewCardsSeen(uid: string, date: string): Promise<number> {
  const snap = await getDoc(doc(db, 'users', uid, 'dailyStats', date))
  return (snap.data()?.newCardsSeen as number) ?? 0
}

export interface DailyStat {
  date: string
  /** Alias of totalReviewed, kept for ActivityHeatmap's `{ date, count }[]` prop shape */
  count: number
  totalReviewed: number
  correctCount: number
  incorrectCount: number
  /** New cards seen that day; drives the dashboard's learning-velocity series. */
  newCardsSeen: number
  /**
   * False for documents written before `correctCount` existed. Such a day has
   * totalReviewed > 0 but no correct/incorrect split, so it must be omitted from
   * retention rather than plotted as a false 0%.
   */
  hasCorrectCount: boolean
}

export async function getDailyStats(uid: string, days: number): Promise<DailyStat[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const q = query(
    collection(db, 'users', uid, 'dailyStats'),
    where('date', '>=', cutoffStr),
    orderBy('date', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>
    const totalReviewed = num(data.totalReviewed)
    return {
      date: d.id,
      count: totalReviewed,
      totalReviewed,
      correctCount: num(data.correctCount),
      incorrectCount: num(data.incorrectCount),
      newCardsSeen: num(data.newCardsSeen),
      hasCorrectCount: typeof data.correctCount === 'number',
    }
  })
}

export async function upsertProfile(
  uid: string,
  user: { email: string; name: string; picture: string }
): Promise<void> {
  const ref = doc(db, 'users', uid)
  const existing = await getDoc(ref)
  if (!existing.exists()) {
    await setDoc(ref, { ...user, dailyNewLimit: 20 })
  } else {
    await updateDoc(ref, { email: user.email, name: user.name, picture: user.picture })
  }
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return snap.data() as UserProfile
}

export async function saveNotes(uid: string, simplified: string, notes: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'words', simplified), { notes }, { merge: true })
}

export async function resetLeech(uid: string, simplified: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'words', simplified), {
    consecutiveFails: 0,
    status: 'Weak',
    intervalMeaning: 1,
    intervalPinyin: 1,
    nextReviewDate: Timestamp.fromDate(new Date()),
  })
}

export async function suspendWord(uid: string, simplified: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'words', simplified), {
    nextReviewDate: Timestamp.fromDate(new Date(Date.now() + 365 * 86400000)),
    status: 'Leech',
  })
}

export async function deleteWord(uid: string, simplified: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'words', simplified))
}

export async function getDeckSummaries(uid: string): Promise<
  { deckName: string; wordCount: number; dueCount: number }[]
> {
  const words = await getAllUserWords(uid)
  const now = new Date()
  const decks = new Map<string, { wordCount: number; dueCount: number }>()
  for (const w of words) {
    const entry = decks.get(w.deckName) ?? { wordCount: 0, dueCount: 0 }
    entry.wordCount++
    if (w.nextReviewDate <= now && w.status !== 'Mastered' && w.status !== 'Leech') {
      entry.dueCount++
    }
    decks.set(w.deckName, entry)
  }
  return Array.from(decks.entries()).map(([deckName, counts]) => ({ deckName, ...counts }))
}

export async function getDeckWords(uid: string, deckName: string): Promise<WordState[]> {
  const q = query(collection(db, 'users', uid, 'words'), where('deckName', '==', deckName))
  const snap = await getDocs(q)
  return snap.docs.map((d) => dataToWordState(d.id, d.data() as Record<string, unknown>))
}

/**
 * Marks words `Mastered`, skipping the normal review progression.
 *
 * Accepts bare simplifieds for callers acting on words that already have a
 * document, or seeds when the document may not exist yet — a word marked known
 * straight from search needs `deckName` and `hskLevel` or it drops out of the
 * personal dictionary's deck and level filters.
 */
export async function markWordsKnown(uid: string, words: (string | WordSeed)[]): Promise<void> {
  const farFuture = Timestamp.fromDate(new Date(Date.now() + 365 * 86400000))
  // Selection accumulates across pages, so this can exceed Firestore's 500-write cap.
  for (let i = 0; i < words.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const w of words.slice(i, i + BATCH_LIMIT)) {
      const seed: WordSeed = typeof w === 'string' ? { simplified: w } : w
      batch.set(
        doc(db, 'users', uid, 'words', seed.simplified),
        {
          intervalMeaning: 365,
          intervalPinyin: 365,
          intervalAudio: 365,
          status: 'Mastered',
          nextReviewDate: farFuture,
          ...(seed.deckName !== undefined ? { deckName: seed.deckName } : {}),
          ...(seed.hskLevel != null ? { hskLevel: seed.hskLevel } : {}),
        },
        { merge: true }
      )
    }
    await batch.commit()
  }
}

/**
 * Reverses `markWordsKnown`. The intervals it overwrote are gone, so rather than
 * inventing a history this puts the word back at the front of the queue the same
 * way `resetLeech` does — due now, `Weak`, ease untouched.
 *
 * `consecutiveFails` is cleared for the same reason `resetLeech` clears it:
 * without it a word that was a Leech before being marked known would be dragged
 * straight back to `Leech` by `resolveStatus` on its next missed review.
 */
export async function unmarkWordsKnown(uid: string, simplifieds: string[]): Promise<void> {
  const now = Timestamp.fromDate(new Date())
  for (let i = 0; i < simplifieds.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const s of simplifieds.slice(i, i + BATCH_LIMIT)) {
      batch.set(
        doc(db, 'users', uid, 'words', s),
        {
          intervalMeaning: 1,
          intervalPinyin: 1,
          intervalAudio: 1,
          consecutiveFails: 0,
          status: 'Weak',
          nextReviewDate: now,
        },
        { merge: true }
      )
    }
    await batch.commit()
  }
}

/**
 * Adds encountered words to the personal dictionary at default SRS state,
 * leaving any document that already exists untouched — a blind merge would
 * reset a Mastered word to Unstudied. Returns the simplifieds it created.
 *
 * This is the shared write path for every surface that causes a word to be
 * "encountered": adding from dictionary search today, and reading a graded
 * reader later.
 */
export async function ensureUserWords(uid: string, seeds: WordSeed[]): Promise<string[]> {
  const unique = new Map(seeds.map((s) => [s.simplified, s]))
  const ids = [...unique.keys()]
  if (ids.length === 0) return []

  const existing = new Set<string>()
  for (let i = 0; i < ids.length; i += IN_QUERY_LIMIT) {
    const chunk = ids.slice(i, i + IN_QUERY_LIMIT)
    const snap = await getDocs(
      query(collection(db, 'users', uid, 'words'), where(documentId(), 'in', chunk))
    )
    for (const d of snap.docs) existing.add(d.id)
  }

  const missing = ids.filter((id) => !existing.has(id))
  for (let i = 0; i < missing.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const id of missing.slice(i, i + BATCH_LIMIT)) {
      const seed = unique.get(id)!
      batch.set(doc(db, 'users', uid, 'words', id), {
        intervalMeaning: 0,
        intervalPinyin: 0,
        intervalAudio: 0,
        easeFactor: 2.5,
        consecutiveFails: 0,
        nextReviewDate: Timestamp.fromDate(new Date(0)),
        lastSubskill: null,
        status: 'Unstudied',
        deckName: seed.deckName ?? '',
        firstSeenAt: serverTimestamp(),
        ...(seed.hskLevel != null ? { hskLevel: seed.hskLevel } : {}),
      })
    }
    await batch.commit()
  }
  return missing
}

export async function saveDeckPriority(uid: string, order: string[]): Promise<void> {
  const priority: Record<string, number> = {}
  order.forEach((name, i) => { priority[name] = i })
  await setDoc(doc(db, 'users', uid), { deckPriority: priority }, { merge: true })
}

export async function saveDeckMode(uid: string, deckName: string, mode: StudyMode): Promise<void> {
  await setDoc(doc(db, 'users', uid), { deckModes: { [deckName]: mode } }, { merge: true })
}

export async function importWordsToFirestore(
  uid: string,
  entries: Array<{
    simplified: string
    state: ReviewState & { status: string; deckName: string }
    customWordData?: { simplified: string; traditional: string | null; pinyin: string; definition: string }
  }>,
  onProgress?: (batch: number, total: number) => void
): Promise<{ imported: number }> {
  let imported = 0
  for (let i = 0; i < entries.length; i += BATCH_LIMIT) {
    const chunk = entries.slice(i, i + BATCH_LIMIT)
    const batch = writeBatch(db)
    for (const entry of chunk) {
      const ref = doc(db, 'users', uid, 'words', entry.simplified)
      batch.set(
        ref,
        {
          intervalMeaning: entry.state.intervalMeaning,
          intervalPinyin: entry.state.intervalPinyin,
          intervalAudio: entry.state.intervalAudio,
          easeFactor: entry.state.easeFactor,
          consecutiveFails: entry.state.consecutiveFails,
          nextReviewDate: Timestamp.fromDate(entry.state.nextReviewDate),
          lastSubskill: entry.state.lastSubskill,
          status: entry.state.status,
          deckName: entry.state.deckName,
          ...(entry.customWordData ? { customWordData: entry.customWordData } : {}),
        },
        { merge: true }
      )
      imported++
    }
    await batch.commit()
    onProgress?.(Math.floor(i / BATCH_LIMIT) + 1, Math.ceil(entries.length / BATCH_LIMIT))
  }
  return { imported }
}

