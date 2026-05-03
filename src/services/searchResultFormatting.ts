export interface SearchResultForFormatting {
  title: string
  url: string
  content: string
  score: number
}

interface FormatWebSearchOptions {
  maxChars?: number
  retrievedAt?: string
  query?: string
  provider?: string
  resultCount?: number
}

export function getCurrentLocaleDateTime() {
  const locale = typeof navigator !== 'undefined' ? navigator.language : undefined
  return new Date().toLocaleString(locale, { dateStyle: 'full', timeStyle: 'short' })
}

export function hasWebSearchApi() {
  return typeof window !== 'undefined' && typeof window.api?.webSearch === 'function'
}

export function formatWebSearchResults(
  results: SearchResultForFormatting[],
  answer: string | undefined,
  summaryLabel: string,
  options?: number | FormatWebSearchOptions,
): string {
  const formatOptions = typeof options === 'number' ? { maxChars: options } : options
  const lines: string[] = []
  const metadata = [
    formatOptions?.retrievedAt ? `Retrieved at: ${formatOptions.retrievedAt}` : '',
    formatOptions?.query ? `Search query: ${formatOptions.query}` : '',
    formatOptions?.provider ? `Search provider: ${formatOptions.provider}` : '',
    typeof formatOptions?.resultCount === 'number' ? `Result count: ${formatOptions.resultCount}` : '',
  ].filter(Boolean)

  if (metadata.length) {
    lines.push('**Search metadata:**', ...metadata, '')
  }

  if (answer) lines.push(`**${summaryLabel}:** ${answer}`, '')
  results.forEach((result, index) => {
    lines.push(
      `**[${index + 1}] ${result.title}**`,
      `URL: ${result.url}`,
      `Relevance score: ${Number.isFinite(result.score) ? result.score.toFixed(2) : 'unknown'}`,
      result.content.slice(0, 700),
      '',
    )
  })

  const formatted = lines.join('\n')
  return formatOptions?.maxChars === undefined ? formatted : formatted.slice(0, formatOptions.maxChars)
}
