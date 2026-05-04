/**
 * UsageCostBadge — small pill that surfaces the estimated provider cost
 * of a single message/translation/lookup.
 *
 * Variants:
 *   - size: 'sm' (history rows, inline) | 'md' (chat bubble, dictionary)
 *   - tone: 'emerald' (default — savings vibe) | 'neutral' (subdued)
 *
 * Hovering reveals a native title with the input/output token breakdown,
 * so power users can audit how the number was estimated.
 */
import type { UsageCost, UsageCurrency } from '../../types'
import { formatTokenCount, formatUsageAmount } from '../../utils/usageCost'

type BadgeSize = 'sm' | 'md'
type BadgeTone = 'emerald' | 'neutral'

interface UsageCostBadgeProps {
  cost?: Pick<UsageCost, 'amountUsd' | 'estimated' | 'inputTokens' | 'outputTokens' | 'totalTokens'>
  currency: UsageCurrency
  label?: string
  size?: BadgeSize
  tone?: BadgeTone
  className?: string
}

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'gap-1 px-2 py-0.5 text-[10px]',
  md: 'gap-1.5 px-2.5 py-1 text-[11px]',
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  emerald:
    'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/50',
  neutral:
    'bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700',
}

export function UsageCostBadge({
  cost,
  currency,
  label,
  size = 'sm',
  tone = 'emerald',
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
        'inline-flex items-center rounded-full font-semibold ring-1',
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
