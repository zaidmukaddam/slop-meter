export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden fill="none">
      <path
        d="M3.5 13.5a8 8 0 0 1 13 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M10 5.2v1.6M5 8l1 1.2M15 8l-1 1.2"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M10 16l3.6-6.4"
        stroke="var(--machine)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="16" r="1.4" fill="currentColor" />
    </svg>
  )
}
