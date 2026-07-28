import { CHART_EMPTY } from '../lib/chartTheme'

interface Props {
  data: { date: string; count: number }[]
}

/**
 * Magnitude, so the colour is sequential: one hue, more-is-stronger. It reuses
 * the lifecycle ramp's steps, whose dark-mode values flip anchor, so a busy day
 * stands out against the surface in either theme.
 */
const RAMP = ['var(--chart-life-1)', 'var(--chart-life-2)', 'var(--chart-life-3)', 'var(--chart-life-4)']

function intensityColor(count: number, max: number): string {
  if (count === 0) return CHART_EMPTY
  const ratio = count / max
  if (ratio < 0.25) return RAMP[0]
  if (ratio < 0.5) return RAMP[1]
  if (ratio < 0.75) return RAMP[2]
  return RAMP[3]
}

export default function ActivityHeatmap({ data }: Props) {
  const countMap = new Map(data.map((d) => [d.date, d.count]))
  const max = Math.max(...data.map((d) => d.count), 1)

  const today = new Date()
  const weeks: { date: string; count: number }[][] = []

  // Build 52 weeks starting from the Monday 52 weeks ago
  const start = new Date(today)
  start.setDate(start.getDate() - 364)
  // Align to Monday
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))

  for (let w = 0; w < 53; w++) {
    const week: { date: string; count: number }[] = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(start)
      date.setDate(start.getDate() + w * 7 + d)
      const key = date.toISOString().split('T')[0]
      week.push({ date: key, count: countMap.get(key) ?? 0 })
    }
    weeks.push(week)
  }

  return (
    <div className="space-y-3">
      {/* Wider than its card at most viewports — it scrolls inside itself so the
          page never gains a horizontal scrollbar. */}
      <div className="overflow-x-auto">
        <div className="flex gap-0.5 min-w-max">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map(({ date, count }) => (
                <div
                  key={date}
                  title={`${date}: ${count} ${count === 1 ? 'review' : 'reviews'}`}
                  className="w-3 h-3 rounded-sm"
                  style={{ background: intensityColor(count, max) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-1.5 text-[11px] text-text-muted">
        <span>Less</span>
        <span className="w-3 h-3 rounded-sm" style={{ background: CHART_EMPTY }} />
        {RAMP.map((c) => (
          <span key={c} className="w-3 h-3 rounded-sm" style={{ background: c }} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
