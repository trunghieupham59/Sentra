type DividerProps = {
  orientation?: 'horizontal' | 'vertical'
  label?: string
  className?: string
}

export function Divider({ orientation = 'horizontal', label, className = '' }: DividerProps) {
  if (orientation === 'vertical') {
    return (
      <div
        className={['w-px self-stretch bg-[var(--apple-separator)]', className]
          .filter(Boolean)
          .join(' ')}
        role="separator"
        aria-orientation="vertical"
      />
    )
  }

  if (label) {
    return (
      <div className={['flex items-center gap-3', className].filter(Boolean).join(' ')} role="separator">
        <div className="flex-1 h-px bg-[var(--apple-separator)]" />
        <span className="text-[12px] text-[var(--apple-label-tertiary)] font-medium whitespace-nowrap">
          {label}
        </span>
        <div className="flex-1 h-px bg-[var(--apple-separator)]" />
      </div>
    )
  }

  return (
    <div
      className={['h-px w-full bg-[var(--apple-separator)]', className].filter(Boolean).join(' ')}
      role="separator"
      aria-orientation="horizontal"
    />
  )
}
