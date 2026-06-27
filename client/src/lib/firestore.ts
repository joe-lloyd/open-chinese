import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  increment,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { db } from './firebase'
import type { ReviewState } from './srs'

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
  state: ReviewState & { status: string; deckName: string; notes?: string }
): Promise<void> {
  await setDoc(
    doc(db, 'users', uid, 'words', simplified),
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
    },
    { merge: true }
  )
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

export async function appendHistory(
  uid: string,
  entry: { simplified: string; knewPronunciation: boolean; knewMeaning: boolean; response: string }
): Promise<void> {
  await addDoc(collection(db, 'users', uid, 'history'), {
    ...entry,
    reviewedAt: serverTimestamp(),
  })
}

export async function upsertDailyStats(uid: string, date: string, isNew: boolean): Promise<void> {
  await setDoc(
    doc(db, 'users', uid, 'dailyStats', date),
    {
      totalReviewed: increment(1),
      ...(isNew ? { newCardsSeen: increment(1) } : {}),
      date,
    },
    { merge: true }
  )
}

export async function getNewCardsSeen(uid: string, date: string): Promise<number> {
  const snap = await getDoc(doc(db, 'users', uid, 'dailyStats', date))
  return (snap.data()?.newCardsSeen as number) ?? 0
}

export async function getDailyStats(uid: string, days: number): Promise<{ date: string; count: number }[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const q = query(
    collection(db, 'users', uid, 'dailyStats'),
    where('date', '>=', cutoffStr),
    orderBy('date', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({
    date: d.id,
    count: (d.data().totalReviewed as number) ?? 0,
  }))
}

export async function getHistory(
  uid: string,
  days: number
): Promise<{ response: string; reviewedAt: Date }[]> {
  const cutoff = Timestamp.fromDate(new Date(Date.now() - days * 86400000))
  const q = query(
    collection(db, 'users', uid, 'history'),
    where('reviewedAt', '>=', cutoff),
    orderBy('reviewedAt', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({
    response: d.data().response as string,
    reviewedAt: tsToDate(d.data().reviewedAt),
  }))
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

