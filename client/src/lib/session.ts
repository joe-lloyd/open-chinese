import { getAllUserWords, getEntitlements, getNewCardsSeen, getProfile } from './firestore'
import { loadDB } from './worddb'
import {
  buildFreeWordSets,
  canAccess,
  freeWordPredicate,
  FREE_ENTITLEMENTS,
  PAYMENTS_ENABLED,
} from './entitlements'

export interface StudyCard {
  simplified: string
  traditional: string | null
  pinyin: string
  definition: string
  hskLevel: number | null
  deckName: string
  notes?: string
  sentenceZh: string | null
  sentenceEn: string | null
  status: string
  isNew: boolean
  intervalMeaning: number
  intervalPinyin: number
  intervalAudio: number
  easeFactor: number
  consecutiveFails: number
  nextReviewDate: Date
}

const DEFAULT_SRS = {
  intervalMeaning: 0,
  intervalPinyin: 0,
  intervalAudio: 0,
  easeFactor: 2.5,
  consecutiveFails: 0,
  nextReviewDate: new Date(0),
}

export type StudyMode = 'due' | 'new' | 'cram' | 'refreshWeak' | 'hardOnly'

export async function buildQueue(
  uid: string,
  sessionSize = 50,
  options: { hskLevel?: number; deckName?: string; mode?: StudyMode } = {}
): Promise<StudyCard[]> {
  const { hskLevel, deckName, mode = 'due' } = options

  const [worddb, allUserWords, profile, entitlements] = await Promise.all([
    loadDB(),
    getAllUserWords(uid),
    getProfile(uid),
    // No point paying for a read the gate will ignore.
    PAYMENTS_ENABLED ? getEntitlements(uid) : Promise.resolve(FREE_ENTITLEMENTS),
  ])

  const now = new Date()
  const knownSimplifieds = new Set(allUserWords.map((w) => w.simplified))

  // Gating is applied here, not only on the HSK page, so navigating straight to
  // `/study?hsk=4` cannot serve content the browse view showed as locked.
  //
  // Only the unstudied pool is checked: every word in `allUserWords` already has
  // SRS state, and `canAccess` never revokes a word the user has studied — a
  // lapsed subscription stops new material, it does not delete progress.
  const isFreeWord = freeWordPredicate(buildFreeWordSets((l) => worddb.getWordsByLevel(l)))
  const isUnlocked = (w: { simplified: string; hsk_level: number }) =>
    canAccess(
      { kind: 'word', simplified: w.simplified, hskLevel: w.hsk_level },
      entitlements,
      { isFreeWord, studied: knownSimplifieds }
    ).allowed

  let levelSimplifieds: Set<string> | null = null
  if (hskLevel) {
    const levelWords = worddb.getWordsByLevel(hskLevel)
    levelSimplifieds = new Set(levelWords.map((w) => w.simplified))
  }

  // Deck scope: applies to the user's word documents. Undefined deckName = all decks.
  const matchesDeck = (w: { deckName: string }) => !deckName || w.deckName === deckName

  // Deck scope for the unstudied pool, which carries deck_name from the static dictionary.
  const matchesDeckRaw = (w: { deck_name: string }) => !deckName || w.deck_name === deckName

  // Deck priority rank: lower is higher priority; unranked decks sort last.
  const rank = (deck: string) => profile?.deckPriority?.[deck] ?? Number.MAX_SAFE_INTEGER

  const toCard = (w: typeof allUserWords[0], isNew: boolean): StudyCard => {
    const wordData = worddb.getWord(w.simplified)
    return {
      simplified: w.simplified,
      traditional: wordData?.traditional ?? null,
      pinyin: wordData?.pinyin ?? w.customWordData?.pinyin ?? '',
      definition: wordData?.definition ?? w.customWordData?.definition ?? '',
      hskLevel: wordData?.hsk_level ?? null,
      deckName: w.deckName,
      notes: w.notes,
      sentenceZh: wordData?.sentence_zh ?? null,
      sentenceEn: wordData?.sentence_en ?? null,
      status: w.status,
      isNew,
      intervalMeaning: w.intervalMeaning,
      intervalPinyin: w.intervalPinyin,
      intervalAudio: w.intervalAudio,
      easeFactor: w.easeFactor,
      consecutiveFails: w.consecutiveFails,
      nextReviewDate: w.nextReviewDate,
    }
  }

  const toNewCard = (w: ReturnType<typeof worddb.getAllWords>[0]): StudyCard => ({
    simplified: w.simplified,
    traditional: w.traditional,
    pinyin: w.pinyin,
    definition: w.definition,
    hskLevel: w.hsk_level,
    deckName: w.deck_name,
    notes: undefined,
    sentenceZh: w.sentence_zh,
    sentenceEn: w.sentence_en,
    status: 'Unstudied',
    isNew: true,
    ...DEFAULT_SRS,
    nextReviewDate: new Date(0),
  })

  // ── Cram mode: every card in scope, any status, hardest first, ignore schedule ──
  if (mode === 'cram') {
    return allUserWords
      .filter((w) => {
        if (!matchesDeck(w)) return false
        if (levelSimplifieds && !levelSimplifieds.has(w.simplified)) return false
        return true
      })
      .sort((a, b) => a.easeFactor - b.easeFactor)
      .slice(0, sessionSize)
      .map((w) => toCard(w, false))
  }

  // ── New mode: unstudied words only, bypass daily limit ──
  if (mode === 'new') {
    const sourceWords = hskLevel ? worddb.getWordsByLevel(hskLevel) : worddb.getAllWords()
    return sourceWords
      .filter((w) => matchesDeckRaw(w) && !knownSimplifieds.has(w.simplified) && isUnlocked(w))
      .slice(0, sessionSize)
      .map(toNewCard)
  }

  // ── Refresh Weak: cards with status Weak, ignore schedule, no new cards ──
  if (mode === 'refreshWeak') {
    return allUserWords
      .filter((w) => {
        if (!matchesDeck(w)) return false
        if (levelSimplifieds && !levelSimplifieds.has(w.simplified)) return false
        return w.status === 'Weak'
      })
      .sort((a, b) => a.easeFactor - b.easeFactor)
      .slice(0, sessionSize)
      .map((w) => toCard(w, false))
  }

  // ── Hard Only: cards whose most recent review missed both subskills ──
  if (mode === 'hardOnly') {
    return allUserWords
      .filter((w) => {
        if (!matchesDeck(w)) return false
        if (levelSimplifieds && !levelSimplifieds.has(w.simplified)) return false
        return w.consecutiveFails > 0 && w.status !== 'Unstudied'
      })
      .sort((a, b) => b.consecutiveFails - a.consecutiveFails || a.easeFactor - b.easeFactor)
      .slice(0, sessionSize)
      .map((w) => toCard(w, false))
  }

  // ── Due mode (default): due reviews + new cards up to daily limit ──
  const reviewCards: StudyCard[] = allUserWords
    .filter((w) => {
      if (!matchesDeck(w)) return false
      if (levelSimplifieds && !levelSimplifieds.has(w.simplified)) return false
      return (
        w.nextReviewDate <= now &&
        w.status !== 'Mastered' &&
        w.status !== 'Leech' &&
        w.status !== 'Unstudied' &&
        w.intervalMeaning > 0
      )
    })
    .sort(
      (a, b) =>
        rank(a.deckName) - rank(b.deckName) ||
        a.nextReviewDate.getTime() - b.nextReviewDate.getTime()
    )
    .slice(0, sessionSize)
    .map((w) => toCard(w, false))

  let newCardSlots: number
  if (hskLevel) {
    newCardSlots = Math.max(0, sessionSize - reviewCards.length)
  } else {
    const dailyNewLimit = profile?.dailyNewLimit ?? 20
    const today = new Date().toISOString().slice(0, 10)
    const newCardsSeen = await getNewCardsSeen(uid, today)
    newCardSlots = Math.max(0, Math.min(dailyNewLimit - newCardsSeen, sessionSize - reviewCards.length))
  }

  if (newCardSlots > 0) {
    const sourceWords = hskLevel ? worddb.getWordsByLevel(hskLevel) : worddb.getAllWords()
    const newCards = sourceWords
      .filter((w) => matchesDeckRaw(w) && !knownSimplifieds.has(w.simplified) && isUnlocked(w))
      .slice(0, newCardSlots)
      .map(toNewCard)
    reviewCards.push(...newCards)
  }

  return reviewCards
}
