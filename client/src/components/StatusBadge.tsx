const STYLES: Record<string, string> = {
  Unstudied: 'bg-border text-text-muted',
  Weak: 'bg-incorrect/10 text-incorrect',
  Strong: 'bg-unrecognized/10 text-unrecognized',
  Memorized: 'bg-accent/10 text-accent',
  Mastered: 'bg-correct/10 text-correct',
  Leech: 'bg-incorrect/10 text-incorrect ring-1 ring-incorrect/40',
}

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
        STYLES[status] ?? STYLES.Unstudied
      }`}
    >
      {status}
    </span>
  )
}
