import { getAllUserWords, getNewCardsSeen, getProfile } from './firestore'
import { loadDB } from './worddb'

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

export async function buildQueue(
  uid: string,
  sessionSize = 50,
  options: { hskLevel?: number } = {}
): Promise<StudyCard[]> {
  const { hskLevel } = options

  const [worddb, allUserWords, profile] = await Promise.all([
    loadDB(),
    getAllUserWords(uid),
    getProfile(uid),
  ])

  const now = new Date()
  const knownSimplifieds = new Set(allUserWords.map((w) => w.simplified))

  // When filtering by HSK level, build a set of simplified chars for that level
  let levelSimplifieds: Set<string> | null = null
  if (hskLevel) {
    const levelWords = worddb.getWordsByLevel(hskLevel)
    levelSimplifieds = new Set(levelWords.map((w) => w.simplified))
  }

  // Due review cards
  const reviewCards: StudyCard[] = allUserWords
    .filter((w) => {
      if (levelSimplifieds && !levelSimplifieds.has(w.simplified)) return false
      return (
        w.nextReviewDate <= now &&
        w.status !== 'Mastered' &&
        w.status !== 'Leech' &&
        w.status !== 'Unstudied' &&
        w.intervalMeaning > 0
      )
    })
    .sort((a, b) => a.nextReviewDate.getTime() - b.nextReviewDate.getTime())
    .slice(0, sessionSize)
    .map((w) => {
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
        isNew: false,
        intervalMeaning: w.intervalMeaning,
        intervalPinyin: w.intervalPinyin,
        intervalAudio: w.intervalAudio,
        easeFactor: w.easeFactor,
        consecutiveFails: w.consecutiveFails,
        nextReviewDate: w.nextReviewDate,
      }
    })

  // New card slots — HSK mode bypasses daily limit
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
    const newCards: StudyCard[] = sourceWords
      .filter((w) => !knownSimplifieds.has(w.simplified))
      .slice(0, newCardSlots)
      .map((w) => ({
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
      }))
    reviewCards.push(...newCards)
  }

  return reviewCards
}
