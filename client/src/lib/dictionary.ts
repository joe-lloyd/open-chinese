import type { Word } from './worddb'
import type { WordState } from './firestore'

/** A word as the dictionary shows it: static corpus data joined with the user's own state. */
export interface DictEntry {
  simplified: string
  traditional: string | null
  pinyin: string
  definition: string
  hskLevel: number | null
  deckName: string
  status: string
  notes: string
  /** Null until the word has been reviewed at least once. */
  totalReviews: number | null
  /** `correctMeaningCount / totalReviews` as a percentage; null when never reviewed. */
  knowledge: number | null
  firstSeenAt?: Date
  lastReviewedAt?: Date
  /** Whether the word has a document in `users/{uid}/words`. */
  inDictionary: boolean
}

export const WORD_STATUSES = ['Unstudied', 'Weak', 'Strong', 'Memorized', 'Mastered', 'Leech'] as const

export type SortKey = 'recent' | 'knowledge' | 'hsk' | 'alpha'

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: 'Recently reviewed' },
  { value: 'knowledge', label: 'Weakest first' },
  { value: 'hsk', label: 'HSK level' },
  { value: 'alpha', label: 'Alphabetical' },
]

export interface DictFilters {
  status: string
  hsk: string
  deck: string
}

export const NO_FILTERS: DictFilters = { status: '', hsk: '', deck: '' }

export function hasActiveFilters(f: DictFilters): boolean {
  return f.status !== '' || f.hsk !== '' || f.deck !== ''
}

/**
 * Corpus data wins over `customWordData`, which only exists for CSV-imported
 * words absent from words.db. HSK level likewise prefers the corpus and falls
 * back to the cached `hskLevel`, which older documents predate.
 */
export function toEntry(simplified: string, word?: Word, user?: WordState): DictEntry {
  const custom = user?.customWordData
  const analytics = user?.analytics
  // `dataToWordState` defaults the counters to 0, so a word that has never been
  // reviewed reads 0 rather than absent. Collapse that back to null — the UI
  // distinguishes "no reviews yet" from "0% correct".
  const totalReviews = analytics?.totalReviews || null
  return {
    simplified,
    traditional: word?.traditional ?? custom?.traditional ?? null,
    pinyin: word?.pinyin ?? custom?.pinyin ?? '',
    definition: word?.definition ?? custom?.definition ?? '',
    hskLevel: word?.hsk_level ?? analytics?.hskLevel ?? null,
    deckName: user?.deckName || word?.deck_name || '',
    status: user?.status ?? 'Unstudied',
    notes: user?.notes ?? '',
    totalReviews,
    knowledge:
      totalReviews && totalReviews > 0
        ? Math.round(((analytics?.correctMeaningCount ?? 0) / totalReviews) * 100)
        : null,
    firstSeenAt: analytics?.firstSeenAt ?? undefined,
    lastReviewedAt: analytics?.lastReviewedAt ?? undefined,
    inDictionary: user != null,
  }
}

export function filterEntries(entries: DictEntry[], f: DictFilters): DictEntry[] {
  return entries.filter((e) => {
    if (f.status && e.status !== f.status) return false
    if (f.hsk && String(e.hskLevel ?? '') !== f.hsk) return false
    if (f.deck && e.deckName !== f.deck) return false
    return true
  })
}

const byHanzi = (a: DictEntry, b: DictEntry) => a.simplified.localeCompare(b.simplified, 'zh-Hans')

export function sortEntries(entries: DictEntry[], sort: SortKey): DictEntry[] {
  const out = [...entries]
  switch (sort) {
    // Sentinels push never-reviewed and unlevelled words past every ranked word
    // in each ordering rather than letting them cluster at the strong end.
    case 'recent':
      return out.sort(
        (a, b) => (b.lastReviewedAt?.getTime() ?? -1) - (a.lastReviewedAt?.getTime() ?? -1) || byHanzi(a, b)
      )
    case 'knowledge':
      return out.sort((a, b) => (a.knowledge ?? 101) - (b.knowledge ?? 101) || byHanzi(a, b))
    case 'hsk':
      return out.sort((a, b) => (a.hskLevel ?? 99) - (b.hskLevel ?? 99) || byHanzi(a, b))
    case 'alpha':
      return out.sort(byHanzi)
  }
}

export function formatDate(d?: Date): string {
  if (!d) return '—'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' })
}
