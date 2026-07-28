import { SORT_OPTIONS, WORD_STATUSES, hasActiveFilters } from '../lib/dictionary'
import type { DictFilters, SortKey } from '../lib/dictionary'

interface Props {
  filters: DictFilters
  onFiltersChange: (f: DictFilters) => void
  sort: SortKey
  onSortChange: (s: SortKey) => void
  hskLevels: number[]
  decks: string[]
  count: number
  onClear: () => void
}

const selectClass =
  'bg-surface-raised border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent'

export default function WordFilterBar({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  hskLevels,
  decks,
  count,
  onClear,
}: Props) {
  return (
    <div className="px-4 py-3 border-b border-border space-y-2">
      <div className="flex flex-wrap gap-2">
        <select
          value={filters.status}
          onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
          className={selectClass}
        >
          <option value="">All statuses</option>
          {WORD_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={filters.hsk}
          onChange={(e) => onFiltersChange({ ...filters, hsk: e.target.value })}
          className={selectClass}
        >
          <option value="">All levels</option>
          {hskLevels.map((l) => (
            <option key={l} value={String(l)}>HSK {l}</option>
          ))}
        </select>

        {decks.length > 1 && (
          <select
            value={filters.deck}
            onChange={(e) => onFiltersChange({ ...filters, deck: e.target.value })}
            className={selectClass}
          >
            <option value="">All decks</option>
            {decks.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}

        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
          className={`${selectClass} ml-auto`}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span>{count} {count === 1 ? 'word' : 'words'}</span>
        {hasActiveFilters(filters) && (
          <button onClick={onClear} className="text-accent hover:underline">
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
