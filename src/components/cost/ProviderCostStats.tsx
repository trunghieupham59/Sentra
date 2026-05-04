/**
 * ProviderCostStats — compact stats strip rendered under the provider title
 * inside ApiKeyInput's CredentialCard `meta` slot.
 *
 * Shows the most useful at-a-glance numbers without dominating the row:
 *   - estimated cost  (headline pill, emerald)
 *   - request count   (subtle pill)
 *   - total tokens    (subtle pill)
 *   - last activity   (subtle pill)
 *
 * Each pill is intentionally small so the credential card preserves its
 * familiar single-line shape on wide screens.
 */
import type { Translations } from '../../i18n/types'
import type { UsageCurrency, UsageTotal } from '../../types'
import { tpl } from '../../utils/tpl'
import { formatTokenCount, formatUsageAmount } from '../../utils/usageCost'
import { ChartBarIcon, PulseIcon } from '../ui/icons'
import { ClockIcon } from '../ui/icons/navigation'

interface ProviderCostStatsProps {
  total?: UsageTotal
  currency: UsageCurrency
  costLabel: string
  t: Translations
  onReset: () => void
  resetTitle: string
  emptyHint?: string
}

function formatRelative(timestamp: number, t: Translations): string {
  if (!timestamp) return ''
  const diffMs = Date.now() - timestamp
  if (diffMs < 60_000) return t.settings_cost_last_used_just_now
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return tpl(t.settings_cost_last_used_minutes, { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return tpl(t.settings_cost_last_used_hours, { n: hours })
  const days = Math.floor(hours / 24)
  return tpl(t.settings_cost_last_used_days, { n: days })
}

export function ProviderCostStats({
  total,
  currency,
  costLabel,
  t,
  onReset,
  resetTitle,
  emptyHint,
}: ProviderCostStatsProps) {
  if (!total || total.requestCount === 0) {
    return emptyHint ? (
      <span className="text-[11px] italic text-gray-400 dark:text-gray-500">{emptyHint}</span>
    ) : null
  }

  const lastUsedLabel = formatRelative(total.updatedAt, t)

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/50"
        title={`${costLabel} ~${formatUsageAmount(total.amountUsd, currency)}`}
      >
        <span className="opacity-80">{costLabel}</span>
        <span className="tabular-nums">~{formatUsageAmount(total.amountUsd, currency)}</span>
      </span>

      <Pill
        icon={<PulseIcon className="h-3 w-3" />}
        title={t.settings_cost_overview_requests}
        value={total.requestCount.toLocaleString()}
      />

      <Pill
        icon={<ChartBarIcon className="h-3 w-3" />}
        title={`${total.inputTokens.toLocaleString()} in · ${total.outputTokens.toLocaleString()} out`}
        value={formatTokenCount(total.totalTokens)}
      />

      {lastUsedLabel ? (
        <Pill
          icon={<ClockIcon className="h-3 w-3" />}
          title={t.settings_cost_last_used}
          value={lastUsedLabel}
        />
      ) : null}

      <button
        type="button"
        onClick={onReset}
        title={resetTitle}
        className="ml-auto inline-flex h-5 items-center rounded-full border border-transparent px-2 text-[10px] font-medium text-gray-400 transition-colors hover:border-red-100 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-900/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
      >
        {t.settings_cost_reset_provider}
      </button>
    </div>
  )
}

function Pill({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode
  title: string
  value: string
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
      title={title}
    >
      <span className="text-gray-400 dark:text-gray-500">{icon}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  )
}
