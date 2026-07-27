import {
  type ButtonHTMLAttributes,
  forwardRef,
} from 'react'

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'
export type ButtonShape = 'icon' | 'pill' | 'rect'
export type ButtonVariant = 'neutral' | 'primary' | 'danger'
export type ButtonAppearance = 'solid' | 'soft' | 'outline' | 'ghost'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Semantic control size shared across a toolbar or interaction group. */
  size?: ButtonSize
  /** Icon controls are square; pill controls keep content-driven width. */
  shape?: ButtonShape
  /** Semantic color contract: utility, active/create, or destructive. */
  variant?: ButtonVariant
  /** Visual emphasis, independent from the semantic color. */
  appearance?: ButtonAppearance
}

/**
 * Structural button atom.
 *
 * The atom owns size, semantic colour, disabled state, focus behavior, and the
 * safe default `type="button"`. Feature classes may arrange the control but
 * must not redefine its semantic state.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  size = 'md',
  shape = 'pill',
  variant = 'neutral',
  appearance,
  type = 'button',
  disabled = false,
  className = '',
  ...props
}, ref) {
  const resolvedAppearance = appearance ?? (
    variant === 'primary' ? 'solid' : variant === 'danger' ? 'soft' : 'outline'
  )

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      data-ui-control="button"
      data-control-size={size}
      data-control-shape={shape}
      data-control-variant={variant}
      data-control-appearance={resolvedAppearance}
      data-control-state={disabled ? 'disabled' : 'enabled'}
      className={`ui-button ui-button-${size} ui-button-${shape} ui-button-variant-${variant} ui-button-appearance-${resolvedAppearance}${className ? ` ${className}` : ''}`}
      {...props}
    />
  )
})
