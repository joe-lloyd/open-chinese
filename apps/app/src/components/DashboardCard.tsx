import type { ReactNode } from 'react'

interface Props {
  title: string
  /** Secondary line under the title — a subtitle, or the series name. */
  subtitle?: string
  /** Right-aligned slot in the header, typically a link. */
  action?: ReactNode
  className?: string
  children: ReactNode
}

export default function DashboardCard({ title, subtitle, action, className = '', children }: Props) {
  return (
    <section className={`bg-surface-raised border border-border rounded-2xl p-4 sm:p-5 ${className}`}>
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0 text-xs">{action}</div>}
      </header>
      {children}
    </section>
  )
}
