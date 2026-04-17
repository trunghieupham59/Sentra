import { PROVIDERS } from '../../constants/providers'

export function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
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
