import type { SkillSplitData } from '../lib/dashboardStats'
import { SERIES_1, SERIES_2 } from '../lib/chartTheme'
import ChartEmpty from './ChartEmpty'

function Meter({ label, color, pct, correct, total }: {
  label: string
  color: string
  pct: number
  correct: number
  total: number
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-text-primary">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} aria-hidden="true" />
          {label}
        </span>
        <span className="text-sm font-semibold text-text-primary tabular-nums">{pct}%</span>
      </div>
      {/* Track is a lighter step of the fill's own hue, so state reads across
          the whole bar rather than only in the filled part. */}
      <div className="relative h-2 rounded-full overflow-hidden">
        <div className="absolute inset-0" style={{ background: color, opacity: 0.18 }} />
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <p className="text-xs text-text-muted tabular-nums">
        {correct.toLocaleString()} of {total.toLocaleString()} correct
      </p>
    </div>
  )
}

/**
 * Two series, so the swatch beside each label is the identity channel and the
 * value is written out — never colour alone. Meters rather than a two-bar
 * chart: each is a single ratio against a fixed 100% limit.
 */
export default function SkillSplit({ data }: { data: SkillSplitData | null }) {
  if (!data) return <ChartEmpty message="No graded reviews yet." height={140} />

  return (
    <div className="space-y-5">
      <Meter
        label="Pronunciation"
        color={SERIES_1}
        pct={data.pronunciation.pct}
        correct={data.pronunciation.correct}
        total={data.pronunciation.total}
      />
      <Meter
        label="Meaning"
        color={SERIES_2}
        pct={data.meaning.pct}
        correct={data.meaning.correct}
        total={data.meaning.total}
      />
    </div>
  )
}
