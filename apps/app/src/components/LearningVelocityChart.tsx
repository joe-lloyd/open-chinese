import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { VelocityWeek } from '../lib/dashboardStats'
import {
  AXIS_TICK,
  AXIS_TICK_SM,
  BAR_RADIUS,
  CHART_GRID,
  MAX_BAR_SIZE,
  SERIES_1,
  TOOLTIP_PROPS,
} from '../lib/chartTheme'
import ChartEmpty from './ChartEmpty'

/** New words seen per week. Single series — no legend, the card title names it. */
export default function LearningVelocityChart({ data }: { data: VelocityWeek[] }) {
  const total = data.reduce((sum, d) => sum + d.newWords, 0)
  if (total === 0) {
    return <ChartEmpty message="No new words in the last 12 weeks." />
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={CHART_GRID} strokeWidth={1} vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS_TICK_SM}
          axisLine={{ stroke: CHART_GRID }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={44} />
        <Tooltip
          {...TOOLTIP_PROPS}
          labelFormatter={(label: string) => `Week of ${label}`}
          formatter={(v: number) => [`${v} words`, 'New']}
        />
        <Bar dataKey="newWords" fill={SERIES_1} radius={BAR_RADIUS} maxBarSize={MAX_BAR_SIZE} />
      </BarChart>
    </ResponsiveContainer>
  )
}
