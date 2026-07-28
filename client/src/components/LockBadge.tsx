export default function LockBadge({ label = 'Locked' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-text-muted/10 text-text-muted px-2.5 py-1 rounded-full">
      <LockIcon />
      {label}
    </span>
  )
}

export function LockIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
