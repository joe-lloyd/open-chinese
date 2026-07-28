export type StatTone = 'default' | 'accent' | 'good' | 'warning' | 'critical'

const TONE_CLASS: Record<StatTone, string> = {
  default: 'text-text-primary',
  accent: 'text-accent',
  good: 'text-correct',
  warning: 'text-unrecognized',
  critical: 'text-incorrect',
}

interface Props {
  label: string
  value: string | number
  sub?: string
  tone?: StatTone
}

/**
 * Label + value, optionally a supporting line. Values use the font's default
 * proportional figures — tabular figures make a display-size number look loose.
 */
export default function StatTile({ label, value, sub, tone = 'default' }: Props) {
  return (
    <div className="bg-surface-raised border border-border rounded-2xl p-4">
      <p className={`text-2xl sm:text-3xl font-bold leading-none ${TONE_CLASS[tone]}`}>{value}</p>
      <p className="text-xs sm:text-sm text-text-muted mt-2">{label}</p>
      {sub && <p className="text-[11px] text-text-muted mt-0.5">{sub}</p>}
    </div>
  )
}
