import { useEffect, useRef, useState } from 'react'
import { loadDB } from '../lib/worddb'
import type { Word } from '../lib/worddb'
import { getUserWord, saveNotes } from '../lib/firestore'
import { getCurrentUid } from '../lib/auth'
import CharacterBreakdown from '../components/CharacterBreakdown'
import HskBadge from '../components/HskBadge'

interface WordWithStatus extends Word {
  status: string
  notes: string | null
}

export default function DictionaryPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Word[]>([])
  const [selected, setSelected] = useState<WordWithStatus | null>(null)
  const [noteText, setNoteText] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const dbRef = useRef<Awaited<ReturnType<typeof loadDB>> | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadDB().then((db) => { dbRef.current = db })
  }, [])

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (!query.trim()) { setResults([]); return }
    debounce.current = setTimeout(() => {
      if (!dbRef.current) return
      setResults(dbRef.current.searchWords(query))
    }, 250)
  }, [query])

  async function selectWord(w: Word) {
    setLoadingStatus(true)
    setNoteSaved(false)
    const uid = getCurrentUid()
    let status = 'Unstudied'
    let notes: string | null = null
    if (uid) {
      const userWord = await getUserWord(uid, w.simplified)
      status = userWord?.status ?? 'Unstudied'
      notes = userWord?.notes ?? null
    }
    setSelected({ ...w, status, notes })
    setNoteText(notes ?? '')
    setLoadingStatus(false)
  }

  async function saveNote() {
    if (!selected) return
    const uid = getCurrentUid()
    if (!uid) return
    await saveNotes(uid, selected.simplified, noteText)
    setSelected({ ...selected, notes: noteText })
    setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 2000)
  }

  return (
    <div className="flex flex-col md:flex-row md:h-screen">
      <div className={`${selected ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-b md:border-b-0 md:border-r border-border`}>
        <div className="p-4 border-b border-border">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search characters, pinyin, or definition…"
            className="w-full bg-surface-raised border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>
        <div className="overflow-y-auto max-h-72 md:max-h-none md:flex-1">
          {results.map((w) => (
            <button
              key={w.simplified}
              onClick={() => selectWord(w)}
              className={`w-full text-left px-4 py-3 border-b border-border hover:bg-surface-raised transition-colors ${
                selected?.simplified === w.simplified ? 'bg-accent/10' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl text-text-primary">{w.simplified}</span>
                <HskBadge level={w.hsk_level} />
              </div>
              <p className="text-sm text-text-muted mt-0.5">{w.pinyin}</p>
            </button>
          ))}
          {query && results.length === 0 && (
            <p className="p-4 text-sm text-text-muted">No results</p>
          )}
        </div>
      </div>

      <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 overflow-y-auto p-6 md:p-8 flex-col`}>
        {selected ? (
          <div className="space-y-6 max-w-lg">
            <button
              onClick={() => setSelected(null)}
              className="md:hidden text-sm text-text-muted flex items-center gap-1 mb-2 hover:text-text-primary transition-colors"
            >
              ← Back to search
            </button>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-5xl font-light text-text-primary">{selected.simplified}</h1>
                {selected.traditional && selected.traditional !== selected.simplified && (
                  <p className="text-2xl text-text-muted mt-1">{selected.traditional}</p>
                )}
              </div>
              <HskBadge level={selected.hsk_level} size="lg" />
            </div>
            <p className="text-xl text-accent">{selected.pinyin}</p>
            <p className="text-text-primary">{selected.definition}</p>
            <p className="text-sm text-text-muted">
              Status: <span className="text-text-primary">{loadingStatus ? '…' : selected.status}</span>
            </p>

            <section>
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
                Character Breakdown
              </h2>
              <CharacterBreakdown text={selected.simplified} />
            </section>

            <section>
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-2">
                Your Notes
              </h2>
              <textarea
                value={noteText}
                onChange={(e) => { setNoteText(e.target.value); setNoteSaved(false) }}
                placeholder="Add personal notes, mnemonics, examples…"
                className="w-full bg-surface-raised border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent min-h-24 resize-none"
              />
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={saveNote}
                  className="px-4 py-1.5 bg-accent text-white rounded-lg text-sm hover:opacity-90 transition-opacity"
                >
                  Save
                </button>
                {noteSaved && <span className="text-correct text-sm">Saved!</span>}
              </div>
            </section>
          </div>
        ) : (
          <div className="text-text-muted text-center mt-24">
            <p className="text-4xl mb-3">📖</p>
            <p>Search for a word to see its details</p>
          </div>
        )}
      </div>
    </div>
  )
}
