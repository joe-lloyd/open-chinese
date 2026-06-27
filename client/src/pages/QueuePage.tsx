import { useEffect, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getDeckSummaries, getDeckWords, markWordsKnown, saveDeckPriority, getProfile } from '../lib/firestore'
import { getCurrentUid } from '../lib/auth'
import { loadDB } from '../lib/worddb'

interface Deck {
  deckName: string
  wordCount: number
  dueCount: number
}

interface DeckWord {
  simplified: string
  pinyin: string
  definition: string
  status: string
}

const MODES = ['Standard', 'RefreshWeak', 'Cram', 'HardOnly'] as const
type Mode = (typeof MODES)[number]

const MODE_LABELS: Record<Mode, string> = {
  Standard: 'Standard',
  RefreshWeak: 'Refresh Weak',
  Cram: 'Cram',
  HardOnly: 'Hard Only',
}

function SortableDeck({
  deck,
  expanded,
  onToggle,
  words,
  selectedIds,
  onToggleWord,
  onMarkKnown,
  mode,
  onModeChange,
}: {
  deck: Deck
  expanded: boolean
  onToggle: () => void
  words: DeckWord[]
  selectedIds: Set<string>
  onToggleWord: (s: string) => void
  onMarkKnown: () => void
  mode: Mode
  onModeChange: (m: Mode) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: deck.deckName,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="bg-surface-raised border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button {...attributes} {...listeners} className="text-text-muted cursor-grab active:cursor-grabbing text-lg">
          ⠿
        </button>
        <button onClick={onToggle} className="flex-1 text-left">
          <span className="font-medium text-text-primary">{deck.deckName}</span>
          <span className="text-sm text-text-muted ml-3">
            {deck.wordCount} words · {deck.dueCount} due
          </span>
        </button>
        <select
          value={mode}
          onChange={(e) => onModeChange(e.target.value as Mode)}
          onClick={(e) => e.stopPropagation()}
          className="text-sm bg-surface border border-border rounded-lg px-2 py-1 text-text-muted focus:outline-none focus:border-accent"
        >
          {MODES.map((m) => (
            <option key={m} value={m}>{MODE_LABELS[m]}</option>
          ))}
        </select>
      </div>

      {expanded && (
        <div className="border-t border-border">
          {selectedIds.size > 0 && (
            <div className="px-4 py-2 bg-accent/5 border-b border-border flex items-center justify-between">
              <span className="text-sm text-text-muted">{selectedIds.size} selected</span>
              <button onClick={onMarkKnown} className="text-sm px-3 py-1 bg-accent text-white rounded-lg hover:opacity-90">
                Mark as Known
              </button>
            </div>
          )}
          <div className="max-h-64 overflow-y-auto divide-y divide-border">
            {words.map((w) => (
              <label key={w.simplified} className="flex items-center gap-3 px-4 py-2 hover:bg-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.has(w.simplified)}
                  onChange={() => onToggleWord(w.simplified)}
                  className="accent-[var(--color-accent)]"
                />
                <span className="text-lg text-text-primary">{w.simplified}</span>
                <span className="text-sm text-text-muted">{w.pinyin}</span>
                <span className="text-sm text-text-muted flex-1 truncate">{w.definition}</span>
                <span className="text-xs text-text-muted">{w.status}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function QueuePage() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [expandedDeck, setExpandedDeck] = useState<string | null>(null)
  const [deckWords, setDeckWords] = useState<Record<string, DeckWord[]>>({})
  const [selectedIds, setSelectedIds] = useState<Record<string, Set<string>>>({})
  const [deckModes, setDeckModes] = useState<Record<string, Mode>>({})

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function loadDecks() {
    const uid = getCurrentUid()
    if (!uid) return
    const [summaries, profile] = await Promise.all([getDeckSummaries(uid), getProfile(uid)])
    const priority = profile?.deckPriority ?? {}
    const sorted = [...summaries].sort((a, b) => (priority[a.deckName] ?? 99) - (priority[b.deckName] ?? 99))
    setDecks(sorted)
  }

  useEffect(() => { loadDecks() }, [])

  async function toggleDeck(deckName: string) {
    if (expandedDeck === deckName) { setExpandedDeck(null); return }
    setExpandedDeck(deckName)
    if (!deckWords[deckName]) {
      const uid = getCurrentUid()
      if (!uid) return
      const [words, worddb] = await Promise.all([getDeckWords(uid, deckName), loadDB()])
      const mapped: DeckWord[] = words.map((w) => {
        const data = worddb.getWord(w.simplified)
        return {
          simplified: w.simplified,
          pinyin: data?.pinyin ?? w.customWordData?.pinyin ?? '',
          definition: data?.definition ?? w.customWordData?.definition ?? '',
          status: w.status,
        }
      })
      setDeckWords((prev) => ({ ...prev, [deckName]: mapped }))
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = decks.findIndex((d) => d.deckName === active.id)
    const newIndex = decks.findIndex((d) => d.deckName === over.id)
    const reordered = arrayMove(decks, oldIndex, newIndex)
    setDecks(reordered)
    const uid = getCurrentUid()
    if (uid) {
      await saveDeckPriority(uid, reordered.map((d) => d.deckName))
    }
  }

  function toggleWord(deckName: string, simplified: string) {
    setSelectedIds((prev) => {
      const set = new Set(prev[deckName] ?? [])
      if (set.has(simplified)) set.delete(simplified)
      else set.add(simplified)
      return { ...prev, [deckName]: set }
    })
  }

  async function markKnown(deckName: string) {
    const ids = Array.from(selectedIds[deckName] ?? [])
    if (!ids.length) return
    const uid = getCurrentUid()
    if (!uid) return
    await markWordsKnown(uid, ids)
    setSelectedIds((prev) => ({ ...prev, [deckName]: new Set() }))
    await loadDecks()
    setDeckWords((prev) => {
      const { [deckName]: _, ...rest } = prev
      return rest
    })
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Queue Manager</h1>
      <p className="text-text-muted text-sm">Drag to reorder deck priority. Top decks are reviewed first.</p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={decks.map((d) => d.deckName)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {decks.map((deck) => (
              <SortableDeck
                key={deck.deckName}
                deck={deck}
                expanded={expandedDeck === deck.deckName}
                onToggle={() => toggleDeck(deck.deckName)}
                words={deckWords[deck.deckName] ?? []}
                selectedIds={selectedIds[deck.deckName] ?? new Set()}
                onToggleWord={(s) => toggleWord(deck.deckName, s)}
                onMarkKnown={() => markKnown(deck.deckName)}
                mode={(deckModes[deck.deckName] ?? 'Standard') as Mode}
                onModeChange={(m) => setDeckModes((prev) => ({ ...prev, [deck.deckName]: m }))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {decks.length === 0 && (
        <div className="text-center text-text-muted py-16">
          <p className="text-4xl mb-3">📋</p>
          <p>No decks yet. Import a CSV to get started.</p>
        </div>
      )}
    </div>
  )
}
