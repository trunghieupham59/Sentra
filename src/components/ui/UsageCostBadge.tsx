/**
 * UsageCostBadge — small pill that surfaces the estimated provider cost
 * of a single message/translation/lookup.
 *
 * Variants:
 *   - size: 'sm' (history rows, inline) | 'md' (chat bubble, dictionary)
 *   - tone: 'neutral' (subdued)
 *
 * Hovering reveals a native title with the input/output token breakdown,
 * so power users can audit how the number was estimated.
 */
import type { UsageCost, UsageCurrency } from '../../types'
import { formatTokenCount, formatUsageAmount } from '../../utils/usageCost'

type BadgeSize = 'sm' | 'md'
type BadgeTone = 'neutral'

interface UsageCostBadgeProps {
  cost?: Pick<UsageCost, 'amountUsd' | 'estimated' | 'inputTokens' | 'outputTokens' | 'totalTokens'>
  currency: UsageCurrency
  label?: string
  size?: BadgeSize
  tone?: BadgeTone
  className?: string
}

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'ui-badge-xs gap-1',
  md: 'ui-badge gap-1.5 py-1',
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral:
    'bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700',
}

export function UsageCostBadge({
  cost,
  currency,
  label,
  size = 'sm',
  tone = 'neutral',
  className,
}: UsageCostBadgeProps) {
  if (!cost) return null

  const tooltipParts: string[] = []
  if (label) tooltipParts.push(label)
  tooltipParts.push(`${cost.estimated ? '~' : ''}${formatUsageAmount(cost.amountUsd, currency)}`)
  if (cost.inputTokens != null || cost.outputTokens != null) {
    const inT = cost.inputTokens ?? 0
    const outT = cost.outputTokens ?? 0
    tooltipParts.push(`${inT.toLocaleString()} in · ${outT.toLocaleString()} out`)
  }

  return (
    <span
      className={[
        'ring-1 whitespace-nowrap',
        SIZE_CLASSES[size],
        TONE_CLASSES[tone],
        className ?? '',
      ].join(' ')}
      title={tooltipParts.join(' — ')}
    >
      {label ? <span className="opacity-80">{label}</span> : null}
      <span>
        {cost.estimated ? '~' : ''}{formatUsageAmount(cost.amountUsd, currency)}
      </span>
      {cost.totalTokens ? (
        <span className="opacity-60 font-medium tabular-nums">
          · {formatTokenCount(cost.totalTokens)}
        </span>
      ) : null}
    </span>
  )
}
