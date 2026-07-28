import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { ForecastBucket } from '../lib/dashboardStats'
import {
  AXIS_TICK,
  AXIS_TICK_SM,
  BAR_RADIUS,
  CHART_GRID,
  MAX_BAR_SIZE,
  SERIES_1,
  STATUS_WARNING,
  TOOLTIP_PROPS,
} from '../lib/chartTheme'
import ChartEmpty from './ChartEmpty'

/**
 * Scheduled reviews for the next fortnight. Single series, so no legend — the
 * card title names it. The first column carries everything overdue and wears
 * the warning status colour, always with its "Today" label beside it.
 */
export default function ForecastChart({ data }: { data: ForecastBucket[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0)
  if (total === 0) {
    return <ChartEmpty message="Nothing scheduled in the next two weeks." />
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
        <YAxis
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={44}
        />
        <Tooltip {...TOOLTIP_PROPS} formatter={(v: number) => [`${v} cards`, 'Scheduled']} />
        <Bar dataKey="count" radius={BAR_RADIUS} maxBarSize={MAX_BAR_SIZE}>
          {data.map((d) => (
            <Cell key={d.date} fill={d.overdue ? STATUS_WARNING : SERIES_1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
