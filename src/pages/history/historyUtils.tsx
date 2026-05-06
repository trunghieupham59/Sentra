import { ProviderIcon } from '../../components/ProviderIcon'
import { BotIcon } from '../../components/ui/icons'
import { PROVIDERS } from '../../constants/providers'
import type { Provider } from '../../types'
import { tpl } from '../../utils/tpl'

export function normalizeHistoryQuery(query: string): string {
  return query.trim().toLocaleLowerCase()
}

export function historyMatches(query: string, values: Array<string | number | undefined | null>): boolean {
  if (!query) return true
  return values.some((value) => String(value ?? '').toLocaleLowerCase().includes(query))
}

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

const KNOWN_PROVIDERS: Provider[] = ['local', 'openai', 'claude', 'gemini']

export function ProviderBadge({ provider }: { provider: string }) {
  const p = PROVIDERS.find((x) => x.id === provider)
  const isKnown = KNOWN_PROVIDERS.includes(provider as Provider)
  return (
    <span className="ui-badge-xs gap-1 rounded-md font-medium text-gray-500 whitespace-nowrap dark:bg-gray-800 dark:text-gray-400">
      {isKnown
        ? <ProviderIcon provider={provider as Provider} size={12} />
        : <BotIcon className="w-3 h-3" />
      }
      {p?.name ?? provider}
    </span>
  )
}
