import { type ReactNode, forwardRef } from 'react'
import { Spinner } from './Spinner'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'tinted'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
  children?: ReactNode
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[#007AFF] dark:bg-[#0A84FF] text-white hover:brightness-90 active:scale-[0.97] active:brightness-[0.85] disabled:opacity-40',
  secondary:
    'bg-black/10 dark:bg-white/15 text-[var(--apple-label-primary)] hover:bg-black/15 dark:hover:bg-white/20 active:bg-black/20 disabled:opacity-40',
  ghost:
    'bg-transparent text-[#007AFF] dark:text-[#0A84FF] hover:bg-[#007AFF]/10 dark:hover:bg-[#0A84FF]/15 active:bg-[#007AFF]/15 disabled:opacity-40',
  destructive:
    'bg-[#FF3B30] dark:bg-[#FF453A] text-white hover:brightness-90 active:scale-[0.97] active:brightness-[0.85] disabled:opacity-40',
  tinted:
    'bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 text-[#007AFF] dark:text-[#0A84FF] hover:bg-[#007AFF]/15 dark:hover:bg-[#0A84FF]/20 active:bg-[#007AFF]/20 disabled:opacity-40',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 px-3 text-[13px] rounded-md gap-1',
  md: 'h-[34px] px-4 text-[15px] rounded-lg gap-1.5',
  lg: 'h-11 px-5 text-[17px] rounded-[10px] gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      className = '',
      disabled,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          'inline-flex items-center justify-center font-medium leading-none select-none',
          'transition-all duration-150 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth ? 'w-full' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {loading ? (
          <Spinner size="sm" color="current" />
        ) : (
          leftIcon && <span className="flex-shrink-0">{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!loading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </button>
    )
  },
)

Button.displayName = 'Button'
