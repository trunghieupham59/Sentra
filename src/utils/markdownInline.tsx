/**
 * Shared inline Markdown renderer — used by both MarkdownEditor and MarkdownText.
 * Parses: **bold**, *italic*, _italic_, `code`
 * Returns React nodes suitable for inline rendering.
 *
 * DUP-NEW-01: Extracted from MarkdownEditor.tsx and MarkdownText.tsx to eliminate
 * near-identical implementations. If you add a new inline pattern (e.g. ~~strikethrough~~,
 * [link](url)), add it here once and both renderers benefit automatically.
 */

/** Parse inline elements: **bold**, *italic*, _italic_, `code` */
export function renderInline(raw: string): React.ReactNode[] {
  const result: React.ReactNode[] = []
  // Combined pattern for bold, italic, inline code
  const pattern = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(_(.+?)_)|(`(.+?)`)/g
  let last = 0
  let match: RegExpExecArray | null

  // biome-ignore lint/suspicious/noAssignInExpressions: intentional assignment in loop condition
  while ((match = pattern.exec(raw)) !== null) {
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
