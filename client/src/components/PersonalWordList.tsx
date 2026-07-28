import { formatDate } from '../lib/dictionary'
import type { DictEntry } from '../lib/dictionary'
import StatusBadge from './StatusBadge'

export const PAGE_SIZE = 50

interface Props {
  entries: DictEntry[]
  page: number
  onPageChange: (p: number) => void
  selected: Set<string>
  onToggleSelect: (simplified: string) => void
  onToggleSelectPage: (simplifieds: string[], select: boolean) => void
  selectedKey: string | null
  onSelect: (entry: DictEntry) => void
  onMarkKnown: (simplifieds: string[]) => void
  onUnmark: (simplifieds: string[]) => void
  onClearSelection: () => void
}

export default function PersonalWordList({
  entries,
  page,
  onPageChange,
  selected,
  onToggleSelect,
  onToggleSelectPage,
  selectedKey,
  onSelect,
  onMarkKnown,
  onUnmark,
  onClearSelection,
}: Props) {
  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE))
  const start = page * PAGE_SIZE
  // Only this slice is ever in the DOM — the personal dictionary is expected to
  // hold a few thousand words.
  const visible = entries.slice(start, start + PAGE_SIZE)
  const visibleKeys = visible.map((e) => e.simplified)
  const allPageSelected = visibleKeys.length > 0 && visibleKeys.every((k) => selected.has(k))
  const selectedList = [...selected]

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {selectedList.length > 0 && (
        <div className="px-4 py-2 bg-accent/5 border-b border-border flex flex-wrap items-center gap-2">
          <span className="text-sm text-text-muted">{selectedList.length} selected</span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => onMarkKnown(selectedList)}
              className="text-sm px-3 py-1 bg-accent text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Mark as known
            </button>
            <button
              onClick={() => onUnmark(selectedList)}
              className="text-sm px-3 py-1 border border-border rounded-lg text-text-muted hover:text-text-primary transition-colors"
            >
              Unmark
            </button>
            <button
              onClick={onClearSelection}
              className="text-sm px-2 py-1 text-text-muted hover:text-text-primary transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="hidden md:flex items-center gap-3 px-4 py-2 border-b border-border text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        <input
          type="checkbox"
          checked={allPageSelected}
          onChange={(e) => onToggleSelectPage(visibleKeys, e.target.checked)}
          className="accent-[var(--color-accent)]"
          aria-label="Select all on this page"
        />
        <span className="w-28 shrink-0">Word</span>
        <span className="flex-1 min-w-0">Definition</span>
        <span className="w-24 text-center">Status</span>
        <span className="hidden lg:block w-14 text-right">HSK</span>
        <span className="w-14 text-right">Known</span>
        <span className="hidden lg:block w-24 text-right">Reviewed</span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {visible.map((e) => (
          <div
            key={e.simplified}
            className={`flex items-center gap-3 px-4 py-2 hover:bg-surface-raised transition-colors ${
              selectedKey === e.simplified ? 'bg-accent/10' : ''
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(e.simplified)}
              onChange={() => onToggleSelect(e.simplified)}
              className="accent-[var(--color-accent)] shrink-0"
              aria-label={`Select ${e.simplified}`}
            />
            <button
              onClick={() => onSelect(e)}
              className="flex-1 min-w-0 flex items-center gap-3 text-left"
            >
              <span className="w-28 shrink-0">
                <span className="block text-lg text-text-primary leading-tight">{e.simplified}</span>
                <span className="block text-xs text-text-muted truncate">{e.pinyin}</span>
              </span>
              <span className="flex-1 min-w-0 truncate text-sm text-text-muted">{e.definition}</span>
              <span className="w-24 flex justify-center">
                <StatusBadge status={e.status} />
              </span>
              <span className="hidden lg:block w-14 text-right text-xs text-text-muted">
                {e.hskLevel ? `HSK ${e.hskLevel}` : '—'}
              </span>
              <span className="w-14 text-right text-xs text-text-muted">
                {e.knowledge === null ? '—' : `${e.knowledge}%`}
              </span>
              <span className="hidden lg:block w-24 text-right text-xs text-text-muted">
                {formatDate(e.lastReviewedAt)}
              </span>
            </button>
          </div>
        ))}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-border text-sm">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
            className="px-3 py-1 border border-border rounded-lg text-text-muted enabled:hover:text-text-primary disabled:opacity-40 transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-text-muted">
            {start + 1}–{Math.min(start + PAGE_SIZE, entries.length)} of {entries.length}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount - 1}
            className="px-3 py-1 border border-border rounded-lg text-text-muted enabled:hover:text-text-primary disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
