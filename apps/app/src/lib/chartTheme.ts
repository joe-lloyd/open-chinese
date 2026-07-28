/**
 * Chart roles, so Recharts props reference a role rather than a hex and the
 * light/dark values stay in one place (index.css). Colours were chosen by the
 * job the data does — ordinal for lifecycle, categorical for the two graded
 * subskills, status for leech/overdue — and validated against the chart
 * surface in both themes.
 */

/** Ordinal: Unstudied -> Weak -> Strong -> Memorized -> Mastered. */
export const LIFECYCLE_STATUSES = ['Unstudied', 'Weak', 'Strong', 'Memorized', 'Mastered'] as const

export const LIFECYCLE_COLOR: Record<string, string> = {
  Unstudied: 'var(--chart-life-1)',
  Weak: 'var(--chart-life-2)',
  Strong: 'var(--chart-life-3)',
  Memorized: 'var(--chart-life-4)',
  Mastered: 'var(--chart-life-5)',
}

/** Categorical slots. Slot 1 is also the single-series default. */
export const SERIES_1 = 'var(--chart-series-1)'
export const SERIES_2 = 'var(--chart-series-2)'

/**
 * Status is reserved and never doubles as "series 3". Each usage ships with a
 * visible label — status never carries meaning by colour alone.
 */
export const STATUS_GOOD = 'var(--color-correct)'
export const STATUS_WARNING = 'var(--color-unrecognized)'
export const STATUS_CRITICAL = 'var(--color-incorrect)'

export const CHART_GRID = 'var(--chart-grid)'
export const CHART_EMPTY = 'var(--chart-empty)'
export const CHART_SURFACE = 'var(--color-surface-raised)'

export const AXIS_TICK = { fill: 'var(--color-text-muted)', fontSize: 12 } as const
export const AXIS_TICK_SM = { fill: 'var(--color-text-muted)', fontSize: 10 } as const

export const TOOLTIP_PROPS = {
  cursor: { fill: 'var(--color-text-muted)', fillOpacity: 0.08 },
  contentStyle: {
    background: 'var(--color-surface-raised)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: 'var(--color-text-primary)' },
  itemStyle: { color: 'var(--color-text-primary)' },
} as const

/** Bars never fill their band — the leftover is deliberate air. */
export const MAX_BAR_SIZE = 24

/** 4px rounded data-end, square at the baseline. */
export const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0]
