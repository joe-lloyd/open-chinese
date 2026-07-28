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
  arrayUnion,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { db } from './firebase'
import type { ReviewState } from './srs'
import type { StudyMode } from './session'

export interface WordState extends ReviewState {
  simplified: string
  status: string
  deckName: string
  notes?: string
  customWordData?: {
    simplified: string
    traditional: string | null
    pinyin: string
    definition: string
  }
}

export interface UserProfile {
  email: string
  name: string
  picture: string
  dailyNewLimit: number
  deckPriority?: Record<string, number>
  deckModes?: Record<string, StudyMode>
  lastRead?: LastRead
}

/**
 * Where the user stopped reading. A display cache on the profile document so a
 * "continue reading" entry point costs one read; `readerProgress` stays
 * authoritative for what has actually been completed.
 */
export interface LastRead {
  readerId: string
  chapterId: string
  readerTitle: string
  chapterTitle: string
  at: Date | null
}

export interface ReaderProgress {
  readerId: string
  completedChapters: string[]
  lastChapterId: string | null
  lastReadAt: Date | null
}

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
  if (val instanceof Timestamp) return val.toDate()
  if (val instanceof Date) return val
  return new Date(0)
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
  const data = snap.data() as Record<string, unknown>
  return {
    simplified,
    ...dataToState(data),
    status: (data.status as string) ?? 'Unstudied',
    deckName: (data.deckName as string) ?? '',
    notes: data.notes as string | undefined,
    customWordData: data.customWordData as WordState['customWordData'],
  }
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
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>
    return {
      simplified: d.id,
      ...dataToState(data),
      status: (data.status as string) ?? 'Unstudied',
      deckName: (data.deckName as string) ?? '',
      notes: data.notes as string | undefined,
      customWordData: data.customWordData as WordState['customWordData'],
    }
  })
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
    const totalReviewed = (data.totalReviewed as number) ?? 0
    return {
      date: d.id,
      count: totalReviewed,
      totalReviewed,
      correctCount: (data.correctCount as number) ?? 0,
      incorrectCount: (data.incorrectCount as number) ?? 0,
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
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>
    return {
      simplified: d.id,
      ...dataToState(data),
      status: (data.status as string) ?? 'Unstudied',
      deckName: (data.deckName as string) ?? '',
    }
  })
}

export async function markWordsKnown(uid: string, simplifieds: string[]): Promise<void> {
  const farFuture = Timestamp.fromDate(new Date(Date.now() + 365 * 86400000))
  const batch = writeBatch(db)
  for (const s of simplifieds) {
    batch.set(
      doc(db, 'users', uid, 'words', s),
      { intervalMeaning: 365, intervalPinyin: 365, intervalAudio: 365, status: 'Mastered', nextReviewDate: farFuture },
      { merge: true }
    )
  }
  await batch.commit()
}

export async function saveDeckPriority(uid: string, order: string[]): Promise<void> {
  const priority: Record<string, number> = {}
  order.forEach((name, i) => { priority[name] = i })
  await setDoc(doc(db, 'users', uid), { deckPriority: priority }, { merge: true })
}

export async function saveDeckMode(uid: string, deckName: string, mode: StudyMode): Promise<void> {
  await setDoc(doc(db, 'users', uid), { deckModes: { [deckName]: mode } }, { merge: true })
}

// ── Graded readers ────────────────────────────────────────────────────────────

function dataToReaderProgress(readerId: string, data: Record<string, unknown>): ReaderProgress {
  return {
    readerId,
    completedChapters: (data.completedChapters as string[]) ?? [],
    lastChapterId: (data.lastChapterId as string) ?? null,
    lastReadAt: data.lastReadAt instanceof Timestamp ? data.lastReadAt.toDate() : null,
  }
}

export async function getAllReaderProgress(uid: string): Promise<ReaderProgress[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'readerProgress'))
  return snap.docs.map((d) => dataToReaderProgress(d.id, d.data() as Record<string, unknown>))
}

export async function getReaderProgress(uid: string, readerId: string): Promise<ReaderProgress | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'readerProgress', readerId))
  if (!snap.exists()) return null
  return dataToReaderProgress(readerId, snap.data() as Record<string, unknown>)
}

/** Idempotent: arrayUnion means re-finishing a chapter cannot duplicate it. */
export async function markChapterComplete(
  uid: string,
  readerId: string,
  chapterId: string
): Promise<void> {
  await setDoc(
    doc(db, 'users', uid, 'readerProgress', readerId),
    {
      readerId,
      completedChapters: arrayUnion(chapterId),
      lastChapterId: chapterId,
      lastReadAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export async function recordChapterOpened(
  uid: string,
  entry: { readerId: string; chapterId: string; readerTitle: string; chapterTitle: string }
): Promise<void> {
  await Promise.all([
    setDoc(
      doc(db, 'users', uid, 'readerProgress', entry.readerId),
      { readerId: entry.readerId, lastChapterId: entry.chapterId, lastReadAt: serverTimestamp() },
      { merge: true }
    ),
    setDoc(
      doc(db, 'users', uid),
      { lastRead: { ...entry, at: serverTimestamp() } },
      { merge: true }
    ),
  ])
}

export async function getLastRead(uid: string): Promise<LastRead | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  const raw = snap.data()?.lastRead as Record<string, unknown> | undefined
  if (!raw?.readerId || !raw?.chapterId) return null
  return {
    readerId: raw.readerId as string,
    chapterId: raw.chapterId as string,
    readerTitle: (raw.readerTitle as string) ?? '',
    chapterTitle: (raw.chapterTitle as string) ?? '',
    at: raw.at instanceof Timestamp ? raw.at.toDate() : null,
  }
}

export interface EncounteredWord {
  simplified: string
  deckName: string
  hskLevel: number | null
  customWordData?: WordState['customWordData']
}

/**
 * Records words met while reading. Writes an Unstudied document so the word shows
 * up in the personal dictionary without inventing a new status value; the queue
 * builder keys new cards off review history, not document existence, so these
 * words stay studiable.
 *
 * Re-reads the user's words first so a word studied since the chapter was opened
 * never has its SRS state clobbered. Returns the words actually written.
 */
export async function addEncounteredWords(
  uid: string,
  words: EncounteredWord[],
  encounteredIn: string
): Promise<string[]> {
  if (words.length === 0) return []

  const existing = new Set((await getAllUserWords(uid)).map((w) => w.simplified))
  const toWrite = words.filter((w) => !existing.has(w.simplified))
  if (toWrite.length === 0) return []

  const batch = writeBatch(db)
  for (const word of toWrite) {
    batch.set(doc(db, 'users', uid, 'words', word.simplified), {
      intervalMeaning: 0,
      intervalPinyin: 0,
      intervalAudio: 0,
      easeFactor: 2.5,
      consecutiveFails: 0,
      nextReviewDate: Timestamp.fromDate(new Date(0)),
      lastSubskill: null,
      status: 'Unstudied',
      deckName: word.deckName,
      encounteredAt: serverTimestamp(),
      encounteredIn,
      ...(word.hskLevel != null ? { hskLevel: word.hskLevel } : {}),
      ...(word.customWordData ? { customWordData: word.customWordData } : {}),
    })
  }
  await batch.commit()

  return toWrite.map((w) => w.simplified)
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
  const CHUNK = 500
  let imported = 0
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK)
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
    onProgress?.(Math.floor(i / CHUNK) + 1, Math.ceil(entries.length / CHUNK))
  }
  return { imported }
}

