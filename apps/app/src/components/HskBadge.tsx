interface Props {
  level: number | null
  size?: 'sm' | 'lg'
}

export default function HskBadge({ level, size = 'sm' }: Props) {
  if (!level) return null

  return (
    <span
      className={`bg-accent/10 text-accent rounded-full font-medium ${
        size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'
      }`}
    >
      HSK {level}
    </span>
  )
}
