/**
 * Reusable loading spinner — replaces 15+ inline SVG copies across the codebase.
 *
 * Usage:
 *   <Spinner />              — default (w-4, current color)
 *   <Spinner size="sm" />   — smaller
 *   <Spinner size="lg" />   — larger
 *   <Spinner className="text-blue-500" />
 */
interface SpinnerProps {
  /** Tailwind size class pair: 'sm' = w-3.5 h-3.5, 'md' = w-4 h-4 (default), 'lg' = w-5 h-5 */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAP: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <svg
      className={`${SIZE_MAP[size]} animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
