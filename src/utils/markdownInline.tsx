/**
 * Shared inline Markdown renderer — used by both MarkdownEditor and MarkdownText.
 * Parses: [link](url), bare URLs, **bold**, *italic*, _italic_, `code`
 * Returns React nodes suitable for inline rendering.
 *
 * DUP-NEW-01: Extracted from MarkdownEditor.tsx and MarkdownText.tsx to eliminate
 * near-identical implementations. If you add a new inline pattern (e.g. ~~strikethrough~~),
 * add it here once and both renderers benefit automatically.
 */

const LINK_CLASS =
  'font-medium text-gray-800 underline underline-offset-2 hover:text-gray-950 dark:text-gray-200 dark:hover:text-white break-words cursor-pointer'

const TRAILING_LINK_PUNCTUATION = '.,!?:;'
const CLOSING_BRACKET_TO_OPENING: Record<string, string> = {
  ')': '(',
  ']': '[',
  '}': '{',
}

function openExternalUrl(href: string) {
  if (typeof window === 'undefined') return

  if (typeof window.api?.openExternal === 'function') {
    void window.api.openExternal(href)
    return
  }

  window.open(href, '_blank', 'noopener,noreferrer')
}

function normalizeHref(href: string): string {
  return href.startsWith('www.') ? `https://${href}` : href
}

function countChar(value: string, target: string): number {
  let count = 0
  for (const char of value) {
    if (char === target) count++
  }
  return count
}

function splitTrailingLinkText(rawHref: string): { href: string; suffix: string } {
  let href = rawHref
  let suffix = ''

  while (href.length > 0) {
    const trailing = href[href.length - 1]
    const opening = CLOSING_BRACKET_TO_OPENING[trailing]
    const shouldTrim =
      TRAILING_LINK_PUNCTUATION.includes(trailing) ||
      trailing === '"' ||
      trailing === "'" ||
      (opening && countChar(href, trailing) > countChar(href, opening))

    if (!shouldTrim) break

    suffix = trailing + suffix
    href = href.slice(0, -1)
  }

  return { href, suffix }
}

function renderLink(key: React.Key, href: string, children: React.ReactNode) {
  const normalizedHref = normalizeHref(href)

  return (
    <a
      key={key}
      href={normalizedHref}
      target="_blank"
      rel="noopener noreferrer"
      className={LINK_CLASS}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        openExternalUrl(normalizedHref)
      }}
    >
      {children}
    </a>
  )
}

/** Parse inline elements: [link](url), bare URLs, **bold**, *italic*, _italic_, `code` */
export function renderInline(raw: string): React.ReactNode[] {
  const result: React.ReactNode[] = []
  // Combined pattern for markdown links, bare URLs, bold, italic, and inline code.
  const pattern = /(\[([^\]]+)\]\s*\((https?:\/\/[^\s)]+)\))|(\*\*(.+?)\*\*)|(\*(.+?)\*)|(_(.+?)_)|(`(.+?)`)|((?:https?:\/\/|www\.)[^\s<]+)/g
  let last = 0
  let match: RegExpExecArray | null

  // biome-ignore lint/suspicious/noAssignInExpressions: intentional assignment in loop condition
  while ((match = pattern.exec(raw)) !== null) {
    if (match.index > last) {
      result.push(raw.slice(last, match.index))
    }
    if (match[1]) {
      // [label](https://...)
      result.push(renderLink(match.index, match[3], match[2]))
    } else if (match[4]) {
      // **bold**
      result.push(<strong key={match.index}>{match[5]}</strong>)
    } else if (match[6]) {
      // *italic*
      result.push(<em key={match.index}>{match[7]}</em>)
    } else if (match[8]) {
      // _italic_
      result.push(<em key={match.index}>{match[9]}</em>)
    } else if (match[10]) {
      // `code`
      result.push(
        <code key={match.index} className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[0.85em] font-mono text-gray-800 dark:text-gray-200">
          {match[11]}
        </code>
      )
    } else if (match[12]) {
      // Bare URL, including URLs wrapped by punctuation like "(https://example.com)".
      const { href, suffix } = splitTrailingLinkText(match[12])
      result.push(renderLink(match.index, href, href))
      if (suffix) result.push(suffix)
    }
    last = match.index + match[0].length
  }
  if (last < raw.length) result.push(raw.slice(last))
  return result
}
