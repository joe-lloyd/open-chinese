import { Link } from 'react-router-dom'
import type { Recommendation, RecommendationTone } from '../lib/recommendations'

const TONE: Record<RecommendationTone, { bar: string; cta: string }> = {
  accent: { bar: 'bg-accent', cta: 'text-accent' },
  good: { bar: 'bg-correct', cta: 'text-correct' },
  warning: { bar: 'bg-unrecognized', cta: 'text-unrecognized' },
  critical: { bar: 'bg-incorrect', cta: 'text-incorrect' },
  neutral: { bar: 'bg-text-muted', cta: 'text-text-muted' },
}

/** Only as many columns as there are cards, so one recommendation does not
 *  render as a lone third of a row. */
const COLUMNS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
}

export default function NextUpPanel({ recommendations }: { recommendations: Recommendation[] }) {
  return (
    <div className={`grid gap-3 lg:gap-4 ${COLUMNS[recommendations.length] ?? COLUMNS[3]}`}>
      {recommendations.map((r) => {
        const tone = TONE[r.tone]
        return (
          <Link
            key={r.id}
            to={r.to}
            className="relative overflow-hidden bg-surface-raised border border-border rounded-2xl p-4 sm:p-5 pl-5 sm:pl-6 hover:border-accent transition-colors flex flex-col"
          >
            <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden="true" />
            <h3 className="text-base font-semibold text-text-primary">{r.title}</h3>
            <p className="text-sm text-text-muted mt-1 flex-1">{r.detail}</p>
            <span className={`text-sm font-medium mt-3 ${tone.cta}`}>{r.cta} &rarr;</span>
          </Link>
        )
      })}
    </div>
  )
}
