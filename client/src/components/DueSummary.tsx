import { Link } from 'react-router-dom'

interface Props {
  dueCount: number
  newCount: number
  leechCount: number
}

export default function DueSummary({ dueCount, newCount, leechCount }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Link to="/study" className="bg-surface-raised border border-border rounded-xl p-5 hover:border-accent transition-colors">
        <p className="text-3xl font-bold text-accent">{dueCount}</p>
        <p className="text-sm text-text-muted mt-1">Due now</p>
      </Link>

      <Link to="/queue" className="bg-surface-raised border border-border rounded-xl p-5 hover:border-accent transition-colors">
        <p className="text-3xl font-bold text-text-primary">{newCount}</p>
        <p className="text-sm text-text-muted mt-1">New available</p>
      </Link>

      <Link to="/#leeches" className="bg-surface-raised border border-border rounded-xl p-5 hover:border-incorrect/50 transition-colors">
        <p className={`text-3xl font-bold ${leechCount > 0 ? 'text-incorrect' : 'text-text-muted'}`}>{leechCount}</p>
        <p className="text-sm text-text-muted mt-1">Leeches</p>
      </Link>
    </div>
  )
}
