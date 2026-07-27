import { forwardRef, type InputHTMLAttributes } from 'react'

export type InputSize = 'sm' | 'md' | 'lg'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Uses the same vertical control scale as buttons. */
  size?: InputSize
}

/** Reusable single-line input with shared size, radius, focus, and error states. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({
  size = 'md',
  className = '',
  ...props
}, ref) {
  return (
    <input
      ref={ref}
      data-ui-control="input"
      data-control-size={size}
      className={`ui-input ui-input-${size}${className ? ` ${className}` : ''}`}
      {...props}
    />
  )
})
