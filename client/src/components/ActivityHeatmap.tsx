interface Props {
  data: { date: string; count: number }[]
}

function getIntensity(count: number, max: number): string {
  if (count === 0) return 'bg-border'
  const ratio = count / max
  if (ratio < 0.25) return 'bg-accent/25'
  if (ratio < 0.5) return 'bg-accent/50'
  if (ratio < 0.75) return 'bg-accent/75'
  return 'bg-accent'
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
    <div className="overflow-x-auto">
      <div className="flex gap-0.5 min-w-max">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map(({ date, count }) => (
              <div
                key={date}
                title={`${date}: ${count} reviews`}
                className={`w-3 h-3 rounded-sm ${getIntensity(count, max)}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
