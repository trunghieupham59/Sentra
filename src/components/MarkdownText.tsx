// Lightweight Markdown renderer for AI chat responses and translation output.
// Supports: headings, bold, italic, inline code, code blocks, unordered lists,
// ordered lists, tables, horizontal rules, paragraphs.
// No external dependencies - pure React.

import { renderInline } from '../utils/markdownInline'

interface Props {
  text: string
  className?: string
}

/** Check if a line is a table separator row (|---|---|) */
function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|/.test(line.trim())
}

/** Check if a line looks like a table row (starts and ends with |) */
function isTableRow(line: string): boolean {
  const t = line.trim()
  return t.startsWith('|') && t.endsWith('|')
}

/** Parse a table row into cells */
function parseTableRow(line: string): string[] {
  return line.trim().slice(1, -1).split('|').map(cell => cell.trim())
}

export function MarkdownText({ text, className }: Props) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []
  let orderedListItems: string[] = []
  let tableLines: string[] = []
  let inCodeBlock = false
  let codeLines: string[] = []
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

  const flushOrderedList = () => {
    if (orderedListItems.length === 0) return
    elements.push(
      <ol key={`ol-${key++}`} className="my-1.5 space-y-0.5 list-none pl-0">
        {orderedListItems.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable index for list rendering
          <li key={i} className="flex items-start gap-1.5">
            <span className="mt-[0.1em] text-xs font-semibold text-gray-400 dark:text-gray-500 flex-shrink-0 min-w-[1.2em] text-right">{i + 1}.</span>
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ol>
    )
    orderedListItems = []
  }

  const flushTable = () => {
    if (tableLines.length < 2) {
      // Not a valid table — emit as paragraphs
      for (const l of tableLines) {
        elements.push(<p key={key++} className="leading-relaxed">{renderInline(l)}</p>)
      }
      tableLines = []
      return
    }

    const headerCells = parseTableRow(tableLines[0])
    // Skip separator row (index 1), data starts at index 2
    const dataRows = tableLines.slice(2).filter(l => isTableRow(l))

    elements.push(
      <div key={`tbl-${key++}`} className="my-2 overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {headerCells.map((cell, ci) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: stable index for table header
                <th key={ci}
                  className="px-3 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 first:rounded-tl last:rounded-tr"
                >
                  {renderInline(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => {
              const cells = parseTableRow(row)
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: stable index for table rows
                <tr key={ri} className="border-b border-gray-100 dark:border-gray-800 even:bg-gray-50 even:dark:bg-gray-900/30">
                  {cells.map((cell, ci) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: stable index for table cells — row index used as key
                    <td key={`${ri}-${ci}`} className="px-3 py-1.5 text-gray-700 dark:text-gray-300 align-top">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
    tableLines = []
  }

  const flushCodeBlock = () => {
    if (codeLines.length === 0) return
    elements.push(
      <pre key={`pre-${key++}`} className="my-2 px-3 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-x-auto text-[0.82em] font-mono text-gray-800 dark:text-gray-200 leading-relaxed">
        <code>{codeLines.join('\n')}</code>
      </pre>
    )
    codeLines = []
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // ── Code fence ────────────────────────────────────────────────────────────
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        flushList()
        flushOrderedList()
        flushTable()
        inCodeBlock = true
      } else {
        inCodeBlock = false
        flushCodeBlock()
      }
      continue
    }
    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    // ── Table row ─────────────────────────────────────────────────────────────
    if (isTableRow(trimmed) || isTableSeparator(trimmed)) {
      flushList()
      flushOrderedList()
      tableLines.push(trimmed)
      continue
    }

    // If we were collecting table lines and now have a non-table line
    if (tableLines.length > 0) {
      flushTable()
    }

    // ── Horizontal rule ───────────────────────────────────────────────────────
    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      flushList()
      flushOrderedList()
      elements.push(<hr key={key++} className="my-2 border-gray-200 dark:border-gray-600" />)
      continue
    }

    // ── Unordered list item ───────────────────────────────────────────────────
    if (/^[-*+]\s+/.test(trimmed)) {
      flushOrderedList()
      const content = trimmed.replace(/^[-*+]\s+/, '')
      listItems.push(content)
      continue
    }

    // ── Ordered list item ─────────────────────────────────────────────────────
    if (/^\d+\.\s+/.test(trimmed)) {
      flushList()
      const content = trimmed.replace(/^\d+\.\s+/, '')
      orderedListItems.push(content)
      continue
    }

    // Flush pending lists before non-list lines
    flushList()
    flushOrderedList()

    // ── Headings ──────────────────────────────────────────────────────────────
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

    // ── Empty line → paragraph break ──────────────────────────────────────────
    if (trimmed === '') {
      elements.push(<div key={key++} className="h-2" />)
      continue
    }

    // ── Normal paragraph line ─────────────────────────────────────────────────
    elements.push(
      <p key={key++} className="leading-relaxed">
        {renderInline(trimmed)}
      </p>
    )
  }

  // Flush remaining buffers
  if (inCodeBlock) flushCodeBlock()
  flushList()
  flushOrderedList()
  if (tableLines.length > 0) flushTable()

  return <div className={`text-[15px] space-y-0.5 ${className ?? ''}`}>{elements}</div>
}
