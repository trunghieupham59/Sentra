// Lightweight Markdown renderer for AI chat responses.
// Supports: headings, bold, italic, inline code, unordered lists, horizontal rules, paragraphs.
// No external dependencies - pure React.

interface Props {
  text: string
  className?: string
}

/** Parse inline elements: **bold**, *italic*, `code` */
function renderInline(raw: string): React.ReactNode[] {
  const result: React.ReactNode[] = []
  // Combined pattern for bold, italic, inline code
  const pattern = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(_(.+?)_)|(`(.+?)`)/g
  let last = 0
  let match: RegExpExecArray | null

  // biome-ignore lint/suspicious/noAssignInExpressions: intentional assignment in loop condition
  while ((match = pattern.exec(raw)) !== null) {
    // Text before the match
    if (match.index > last) {
      result.push(raw.slice(last, match.index))
    }
    if (match[1]) {
      // **bold**
      result.push(<strong key={match.index}>{match[2]}</strong>)
    } else if (match[3]) {
      // *italic*
      result.push(<em key={match.index}>{match[4]}</em>)
    } else if (match[5]) {
      // _italic_
      result.push(<em key={match.index}>{match[6]}</em>)
    } else if (match[7]) {
      // `code`
      result.push(
        <code key={match.index} className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[0.85em] font-mono text-gray-800 dark:text-gray-200">
          {match[8]}
        </code>
      )
    }
    last = match.index + match[0].length
  }
  if (last < raw.length) result.push(raw.slice(last))
  return result
}

export function MarkdownText({ text, className }: Props) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []
  let key = 0

  const flushList = () => {
    if (listItems.length === 0) return
    elements.push(
      <ul key={`ul-${key++}`} className="my-1.5 space-y-0.5 list-none pl-0">
        {listItems.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable index for list rendering
          <li key={i} className="flex items-start gap-1.5">
            <span className="mt-[0.45em] w-1.5 h-1.5 rounded-full bg-current opacity-50 flex-shrink-0" />
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    )
    listItems = []
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // Horizontal rule
    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      flushList()
      elements.push(<hr key={key++} className="my-2 border-gray-200 dark:border-gray-600" />)
      continue
    }

    // Unordered list item
    if (/^[-*+]\s+/.test(trimmed)) {
      const content = trimmed.replace(/^[-*+]\s+/, '')
      listItems.push(content)
      continue
    }

    // Flush pending list before non-list lines
    flushList()

    // Headings
    if (trimmed.startsWith('### ')) {
      elements.push(<h3 key={key++} className="text-sm font-bold mt-3 mb-1 text-gray-900 dark:text-gray-100">{renderInline(trimmed.slice(4))}</h3>)
      continue
    }
    if (trimmed.startsWith('## ')) {
      elements.push(<h2 key={key++} className="text-base font-bold mt-3 mb-1 text-gray-900 dark:text-gray-100">{renderInline(trimmed.slice(3))}</h2>)
      continue
    }
    if (trimmed.startsWith('# ')) {
      elements.push(<h1 key={key++} className="text-lg font-bold mt-3 mb-1 text-gray-900 dark:text-gray-100">{renderInline(trimmed.slice(2))}</h1>)
      continue
    }

    // Empty line → paragraph break
    if (trimmed === '') {
      elements.push(<div key={key++} className="h-2" />)
      continue
    }

    // Normal paragraph line
    elements.push(
      <p key={key++} className="leading-relaxed">
        {renderInline(trimmed)}
      </p>
    )
  }

  // Flush any remaining list
  flushList()

  return <div className={`text-sm space-y-0.5 ${className ?? ''}`}>{elements}</div>
}
