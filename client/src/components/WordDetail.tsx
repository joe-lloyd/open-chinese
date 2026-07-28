import { useState } from 'react'
import { formatDate } from '../lib/dictionary'
import type { DictEntry } from '../lib/dictionary'
import CharacterBreakdown from './CharacterBreakdown'
import HskBadge from './HskBadge'
import StatusBadge from './StatusBadge'

interface Props {
  entry: DictEntry
  onBack: () => void
  onSaveNotes: (notes: string) => Promise<void>
  onMarkKnown: () => void
  onUnmark: () => void
  onAdd: () => void
}

export default function WordDetail({ entry, onBack, onSaveNotes, onMarkKnown, onUnmark, onAdd }: Props) {
  const [noteText, setNoteText] = useState(entry.notes)
  const [noteSaved, setNoteSaved] = useState(false)

  async function save() {
    await onSaveNotes(noteText)
    setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-lg">
      <button
        onClick={onBack}
        className="md:hidden text-sm text-text-muted flex items-center gap-1 hover:text-text-primary transition-colors"
      >
        ← Back to list
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-5xl font-light text-text-primary">{entry.simplified}</h1>
          {entry.traditional && entry.traditional !== entry.simplified && (
            <p className="text-2xl text-text-muted mt-1">{entry.traditional}</p>
          )}
        </div>
        <HskBadge level={entry.hskLevel} size="lg" />
      </div>

      <p className="text-xl text-accent">{entry.pinyin}</p>
      <p className="text-text-primary">{entry.definition}</p>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={entry.status} />
        {entry.deckName && <span className="text-xs text-text-muted">{entry.deckName}</span>}
      </div>

      {entry.totalReviews !== null && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-raised border border-border rounded-xl p-4">
          <Stat label="Reviews" value={String(entry.totalReviews)} />
          <Stat label="Known" value={entry.knowledge === null ? '—' : `${entry.knowledge}%`} />
          <Stat label="First seen" value={formatDate(entry.firstSeenAt)} />
          <Stat label="Reviewed" value={formatDate(entry.lastReviewedAt)} />
        </dl>
      )}

      <div className="flex flex-wrap gap-2">
        {!entry.inDictionary && (
          <button
            onClick={onAdd}
            className="px-4 py-1.5 border border-border rounded-lg text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            Add to my dictionary
          </button>
        )}
        {entry.status === 'Mastered' ? (
          <button
            onClick={onUnmark}
            className="px-4 py-1.5 border border-border rounded-lg text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            Unmark as known
          </button>
        ) : (
          <button
            onClick={onMarkKnown}
            className="px-4 py-1.5 bg-accent text-white rounded-lg text-sm hover:opacity-90 transition-opacity"
          >
            Mark as fully known
          </button>
        )}
      </div>

      <section>
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
          Character Breakdown
        </h2>
        <CharacterBreakdown text={entry.simplified} />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-2">Your Notes</h2>
        <textarea
          value={noteText}
          onChange={(e) => { setNoteText(e.target.value); setNoteSaved(false) }}
          placeholder="Add personal notes, mnemonics, examples…"
          className="w-full bg-surface-raised border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent min-h-24 resize-none"
        />
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={save}
            className="px-4 py-1.5 bg-accent text-white rounded-lg text-sm hover:opacity-90 transition-opacity"
          >
            Save
          </button>
          {noteSaved && <span className="text-correct text-sm">Saved!</span>}
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">{label}</dt>
      <dd className="text-sm text-text-primary mt-0.5">{value}</dd>
    </div>
  )
}
