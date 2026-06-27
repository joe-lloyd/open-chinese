import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts'

interface Props {
  data: { date: string; rate: number }[]
}

export default function RetentionChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="h-40 flex items-center justify-center text-text-muted text-sm">No review history yet</div>
  }

  const display = data.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={display}>
        <XAxis dataKey="label" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis domain={[0, 100]} unit="%" tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} />
        <Tooltip
          formatter={(v: number) => `${v}%`}
          contentStyle={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 8 }}
          labelStyle={{ color: 'var(--color-text-primary)' }}
          itemStyle={{ color: 'var(--color-text-primary)' }}
        />
        <ReferenceArea y1={85} y2={90} fill="var(--color-correct)" fillOpacity={0.1} />
        <ReferenceLine y={85} stroke="var(--color-correct)" strokeDasharray="3 3" strokeOpacity={0.5} />
        <ReferenceLine y={90} stroke="var(--color-correct)" strokeDasharray="3 3" strokeOpacity={0.5} />
        <Line
          type="monotone"
          dataKey="rate"
          stroke="var(--color-accent)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
