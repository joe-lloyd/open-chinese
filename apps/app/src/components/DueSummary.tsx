import { Link } from 'react-router-dom'

interface Props {
  dueCount: number
  newCount: number
  leechCount: number
}

const ITEM =
  'bg-surface-raised border border-border rounded-2xl p-4 flex flex-col xl:flex-row xl:items-baseline xl:justify-between xl:gap-3 transition-colors'

/**
 * Three counters. A row when the dashboard is stacked; at `xl` it sits in the
 * narrow rail, where the same markup reflows to one item per line with the
 * value beside its label instead of squeezing three columns into a third of
 * the width.
 */
export default function DueSummary({ dueCount, newCount, leechCount }: Props) {
  return (
    <div className="grid grid-cols-3 xl:grid-cols-1 gap-3">
      <Link to="/study" className={`${ITEM} hover:border-accent`}>
        <p className="text-2xl sm:text-3xl font-bold text-accent leading-none">{dueCount.toLocaleString()}</p>
        <p className="text-xs sm:text-sm text-text-muted mt-2 xl:mt-0">Due now</p>
      </Link>

      <Link to="/queue" className={`${ITEM} hover:border-accent`}>
        <p className="text-2xl sm:text-3xl font-bold text-text-primary leading-none">{newCount.toLocaleString()}</p>
        <p className="text-xs sm:text-sm text-text-muted mt-2 xl:mt-0">New available</p>
      </Link>

      <Link to="/#leeches" className={`${ITEM} hover:border-incorrect/50`}>
        <p className={`text-2xl sm:text-3xl font-bold leading-none ${leechCount > 0 ? 'text-incorrect' : 'text-text-muted'}`}>
          {leechCount.toLocaleString()}
        </p>
        <p className="text-xs sm:text-sm text-text-muted mt-2 xl:mt-0">Leeches</p>
      </Link>
    </div>
  )
}
