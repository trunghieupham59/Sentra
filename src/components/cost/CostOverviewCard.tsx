/**
 * CostOverviewCard — header dashboard for the Cost Tracking section.
 *
 * Layout (top → bottom):
 *   1. Header row     — title + currency picker + reset-all button
 *   2. Hero stat       — total estimated spend (large, headline number)
 *   3. KPI grid        — requests / tokens / avg-per-request
 *   4. By-feature bars — chat / translate / live / dictionary share
 *
 * When there's no data yet, the card collapses to a friendly empty state
 * so the section never feels broken on a fresh install.
 */

import { useT } from '../../store/useAppStore'
import type { Provider, UsageCurrency, UsageFeature, UsageTotal } from '../../types'
import { formatTokenCount, formatUsageAmount } from '../../utils/usageCost'
import { CurrencyPicker } from '../ui/CurrencyPicker'
import { CalculatorIcon, ChartBarIcon, CoinsIcon, PulseIcon } from '../ui/icons'

interface CostOverviewCardProps {
  totals: Partial<Record<Provider, UsageTotal>>
  currency: UsageCurrency
  onCurrencyChange: (next: UsageCurrency) => void
  onResetAll: () => void
}

interface FeatureSummary {
  feature: UsageFeature
  amountUsd: number
  requestCount: number
  totalTokens: number
}

const FEATURE_ORDER: UsageFeature[] = ['chat', 'translate', 'live', 'dictionary']

const FEATURE_BAR_COLORS: Record<UsageFeature, string> = {
  chat: 'bg-blue-500 dark:bg-blue-400',
  translate: 'bg-emerald-500 dark:bg-emerald-400',
  live: 'bg-purple-500 dark:bg-purple-400',
  dictionary: 'bg-amber-500 dark:bg-amber-400',
}

const FEATURE_DOT_COLORS: Record<UsageFeature, string> = {
  chat: 'bg-blue-500',
  translate: 'bg-emerald-500',
  live: 'bg-purple-500',
  dictionary: 'bg-amber-500',
}

function aggregateTotals(totals: Partial<Record<Provider, UsageTotal>>) {
  let amountUsd = 0
  let requestCount = 0
  let totalTokens = 0
  const byFeature: Record<UsageFeature, FeatureSummary> = {
    chat: { feature: 'chat', amountUsd: 0, requestCount: 0, totalTokens: 0 },
    translate: { feature: 'translate', amountUsd: 0, requestCount: 0, totalTokens: 0 },
    live: { feature: 'live', amountUsd: 0, requestCount: 0, totalTokens: 0 },
    dictionary: { feature: 'dictionary', amountUsd: 0, requestCount: 0, totalTokens: 0 },
  }

  for (const total of Object.values(totals)) {
    if (!total) continue
    amountUsd += total.amountUsd
    requestCount += total.requestCount
    totalTokens += total.totalTokens
    if (total.byFeature) {
      for (const featureKey of FEATURE_ORDER) {
        const featureData = total.byFeature[featureKey]
        if (!featureData) continue
        byFeature[featureKey].amountUsd += featureData.amountUsd
        byFeature[featureKey].requestCount += featureData.requestCount
        byFeature[featureKey].totalTokens += featureData.totalTokens
      }
    }
  }

  return { amountUsd, requestCount, totalTokens, byFeature }
}

export function CostOverviewCard({ totals, currency, onCurrencyChange, onResetAll }: CostOverviewCardProps) {
  const t = useT()
  const summary = aggregateTotals(totals)
  const hasData = summary.requestCount > 0
  const avgUsd = summary.requestCount > 0 ? summary.amountUsd / summary.requestCount : 0

  const featureLabels: Record<UsageFeature, string> = {
    chat: t.settings_cost_feature_chat,
    translate: t.settings_cost_feature_translate,
    live: t.settings_cost_feature_live,
    dictionary: t.settings_cost_feature_dictionary,
  }

  const handleResetAll = () => {
    if (window.confirm(t.settings_cost_reset_all_confirm)) onResetAll()
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-gray-900 dark:to-gray-900">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 border-b border-emerald-100/70 bg-white/50 px-4 py-3 backdrop-blur-sm dark:border-emerald-900/30 dark:bg-gray-900/40">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
            <CoinsIcon className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t.settings_cost_section_title}
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {t.settings_cost_overview_estimated} · {t.settings_cost_section_desc.split('.')[0]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CurrencyPicker
            value={currency}
            onChange={onCurrencyChange}
            ariaLabel={t.settings_cost_currency}
          />
          {hasData ? (
            <button
              type="button"
              onClick={handleResetAll}
              className="h-7 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-red-900/60 dark:hover:bg-red-950/30 dark:hover:text-red-300"
            >
              {t.settings_cost_reset_all}
            </button>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4">
        {hasData ? (
          <div className="space-y-4">
            {/* Hero stat */}
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80">
                  {t.settings_cost_overview_total}
                </p>
                <p className="mt-0.5 flex items-baseline gap-1.5 font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  <span className="text-3xl">~{formatUsageAmount(summary.amountUsd, currency)}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                  {t.settings_cost_overview_total_desc}
                </p>
              </div>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-3 gap-2">
              <KpiTile
                icon={<PulseIcon className="h-3.5 w-3.5" />}
                label={t.settings_cost_overview_requests}
                value={summary.requestCount.toLocaleString()}
              />
              <KpiTile
                icon={<ChartBarIcon className="h-3.5 w-3.5" />}
                label={t.settings_cost_overview_tokens}
                value={formatTokenCount(summary.totalTokens)}
              />
              <KpiTile
                icon={<CalculatorIcon className="h-3.5 w-3.5" />}
                label={t.settings_cost_overview_avg}
                value={`~${formatUsageAmount(avgUsd, currency)}`}
              />
            </div>

            {/* Feature breakdown */}
            <FeatureBreakdown
              summary={summary}
              currency={currency}
              labels={featureLabels}
              heading={t.settings_cost_breakdown_by_feature}
            />
          </div>
        ) : (
          <EmptyState
            heading={t.settings_cost_overview_no_data}
            body={t.settings_cost_overview_no_data_desc}
          />
        )}
      </div>
    </div>
  )
}

function KpiTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-3 py-2 dark:border-gray-700/70 dark:bg-gray-800/60">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        <span className="text-gray-400 dark:text-gray-500">{icon}</span>
        <span>{label}</span>
      </div>
      <p className="mt-0.5 text-base font-bold tabular-nums text-gray-800 dark:text-gray-100">
        {value}
      </p>
    </div>
  )
}

function FeatureBreakdown({
  summary,
  currency,
  labels,
  heading,
}: {
  summary: ReturnType<typeof aggregateTotals>
  currency: UsageCurrency
  labels: Record<UsageFeature, string>
  heading: string
}) {
  const features = FEATURE_ORDER
    .map((feature) => summary.byFeature[feature])
    .filter((entry) => entry.requestCount > 0)
  if (features.length === 0) return null

  const max = Math.max(...features.map((entry) => entry.amountUsd), 0.0000001)

  return (
    <section className="space-y-1.5">
      <h4 className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {heading}
      </h4>
      <ul className="space-y-1.5">
        {features.map((entry) => {
          const percent = Math.max(2, Math.round((entry.amountUsd / max) * 100))
          return (
            <li key={entry.feature} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                  <span className={`h-2 w-2 rounded-full ${FEATURE_DOT_COLORS[entry.feature]}`} />
                  <span className="font-medium">{labels[entry.feature]}</span>
                </div>
                <div className="flex items-center gap-2 tabular-nums text-gray-500 dark:text-gray-400">
                  <span>~{formatUsageAmount(entry.amountUsd, currency)}</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">·</span>
                  <span className="text-[10px]">{entry.requestCount}</span>
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${FEATURE_BAR_COLORS[entry.feature]}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function EmptyState({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-gray-200 bg-white/40 px-4 py-4 dark:border-gray-700 dark:bg-gray-900/40">
      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
        <CoinsIcon className="h-4 w-4" />
      </span>
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{heading}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{body}</p>
      </div>
    </div>
  )
}
