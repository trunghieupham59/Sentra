import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

type ListRowIconConfig = {
  element: ReactNode
  bgColor: string
}

type ListRowProps = {
  icon?: ReactNode | ListRowIconConfig
  label: string
  description?: string
  value?: ReactNode
  chevron?: boolean
  onClick?: () => void
  destructive?: boolean
  disabled?: boolean
  badge?: ReactNode
  className?: string
}

function isIconConfig(icon: unknown): icon is ListRowIconConfig {
  return typeof icon === 'object' && icon !== null && 'bgColor' in icon
}

type ListGroupProps = {
  label?: string
  children: ReactNode
  className?: string
}

export function ListRow({
  icon,
  label,
  description,
  value,
  chevron = false,
  onClick,
  destructive = false,
  disabled = false,
  badge,
  className = '',
}: ListRowProps) {
  const isClickable = !!onClick && !disabled
  const Tag = isClickable ? 'button' : 'div'

  return (
    <Tag
      type={isClickable ? 'button' : undefined}
      onClick={isClickable ? onClick : undefined}
      disabled={isClickable ? disabled : undefined}
      className={[
        'group flex items-center w-full min-h-[44px] px-4 gap-3 text-left',
        'transition-colors duration-150',
        isClickable
          ? 'cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.04] active:bg-black/[0.08] dark:active:bg-white/[0.08]'
          : '',
        isClickable
          ? 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:ring-inset'
          : '',
        disabled ? 'opacity-40 cursor-not-allowed' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Icon */}
      {icon && (
        <div className="flex-shrink-0">
          {isIconConfig(icon) ? (
            <div
              className="w-7 h-7 rounded-[6px] flex items-center justify-center"
              style={{ backgroundColor: icon.bgColor }}
            >
              <span className="text-white [&>svg]:w-4 [&>svg]:h-4 [&>svg]:stroke-[1.5]">
                {icon.element}
              </span>
            </div>
          ) : (
            <span className="text-[var(--apple-label-secondary)] [&>svg]:w-5 [&>svg]:h-5">
              {icon}
            </span>
          )}
        </div>
      )}

      {/* Label + Description */}
      <div className="flex-1 min-w-0 py-2.5">
        <div
          className={[
            'text-[17px] leading-[22px] truncate',
            destructive
              ? 'text-[#FF3B30] dark:text-[#FF453A]'
              : 'text-[var(--apple-label-primary)]',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {label}
        </div>
        {description && (
          <div className="text-[13px] leading-[18px] text-[var(--apple-label-secondary)] mt-0.5 truncate">
            {description}
          </div>
        )}
      </div>

      {/* Value / Badge / Chevron */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {badge}
        {value && (
          <span className="text-[15px] text-[var(--apple-label-secondary)]">{value}</span>
        )}
        {chevron && (
          <ChevronRight
            size={16}
            strokeWidth={1.5}
            className="text-[var(--apple-label-quaternary)]"
          />
        )}
      </div>
    </Tag>
  )
}

export function ListGroup({ label, children, className = '' }: ListGroupProps) {
  return (
    <div className={['', className].filter(Boolean).join(' ')}>
      {label && (
        <div className="px-4 pt-5 pb-1.5 text-[13px] font-medium text-[var(--apple-label-secondary)] uppercase tracking-wider">
          {label}
        </div>
      )}
      <div className="rounded-xl overflow-hidden bg-[var(--apple-bg-tertiary)] dark:bg-[var(--apple-bg-tertiary)]">
        <div className="divide-y divide-[var(--apple-separator)]">{children}</div>
      </div>
    </div>
  )
}
