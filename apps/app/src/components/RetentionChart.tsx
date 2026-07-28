import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts'
import {
  AXIS_TICK,
  AXIS_TICK_SM,
  CHART_GRID,
  SERIES_1,
  STATUS_GOOD,
  TOOLTIP_PROPS,
} from '../lib/chartTheme'
import ChartEmpty from './ChartEmpty'

interface Props {
  data: { date: string; rate: number }[]
}

/** Single series — no legend; the card title names it. */
export default function RetentionChart({ data }: Props) {
  if (data.length === 0) return <ChartEmpty message="No review history yet." />

  const display = data.map((d) => ({ ...d, label: d.date.slice(5) }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={display} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={CHART_GRID} strokeWidth={1} vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS_TICK_SM}
          axisLine={{ stroke: CHART_GRID }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          unit="%"
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip {...TOOLTIP_PROPS} cursor={{ stroke: CHART_GRID }} formatter={(v: number) => [`${v}%`, 'Retention']} />
        {/* Target band, 85–90%. */}
        <ReferenceArea y1={85} y2={90} fill={STATUS_GOOD} fillOpacity={0.1} />
        <ReferenceLine y={85} stroke={STATUS_GOOD} strokeDasharray="3 3" strokeOpacity={0.5} />
        <ReferenceLine y={90} stroke={STATUS_GOOD} strokeDasharray="3 3" strokeOpacity={0.5} />
        <Line type="monotone" dataKey="rate" stroke={SERIES_1} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
