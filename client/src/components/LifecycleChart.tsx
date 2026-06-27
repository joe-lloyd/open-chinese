import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface Props {
  statusCounts: Record<string, number>
}

const STATUSES = ['Unstudied', 'Weak', 'Strong', 'Memorized', 'Mastered']
const COLORS: Record<string, string> = {
  Unstudied: '#6b7280',
  Weak: '#ef4444',
  Strong: '#f59e0b',
  Memorized: '#3b82f6',
  Mastered: '#22c55e',
}

export default function LifecycleChart({ statusCounts }: Props) {
  const data = STATUSES.map((s) => ({
    status: s,
    count: statusCounts[s] ?? 0,
  })).filter((d) => d.count > 0)

  if (data.length === 0) {
    return <div className="h-40 flex items-center justify-center text-text-muted text-sm">No data</div>
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <XAxis dataKey="status" tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} />
        <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} />
        <Tooltip
          contentStyle={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 8 }}
          labelStyle={{ color: 'var(--color-text-primary)' }}
          itemStyle={{ color: 'var(--color-text-primary)' }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.status} fill={COLORS[entry.status]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
