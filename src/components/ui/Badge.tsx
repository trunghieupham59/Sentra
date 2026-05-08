import type { ReactNode } from 'react'

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'error' | 'neutral'
type BadgeSize = 'sm' | 'md'

type BadgeProps = {
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
  children?: ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default:
    'bg-black/10 dark:bg-white/15 text-[var(--apple-label-secondary)]',
  accent:
    'bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 text-[#007AFF] dark:text-[#0A84FF]',
  success:
    'bg-[#34C759]/10 dark:bg-[#30D158]/15 text-[#34C759] dark:text-[#30D158]',
  warning:
    'bg-[#FF9500]/10 dark:bg-[#FF9F0A]/15 text-[#FF9500] dark:text-[#FF9F0A]',
  error:
    'bg-[#FF3B30]/10 dark:bg-[#FF453A]/15 text-[#FF3B30] dark:text-[#FF453A]',
  neutral:
    'bg-[var(--apple-fill-tertiary)] text-[var(--apple-label-secondary)]',
}

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-[var(--apple-label-secondary)]',
  accent: 'bg-[#007AFF] dark:bg-[#0A84FF]',
  success: 'bg-[#34C759] dark:bg-[#30D158]',
  warning: 'bg-[#FF9500] dark:bg-[#FF9F0A]',
  error: 'bg-[#FF3B30] dark:bg-[#FF453A]',
  neutral: 'bg-[var(--apple-gray)]',
}

export function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  children,
  className = '',
}: BadgeProps) {
  if (dot) {
    return (
      <span
        className={[
          'inline-block rounded-full flex-shrink-0',
          size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2',
          dotColors[variant],
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        aria-hidden="true"
      />
    )
  }

  return (
    <span
      className={[
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px] gap-1' : 'px-2 py-0.5 text-[12px] gap-1.5',
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  )
}
