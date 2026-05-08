type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg'
type SpinnerColor = 'accent' | 'white' | 'current'

type SpinnerProps = {
  size?: SpinnerSize
  color?: SpinnerColor
  className?: string
}

const sizeMap: Record<SpinnerSize, number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
}

const colorMap: Record<SpinnerColor, string> = {
  accent: '#007AFF',
  white: '#FFFFFF',
  current: 'currentColor',
}

export function Spinner({ size = 'md', color = 'current', className = '' }: SpinnerProps) {
  const px = sizeMap[size]
  const c = colorMap[color]

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 20 20"
      fill="none"
      className={['spinner', className].filter(Boolean).join(' ')}
      aria-label="Loading"
      role="status"
    >
      <circle cx="10" cy="10" r="8" stroke={c} strokeWidth="2" strokeOpacity="0.25" />
      <path
        d="M10 2a8 8 0 0 1 8 8"
        stroke={c}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
