// Typora-like live markdown editor.
// Lines not being edited render as markdown; the active line shows raw syntax.
// Supports: headings, bold, italic, inline code, lists, tables, code blocks, paragraphs.

import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  onBlurAll?: () => void  // called when all lines lose focus
}

// ─── Inline renderer (bold, italic, code) ─────────────────────────────────────

function renderInline(raw: string): React.ReactNode[] {
  const result: React.ReactNode[] = []
  const pattern = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(_(.+?)_)|(`(.+?)`)/g
  let last = 0
  let match: RegExpExecArray | null
  // biome-ignore lint/suspicious/noAssignInExpressions: intentional
  while ((match = pattern.exec(raw)) !== null) {
    if (match.index > last) result.push(raw.slice(last, match.index))
    if (match[1]) result.push(<strong key={match.index}>{match[2]}</strong>)
    else if (match[3]) result.push(<em key={match.index}>{match[4]}</em>)
    else if (match[5]) result.push(<em key={match.index}>{match[6]}</em>)
    else if (match[7]) result.push(
      <code key={match.index} className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[0.85em] font-mono text-gray-800 dark:text-gray-200">
        {match[8]}
      </code>
    )
    last = match.index + match[0].length
  }
  if (last < raw.length) result.push(raw.slice(last))
  return result
}

// ─── Single-line rendered view ─────────────────────────────────────────────────

function RenderedLine({ line }: { line: string }) {
  const t = line.trim()
  if (t === '') return <div className="h-4" />
  if (t.startsWith('### ')) return <h3 className="text-sm font-bold mt-2 mb-0.5 text-gray-900 dark:text-gray-100">{renderInline(t.slice(4))}</h3>
  if (t.startsWith('## ')) return <h2 className="text-base font-bold mt-2 mb-0.5 text-gray-900 dark:text-gray-100">{renderInline(t.slice(3))}</h2>
  if (t.startsWith('# ')) return <h1 className="text-lg font-bold mt-2 mb-0.5 text-gray-900 dark:text-gray-100">{renderInline(t.slice(2))}</h1>
  if (/^[-*+]\s+/.test(t)) return (
    <div className="flex items-start gap-1.5 my-0.5">
      <span className="mt-[0.45em] w-1.5 h-1.5 rounded-full bg-current opacity-50 flex-shrink-0" />
      <span className="text-sm leading-relaxed">{renderInline(t.replace(/^[-*+]\s+/, ''))}</span>
    </div>
  )
  if (/^\d+\.\s+/.test(t)) {
    const num = t.match(/^(\d+)\./)?.[1] ?? '1'
    return (
      <div className="flex items-start gap-1.5 my-0.5">
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 flex-shrink-0 min-w-[1.2em] text-right">{num}.</span>
        <span className="text-sm leading-relaxed">{renderInline(t.replace(/^\d+\.\s+/, ''))}</span>
      </div>
    )
  }
  if (/^\|.*\|$/.test(t) || /^[-|: ]+$/.test(t)) {
    // Table row — render as mono for now when part of a table
    return <div className="font-mono text-xs text-gray-600 dark:text-gray-400 my-0.5">{t}</div>
  }
  if (t.startsWith('```')) return <div className="font-mono text-xs text-gray-500 dark:text-gray-400 my-0.5">{t}</div>
  if (/^-{3,}$/.test(t) || /^\*{3,}$/.test(t)) return <hr className="my-2 border-gray-200 dark:border-gray-600" />
  return <p className="text-sm leading-relaxed my-0.5">{renderInline(t)}</p>
}

// ─── Main MarkdownEditor ────────────────────────────────────────────────────────

export function MarkdownEditor({ value, onChange, placeholder, className, onBlurAll }: Props) {
  const [focusedLine, setFocusedLine] = useState<number | null>(null)
  const lineRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lines = value.split('\n')

  // Auto-resize a textarea to fit its content
  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  // Focus a specific line's textarea (deferred so DOM is ready)
  const focusLine = useCallback((idx: number, cursorPos?: 'start' | 'end' | number) => {
    setFocusedLine(idx)
    requestAnimationFrame(() => {
      const el = lineRefs.current.get(idx)
      if (!el) return
      el.focus()
      if (cursorPos === 'start') el.setSelectionRange(0, 0)
      else if (cursorPos === 'end' || cursorPos === undefined) {
        const len = el.value.length
        el.setSelectionRange(len, len)
      } else {
        el.setSelectionRange(cursorPos, cursorPos)
      }
    })
  }, [])

  // Update a single line value
  const setLineValue = useCallback((idx: number, newVal: string) => {
    const newLines = [...lines]
    newLines[idx] = newVal
    onChange(newLines.join('\n'))
  }, [lines, onChange])

  const handleKeyDown = useCallback((idx: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // Split current line at cursor position
      const pos = el.selectionStart
      const before = lines[idx].slice(0, pos)
      const after = lines[idx].slice(pos)
      const newLines = [...lines]
      newLines[idx] = before
      newLines.splice(idx + 1, 0, after)
      onChange(newLines.join('\n'))
      focusLine(idx + 1, 0)
      return
    }

    if (e.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0 && idx > 0) {
      e.preventDefault()
      // Merge with previous line
      const prevLen = lines[idx - 1].length
      const newLines = [...lines]
      newLines[idx - 1] = lines[idx - 1] + lines[idx]
      newLines.splice(idx, 1)
      onChange(newLines.join('\n'))
      focusLine(idx - 1, prevLen)
      return
    }

    if (e.key === 'Delete' && el.selectionStart === el.value.length && idx < lines.length - 1) {
      e.preventDefault()
      // Merge next line into current
      const curLen = lines[idx].length
      const newLines = [...lines]
      newLines[idx] = lines[idx] + lines[idx + 1]
      newLines.splice(idx + 1, 1)
      onChange(newLines.join('\n'))
      focusLine(idx, curLen)
      return
    }

    if (e.key === 'ArrowUp' && idx > 0) {
      const lineStart = el.value.substring(0, el.selectionStart).lastIndexOf('\n') + 1
      if (el.selectionStart <= lineStart) {
        e.preventDefault()
        focusLine(idx - 1, 'end')
      }
      return
    }

    if (e.key === 'ArrowDown' && idx < lines.length - 1) {
      const lineEnd = el.value.indexOf('\n', el.selectionStart)
      if (lineEnd === -1 || el.selectionStart >= lineEnd) {
        e.preventDefault()
        focusLine(idx + 1, 0)
      }
    }
  }, [lines, onChange, focusLine])

  const handleLineBlur = useCallback(() => {
    // Use a short delay so we can check if focus moved to another line
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
    blurTimerRef.current = setTimeout(() => {
      // Check if any line textarea is still focused
      const activeEl = document.activeElement
      const anyLineFocused = activeEl instanceof HTMLTextAreaElement &&
        containerRef.current?.contains(activeEl)
      if (!anyLineFocused) {
        setFocusedLine(null)
        onBlurAll?.()
      }
    }, 50)
  }, [onBlurAll])

  // When focusedLine changes, auto-resize that textarea
  useEffect(() => {
    if (focusedLine !== null) {
      const el = lineRefs.current.get(focusedLine)
      autoResize(el ?? null)
    }
  }, [focusedLine, autoResize])

  // Click on the container (not a line) → focus the last line
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      const lastIdx = Math.max(0, lines.length - 1)
      focusLine(lastIdx, 'end')
    }
  }, [lines.length, focusLine])

  const isEmpty = value === '' || value === '\n'

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: intentional click-to-focus container
    // biome-ignore lint/a11y/useKeyWithClickEvents: container click-to-focus only
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      className={`cursor-text ${className ?? ''}`}
    >
      {isEmpty && focusedLine === null && (
        <span className="text-gray-400 dark:text-gray-600 text-[15px] select-none pointer-events-none">
          {placeholder}
        </span>
      )}
      {lines.map((line, idx) => (
        focusedLine === idx ? (
          // ── Active line: raw textarea ──────────────────────────────────
          <textarea
            // biome-ignore lint/suspicious/noArrayIndexKey: stable line index
            key={`edit-${idx}`}
            ref={(el) => {
              if (el) {
                lineRefs.current.set(idx, el)
                autoResize(el)
              } else {
                lineRefs.current.delete(idx)
              }
            }}
            value={line}
            onChange={(e) => {
              setLineValue(idx, e.target.value)
              autoResize(e.target)
            }}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onBlur={handleLineBlur}
            rows={1}
            className="w-full bg-transparent outline-none resize-none overflow-hidden
                       font-mono text-[15px] leading-relaxed text-gray-700 dark:text-gray-200
                       py-0 px-0 block"
            style={{ minHeight: '1.6em' }}
          />
        ) : (
          // ── Inactive line: rendered markdown ──────────────────────────
          // biome-ignore lint/a11y/noStaticElementInteractions: click-to-edit rendered line
          // biome-ignore lint/a11y/useKeyWithClickEvents: editor lines use click-only interaction
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: stable line index
            key={`view-${idx}`}
            onClick={(e) => {
              e.stopPropagation()
              focusLine(idx, 'end')
            }}
          >
            <RenderedLine line={line} />
          </div>
        )
      ))}
    </div>
  )
}
