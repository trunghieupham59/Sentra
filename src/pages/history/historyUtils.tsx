import { tpl } from '../../utils/tpl'
import { PROVIDERS } from '../../constants/providers'

export function formatTime(ts: number, t: { time_just_now: string; time_m_ago: string; time_h_ago: string; time_d_ago: string }): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return t.time_just_now
  if (diffMin < 60) return tpl(t.time_m_ago, { n: diffMin })
  if (diffHour < 24) return tpl(t.time_h_ago, { n: diffHour })
  if (diffDay < 7) return tpl(t.time_d_ago, { n: diffDay })
  return d.toLocaleDateString()
}

export function langLabel(code: string): string {
  if (code === 'auto') return 'Auto'
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

export function ProviderBadge({ provider }: { provider: string }) {
  const p = PROVIDERS.find((x) => x.id === provider)
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded
                     bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
      {p?.emoji ?? '🤖'} {p?.name ?? provider}
    </span>
  )
}

// ── DUP-04: Shared history UI components ──────────────────────────────────────

interface HistoryClearHeaderProps {
  countLabel: string       // e.g. "5 mục" or "3 phiên"
  confirmClear: boolean
  labelClear: string       // t.history_clear_all
  labelConfirm: string     // t.history_clear_confirm
  onClear: () => void
  onBlur: () => void
}

export function HistoryClearHeader({
  countLabel, confirmClear, labelClear, labelConfirm, onClear, onBlur,
}: HistoryClearHeaderProps) {
  return (
    <div className="flex-shrink-0 flex items-center justify-between px-4 py-2
                    bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
      <span className="text-xs text-gray-400">{countLabel}</span>
      <button
        type="button"
        onClick={onClear}
        onBlur={onBlur}
        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-150 ${
          confirmClear
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
        }`}
      >
        {confirmClear ? labelConfirm : labelClear}
      </button>
    </div>
  )
}

// ── DUP-05: Shared empty state component ──────────────────────────────────────

interface HistoryEmptyStateProps {
  icon: React.ReactNode
  title: string
  desc: string
}

export function HistoryEmptyState({ icon, title, desc }: HistoryEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{desc}</p>
      </div>
    </div>
  )
}
