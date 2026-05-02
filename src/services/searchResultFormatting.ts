export interface SearchResultForFormatting {
  title: string
  url: string
  content: string
  score: number
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
  maxChars?: number,
): string {
  const lines: string[] = []
  if (answer) lines.push(`**${summaryLabel}:** ${answer}`, '')
  results.forEach((result, index) => {
    lines.push(
      `**[${index + 1}] ${result.title}**`,
      `URL: ${result.url}`,
      result.content.slice(0, 700),
      '',
    )
  })

  const formatted = lines.join('\n')
  return maxChars === undefined ? formatted : formatted.slice(0, maxChars)
}
