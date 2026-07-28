import { Link } from 'react-router-dom'
import type { HskLevelProgress } from '../lib/dashboardStats'
import { SERIES_1 } from '../lib/chartTheme'
import ChartEmpty from './ChartEmpty'

export default function HskProgress({ levels }: { levels: HskLevelProgress[] }) {
  if (levels.length === 0) return <ChartEmpty message="No HSK levels in the word list." height={120} />

  return (
    <ul className="space-y-3">
      {levels.map((l) => (
        <li key={l.level}>
          <Link
            to={`/study?hsk=${l.level}`}
            className="block group rounded-lg -mx-1 px-1 py-1 hover:bg-surface transition-colors"
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-text-primary group-hover:text-accent transition-colors">HSK {l.level}</span>
              <span className="text-text-muted tabular-nums text-xs">
                {l.studied.toLocaleString()} / {l.total.toLocaleString()} &middot; {l.pct}%
              </span>
            </div>
            <div className="relative h-1.5 rounded-full overflow-hidden mt-1.5">
              <div className="absolute inset-0" style={{ background: SERIES_1, opacity: 0.18 }} />
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                style={{ width: `${l.pct}%`, background: SERIES_1 }}
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
