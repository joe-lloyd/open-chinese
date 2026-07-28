import { useEffect, useMemo, useRef, useState } from 'react'
import { loadDB } from '../lib/worddb'
import type { Word } from '../lib/worddb'
import {
  ensureUserWords,
  getAllUserWords,
  getDefaultState,
  markWordsKnown,
  saveNotes,
  unmarkWordsKnown,
} from '../lib/firestore'
import type { WordSeed, WordState } from '../lib/firestore'
import { getCurrentUid } from '../lib/auth'
import {
  NO_FILTERS,
  filterEntries,
  hasActiveFilters,
  sortEntries,
  toEntry,
} from '../lib/dictionary'
import type { DictFilters, SortKey } from '../lib/dictionary'
import PersonalWordList, { PAGE_SIZE } from '../components/PersonalWordList'
import StatusBadge from '../components/StatusBadge'
import WordDetail from '../components/WordDetail'
import WordFilterBar from '../components/WordFilterBar'
import HskBadge from '../components/HskBadge'

type View = 'mine' | 'search'

export default function DictionaryPage() {
  const [view, setView] = useState<View>('mine')
  const [loading, setLoading] = useState(true)
  const [userWords, setUserWords] = useState<WordState[]>([])
  const [meta, setMeta] = useState<Map<string, Word>>(new Map())

  const [filters, setFilters] = useState<DictFilters>(NO_FILTERS)
  const [sort, setSort] = useState<SortKey>('recent')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Word[]>([])
  const [error, setError] = useState<string | null>(null)

  const dbRef = useRef<Awaited<ReturnType<typeof loadDB>> | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function load() {
      const uid = getCurrentUid()
      const db = await loadDB()
      dbRef.current = db
      if (!uid) { setLoading(false); return }
      const words = await getAllUserWords(uid)
      setUserWords(words)
      setMeta(new Map(db.getWords(words.map((w) => w.simplified)).map((w) => [w.simplified, w])))
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (!query.trim()) { setResults([]); return }
    debounce.current = setTimeout(() => {
      const found = dbRef.current?.searchWords(query) ?? []
      setResults(found)
      // Keep the corpus data for anything the user opens from search results.
      setMeta((prev) => {
        const next = new Map(prev)
        for (const w of found) next.set(w.simplified, w)
        return next
      })
    }, 250)
  }, [query])

  const userMap = useMemo(() => new Map(userWords.map((w) => [w.simplified, w])), [userWords])

  const allEntries = useMemo(
    () => userWords.map((w) => toEntry(w.simplified, meta.get(w.simplified), w)),
    [userWords, meta]
  )

  const visibleEntries = useMemo(
    () => sortEntries(filterEntries(allEntries, filters), sort),
    [allEntries, filters, sort]
  )

  const searchEntries = useMemo(
    () => results.map((w) => toEntry(w.simplified, w, userMap.get(w.simplified))),
    [results, userMap]
  )

  const hskLevels = useMemo(
    () => [...new Set(allEntries.map((e) => e.hskLevel).filter((l): l is number => l != null))].sort((a, b) => a - b),
    [allEntries]
  )
  const decks = useMemo(
    () => [...new Set(allEntries.map((e) => e.deckName).filter(Boolean))].sort(),
    [allEntries]
  )

  const detail = selectedKey
    ? toEntry(selectedKey, meta.get(selectedKey), userMap.get(selectedKey))
    : null

  // A mutation can shrink the result set under an active filter, stranding the
  // current page past the end.
  const safePage = Math.min(page, Math.max(0, Math.ceil(visibleEntries.length / PAGE_SIZE) - 1))

  // Filters change which words are reachable, so a surviving selection could act
  // on words the user can no longer see. Sorting only reorders the same set.
  function changeFilters(f: DictFilters) { setFilters(f); setPage(0); setSelected(new Set()) }
  function changeSort(s: SortKey) { setSort(s); setPage(0) }

  /** Firestore writes here are otherwise silent; StudyPage has the same banner. */
  async function run(action: () => Promise<void>) {
    try {
      setError(null)
      await action()
    } catch (e) {
      console.error('[Firestore]', e)
      setError((e as Error).message ?? 'Something went wrong')
    }
  }

  /** Applies a Firestore mutation to local state so the list updates without a refetch. */
  function patchLocal(simplifieds: string[], patch: Partial<WordState>) {
    setUserWords((prev) => {
      const map = new Map(prev.map((w) => [w.simplified, w]))
      for (const s of simplifieds) {
        const existing = map.get(s)
        map.set(s, { ...(existing ?? blankState(s, meta.get(s))), ...patch })
      }
      return [...map.values()]
    })
  }

  function seedFor(simplified: string): WordSeed {
    const word = meta.get(simplified)
    const user = userMap.get(simplified)
    return {
      simplified,
      deckName: user?.deckName || word?.deck_name || '',
      hskLevel: word?.hsk_level ?? user?.analytics.hskLevel ?? null,
    }
  }

  function markKnown(simplifieds: string[]) {
    return run(async () => {
      const uid = getCurrentUid()
      if (!uid || simplifieds.length === 0) return
      await markWordsKnown(uid, simplifieds.map(seedFor))
      patchLocal(simplifieds, {
        status: 'Mastered',
        intervalMeaning: 365,
        intervalPinyin: 365,
        intervalAudio: 365,
        nextReviewDate: new Date(Date.now() + 365 * 86400000),
      })
      setSelected(new Set())
    })
  }

  function unmark(simplifieds: string[]) {
    return run(async () => {
      const uid = getCurrentUid()
      if (!uid) return
      const mastered = simplifieds.filter((s) => userMap.get(s)?.status === 'Mastered')
      setSelected(new Set())
      if (mastered.length === 0) return
      await unmarkWordsKnown(uid, mastered)
      patchLocal(mastered, {
        status: 'Weak',
        intervalMeaning: 1,
        intervalPinyin: 1,
        intervalAudio: 1,
        consecutiveFails: 0,
        nextReviewDate: new Date(),
      })
    })
  }

  function addToDictionary(simplified: string) {
    return run(async () => {
      const uid = getCurrentUid()
      if (!uid) return
      await ensureUserWords(uid, [seedFor(simplified)])
      const existing = userMap.get(simplified)
      patchLocal([simplified], {
        analytics: {
          ...(existing?.analytics ?? blankState(simplified, meta.get(simplified)).analytics),
          firstSeenAt: new Date(),
        },
      })
    })
  }

  function saveNote(simplified: string, notes: string) {
    return run(async () => {
      const uid = getCurrentUid()
      if (!uid) return
      await saveNotes(uid, simplified, notes)
      patchLocal([simplified], { notes })
    })
  }

  function toggleSelect(simplified: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(simplified)) next.delete(simplified)
      else next.add(simplified)
      return next
    })
  }

  function toggleSelectPage(simplifieds: string[], select: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const s of simplifieds) {
        if (select) next.add(s)
        else next.delete(s)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col md:flex-row md:h-screen">
      <div
        className={`${selectedKey ? 'hidden md:flex' : 'flex'} flex-col flex-1 min-w-0 md:min-h-0 border-b md:border-b-0 md:border-r border-border`}
      >
        <div className="px-4 pt-4 pb-3 flex gap-1 bg-surface-raised/50 border-b border-border">
          <ViewTab label="My words" active={view === 'mine'} onClick={() => setView('mine')} />
          <ViewTab label="Search" active={view === 'search'} onClick={() => setView('search')} />
        </div>

        {error && (
          <div className="px-4 py-2 bg-incorrect/10 border-b border-incorrect/30 flex items-center gap-3">
            <p className="text-sm text-incorrect flex-1">Save failed: {error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-incorrect hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {view === 'mine' ? (
          loading ? (
            <p className="p-4 text-sm text-text-muted">Loading your words…</p>
          ) : allEntries.length === 0 ? (
            <EmptyState
              icon="📖"
              title="No words yet"
              body="Study a session or import a word list — every word you meet lands here."
            />
          ) : (
            <>
              <WordFilterBar
                filters={filters}
                onFiltersChange={changeFilters}
                sort={sort}
                onSortChange={changeSort}
                hskLevels={hskLevels}
                decks={decks}
                count={visibleEntries.length}
                onClear={() => changeFilters(NO_FILTERS)}
              />
              {visibleEntries.length === 0 ? (
                <EmptyState
                  icon="🔍"
                  title="Nothing matches"
                  body="No words match the current filters."
                  action={hasActiveFilters(filters) ? { label: 'Clear filters', onClick: () => changeFilters(NO_FILTERS) } : undefined}
                />
              ) : (
                <PersonalWordList
                  entries={visibleEntries}
                  page={safePage}
                  onPageChange={setPage}
                  selected={selected}
                  onToggleSelect={toggleSelect}
                  onToggleSelectPage={toggleSelectPage}
                  selectedKey={selectedKey}
                  onSelect={(e) => setSelectedKey(e.simplified)}
                  onMarkKnown={markKnown}
                  onUnmark={unmark}
                  onClearSelection={() => setSelected(new Set())}
                  showDeck={decks.length > 1}
                />
              )}
            </>
          )
        ) : (
          <>
            <div className="p-4 border-b border-border">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search hanzi, pinyin (pengyou), or definition…"
                className="w-full bg-surface-raised border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {searchEntries.map((e) => (
                <button
                  key={e.simplified}
                  onClick={() => setSelectedKey(e.simplified)}
                  className={`w-full text-left px-4 py-3 hover:bg-surface-raised transition-colors ${
                    selectedKey === e.simplified ? 'bg-accent/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl text-text-primary">{e.simplified}</span>
                    <span className="text-sm text-text-muted">{e.pinyin}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <HskBadge level={e.hskLevel} />
                      {e.inDictionary ? (
                        <StatusBadge status={e.status} />
                      ) : (
                        <span className="text-xs text-text-muted">Not in your dictionary</span>
                      )}
                    </span>
                  </div>
                  <p className="text-sm text-text-muted mt-0.5 truncate">{e.definition}</p>
                </button>
              ))}
              {query.trim() && searchEntries.length === 0 && (
                <p className="p-4 text-sm text-text-muted">No results</p>
              )}
            </div>
          </>
        )}
      </div>

      <div
        className={`${selectedKey ? 'flex' : 'hidden'} md:flex w-full md:w-96 lg:w-[28rem] shrink-0 overflow-y-auto p-6 md:p-8 flex-col`}
      >
        {detail ? (
          <WordDetail
            key={detail.simplified}
            entry={detail}
            onBack={() => setSelectedKey(null)}
            onSaveNotes={(notes) => saveNote(detail.simplified, notes)}
            onMarkKnown={() => markKnown([detail.simplified])}
            onUnmark={() => unmark([detail.simplified])}
            onAdd={() => addToDictionary(detail.simplified)}
          />
        ) : (
          <div className="text-text-muted text-center mt-24">
            <p className="text-4xl mb-3">📖</p>
            <p className="text-sm">Select a word to see its details</p>
          </div>
        )}
      </div>
    </div>
  )
}

function blankState(simplified: string, word?: Word): WordState {
  return {
    simplified,
    ...getDefaultState(),
    status: 'Unstudied',
    deckName: word?.deck_name ?? '',
    analytics: {
      totalReviews: 0,
      correctMeaningCount: 0,
      incorrectMeaningCount: 0,
      correctPronCount: 0,
      incorrectPronCount: 0,
      hskLevel: word?.hsk_level ?? null,
      firstSeenAt: null,
      lastReviewedAt: null,
    },
  }
}

function ViewTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary'
      }`}
    >
      {label}
    </button>
  )
}

function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string
  title: string
  body: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 gap-2">
      <p className="text-4xl">{icon}</p>
      <p className="text-text-primary font-medium">{title}</p>
      <p className="text-sm text-text-muted max-w-xs">{body}</p>
      {action && (
        <button onClick={action.onClick} className="text-sm text-accent hover:underline mt-1">
          {action.label}
        </button>
      )}
    </div>
  )
}
