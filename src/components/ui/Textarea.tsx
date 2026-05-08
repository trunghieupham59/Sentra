import { forwardRef, useEffect, useRef } from 'react'

type TextareaProps = {
  autoResize?: boolean
  minRows?: number
  maxRows?: number
  showCharCount?: boolean
  error?: string
  label?: string
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      autoResize = true,
      minRows = 3,
      maxRows = 10,
      showCharCount = false,
      error,
      label,
      className = '',
      onChange,
      maxLength,
      value,
      id,
      ...props
    },
    forwardedRef,
  ) => {
    const innerRef = useRef<HTMLTextAreaElement>(null)
    const ref = (forwardedRef as React.RefObject<HTMLTextAreaElement>) || innerRef
    const inputId = id || (label ? `textarea-${Math.random().toString(36).slice(2)}` : undefined)

    const charCount = typeof value === 'string' ? value.length : 0

    useEffect(() => {
      if (!autoResize || !ref.current) return
      const el = ref.current
      el.style.height = 'auto'
      const lineHeight = parseInt(getComputedStyle(el).lineHeight || '22')
      const minH = lineHeight * minRows
      const maxH = lineHeight * maxRows
      el.style.height = `${Math.min(Math.max(el.scrollHeight, minH), maxH)}px`
    }, [value, autoResize, minRows, maxRows, ref])

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
        <div className="relative">
          <textarea
            ref={ref}
            id={inputId}
            value={value}
            maxLength={maxLength}
            onChange={onChange}
            className={[
              'w-full resize-none bg-[var(--apple-fill-tertiary)] text-[var(--apple-label-primary)]',
              'border border-transparent rounded-lg',
              'px-3 py-2 text-[15px] leading-[22px]',
              'placeholder:text-[var(--apple-label-tertiary)]',
              'transition-all duration-150',
              'focus:outline-none focus:border-[#007AFF] dark:focus:border-[#0A84FF]',
              'focus:shadow-[0_0_0_3px_rgba(0,122,255,0.25)] dark:focus:shadow-[0_0_0_3px_rgba(10,132,255,0.35)]',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              error ? 'border-[#FF3B30] dark:border-[#FF453A]' : '',
              showCharCount ? 'pb-7' : '',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
            {...props}
          />
          {showCharCount && maxLength && (
            <div className="absolute bottom-2 right-3 text-[12px] tabular-nums pointer-events-none">
              <span
                className={
                  charCount >= maxLength * 0.9
                    ? 'text-[#FF3B30] dark:text-[#FF453A]'
                    : 'text-[var(--apple-label-tertiary)]'
                }
              >
                {charCount}/{maxLength}
              </span>
            </div>
          )}
        </div>
        {error && (
          <p className="text-[13px] text-[#FF3B30] dark:text-[#FF453A]" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'
