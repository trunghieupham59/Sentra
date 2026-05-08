import { forwardRef, type ReactNode } from 'react'

type InputSize = 'sm' | 'md' | 'lg'

type InputProps = {
  inputSize?: InputSize
  leftIcon?: ReactNode
  rightElement?: ReactNode
  error?: string
  label?: string
  hint?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>

const sizeClasses: Record<InputSize, string> = {
  sm: 'h-7 px-2.5 text-[13px] rounded-md',
  md: 'h-9 px-3 text-[15px] rounded-lg',
  lg: 'h-11 px-4 text-[17px] rounded-xl',
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      inputSize = 'md',
      leftIcon,
      rightElement,
      error,
      label,
      hint,
      className = '',
      id,
      ...props
    },
    ref,
  ) => {
    const inputId = id || (label ? `input-${Math.random().toString(36).slice(2)}` : undefined)

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[13px] font-medium text-[var(--apple-label-primary)]"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3 flex items-center text-[var(--apple-label-tertiary)] pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={[
              'w-full bg-[var(--apple-fill-tertiary)] text-[var(--apple-label-primary)]',
              'border border-transparent',
              'placeholder:text-[var(--apple-label-tertiary)]',
              'transition-all duration-150',
              'focus:outline-none focus:border-[#007AFF] dark:focus:border-[#0A84FF]',
              'focus:shadow-[0_0_0_3px_rgba(0,122,255,0.25)] dark:focus:shadow-[0_0_0_3px_rgba(10,132,255,0.35)]',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              error ? 'border-[#FF3B30] dark:border-[#FF453A] focus:border-[#FF3B30]' : '',
              sizeClasses[inputSize],
              leftIcon ? 'pl-9' : '',
              rightElement ? 'pr-9' : '',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
            {...props}
          />
          {rightElement && (
            <span className="absolute right-3 flex items-center">{rightElement}</span>
          )}
        </div>
        {error && (
          <p className="text-[13px] text-[#FF3B30] dark:text-[#FF453A]" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-[13px] text-[var(--apple-label-secondary)]">{hint}</p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
