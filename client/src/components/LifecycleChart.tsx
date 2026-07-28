import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  AXIS_TICK,
  BAR_RADIUS,
  CHART_GRID,
  LIFECYCLE_COLOR,
  LIFECYCLE_STATUSES,
  MAX_BAR_SIZE,
  TOOLTIP_PROPS,
} from '../lib/chartTheme'
import ChartEmpty from './ChartEmpty'

interface Props {
  statusCounts: Record<string, number>
}

/**
 * Lifecycle is an ordered progression, so it takes a one-hue ramp with
 * monotone lightness — the colour carries the order. Leech is deliberately
 * absent: it is a status, not a lifecycle stage, and lives in its own panel.
 */
export default function LifecycleChart({ statusCounts }: Props) {
  const data = LIFECYCLE_STATUSES.map((s) => ({
    status: s,
    count: statusCounts[s] ?? 0,
  })).filter((d) => d.count > 0)

  if (data.length === 0) return <ChartEmpty message="No words tracked yet." />

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={CHART_GRID} strokeWidth={1} vertical={false} />
        <XAxis dataKey="status" tick={AXIS_TICK} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
        <YAxis
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={44}
          tickFormatter={(v: number) => v.toLocaleString()}
        />
        <Tooltip {...TOOLTIP_PROPS} formatter={(v: number) => [v.toLocaleString(), 'Words']} />
        <Bar dataKey="count" radius={BAR_RADIUS} maxBarSize={MAX_BAR_SIZE}>
          {data.map((entry) => (
            <Cell key={entry.status} fill={LIFECYCLE_COLOR[entry.status]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
