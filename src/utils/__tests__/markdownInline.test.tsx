/**
 * Unit tests for src/utils/markdownInline.tsx
 *
 * Tests cover:
 *   1. Plain text pass-through
 *   2. Links: [label](url) and bare URLs
 *   3. **bold** → <strong>
 *   4. *italic* → <em>
 *   5. _italic_ → <em>
 *   6. `code` → <code>
 *   7. Mixed content: text + marks + text
 *   8. Multiple consecutive marks
 *   9. Edge cases: empty string, unclosed markers, nested-like patterns
 */
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderInline } from '../markdownInline'

// ── Helper: extract element type and text from a ReactNode ────────────────────

function getElement(node: React.ReactNode): React.ReactElement {
  return node as React.ReactElement
}

// ─────────────────────────────────────────────────────────────────────────────
describe('renderInline — plain text', () => {
  it('returns empty array for empty string', () => {
    const result = renderInline('')
    expect(result).toHaveLength(0)
  })

  it('returns a single string node for plain text with no markers', () => {
    const result = renderInline('Hello world')
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('Hello world')
  })

  it('returns plain text unchanged when no markdown present', () => {
    const text = 'No formatting here at all'
    const result = renderInline(text)
    expect(result[0]).toBe(text)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('renderInline — links', () => {
  it('wraps markdown links in <a>', () => {
    const result = renderInline('[Viezan](https://viezan.app/docs)')
    expect(result).toHaveLength(1)
    const el = getElement(result[0])
    expect(el.type).toBe('a')
    expect(el.props.href).toBe('https://viezan.app/docs')
    expect(el.props.children).toBe('Viezan')
  })

  it('wraps source-style title and URL pairs in <a>', () => {
    const result = renderInline('[Quy định 368-QĐ/TW] (https://luatvietnam.vn/co-cau-to-chuc/quy-dinh.html)')
    expect(result).toHaveLength(1)
    const el = getElement(result[0])
    expect(el.type).toBe('a')
    expect(el.props.href).toBe('https://luatvietnam.vn/co-cau-to-chuc/quy-dinh.html')
    expect(el.props.children).toBe('Quy định 368-QĐ/TW')
  })

  it('linkifies bare https URLs', () => {
    const result = renderInline('Source: https://luatvietnam.vn/co-cau-to-chuc/quy-dinh.html')
    expect(result).toHaveLength(2)
    expect(result[0]).toBe('Source: ')
    const el = getElement(result[1])
    expect(el.type).toBe('a')
    expect(el.props.href).toBe('https://luatvietnam.vn/co-cau-to-chuc/quy-dinh.html')
    expect(el.props.children).toBe('https://luatvietnam.vn/co-cau-to-chuc/quy-dinh.html')
  })

  it('linkifies public http URLs from source lists', () => {
    const result = renderInline('(http://www.cchccantho.gov.vn/danh-muc-chuc-danh)')
    expect(result).toHaveLength(3)
    expect(result[0]).toBe('(')
    const el = getElement(result[1])
    expect(el.type).toBe('a')
    expect(el.props.href).toBe('http://www.cchccantho.gov.vn/danh-muc-chuc-danh')
    expect(result[2]).toBe(')')
  })

  it('keeps sentence punctuation outside bare links', () => {
    const result = renderInline('Read https://example.com/docs?q=1.')
    expect(result).toHaveLength(3)
    const el = getElement(result[1])
    expect(el.type).toBe('a')
    expect(el.props.href).toBe('https://example.com/docs?q=1')
    expect(result[2]).toBe('.')
  })

  it('adds https to www-only URLs', () => {
    const result = renderInline('Visit www.viezan.app/docs')
    const el = getElement(result[1])
    expect(el.type).toBe('a')
    expect(el.props.href).toBe('https://www.viezan.app/docs')
    expect(el.props.children).toBe('www.viezan.app/docs')
  })

  it('opens links through the Electron external URL bridge when clicked', () => {
    const openExternal = vi.mocked(window.api.openExternal)
    openExternal.mockClear()

    const result = renderInline('Source: https://viezan.app/docs')
    const el = getElement(result[1])
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }

    el.props.onClick(event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(event.stopPropagation).toHaveBeenCalled()
    expect(openExternal).toHaveBeenCalledWith('https://viezan.app/docs')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('renderInline — **bold**', () => {
  it('wraps **bold** content in <strong>', () => {
    const result = renderInline('**bold**')
    expect(result).toHaveLength(1)
    const el = getElement(result[0])
    expect(el.type).toBe('strong')
    expect(el.props.children).toBe('bold')
  })

  it('preserves surrounding text around **bold**', () => {
    const result = renderInline('Hello **world** foo')
    expect(result).toHaveLength(3)
    expect(result[0]).toBe('Hello ')
    const el = getElement(result[1])
    expect(el.type).toBe('strong')
    expect(el.props.children).toBe('world')
    expect(result[2]).toBe(' foo')
  })

  it('handles **bold** at start of string', () => {
    const result = renderInline('**Start** rest')
    expect(result[0]).not.toBe('**Start** rest') // first node is element
    const el = getElement(result[0])
    expect(el.type).toBe('strong')
  })

  it('handles **bold** at end of string', () => {
    const result = renderInline('text **End**')
    const lastEl = getElement(result[result.length - 1])
    expect(lastEl.type).toBe('strong')
    expect(lastEl.props.children).toBe('End')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('renderInline — *italic*', () => {
  it('wraps *italic* content in <em>', () => {
    const result = renderInline('*italic*')
    expect(result).toHaveLength(1)
    const el = getElement(result[0])
    expect(el.type).toBe('em')
    expect(el.props.children).toBe('italic')
  })

  it('preserves surrounding text around *italic*', () => {
    const result = renderInline('say *hello* now')
    expect(result[0]).toBe('say ')
    const el = getElement(result[1])
    expect(el.type).toBe('em')
    expect(el.props.children).toBe('hello')
    expect(result[2]).toBe(' now')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('renderInline — _italic_', () => {
  it('wraps _italic_ content in <em>', () => {
    const result = renderInline('_italic_')
    const el = getElement(result[0])
    expect(el.type).toBe('em')
    expect(el.props.children).toBe('italic')
  })

  it('preserves surrounding text around _italic_', () => {
    const result = renderInline('prefix _text_ suffix')
    expect(result[0]).toBe('prefix ')
    const el = getElement(result[1])
    expect(el.type).toBe('em')
    expect(result[2]).toBe(' suffix')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('renderInline — `code`', () => {
  it('wraps `code` content in <code>', () => {
    const result = renderInline('`myFunc()`')
    const el = getElement(result[0])
    expect(el.type).toBe('code')
    expect(el.props.children).toBe('myFunc()')
  })

  it('preserves surrounding text around `code`', () => {
    const result = renderInline('Run `npm install` first')
    expect(result[0]).toBe('Run ')
    const el = getElement(result[1])
    expect(el.type).toBe('code')
    expect(el.props.children).toBe('npm install')
    expect(result[2]).toBe(' first')
  })

  it('code element has correct className for styling', () => {
    const result = renderInline('`code`')
    const el = getElement(result[0])
    expect(el.props.className).toContain('font-mono')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('renderInline — mixed content', () => {
  it('handles multiple marks in one string', () => {
    const result = renderInline('**bold** and *italic*')
    // Should produce: <strong>bold</strong>, ' and ', <em>italic</em>
    expect(result.length).toBeGreaterThanOrEqual(3)
    const first = getElement(result[0])
    expect(first.type).toBe('strong')
    const last = getElement(result[result.length - 1])
    expect(last.type).toBe('em')
  })

  it('handles bold + code in sequence', () => {
    const result = renderInline('**bold** then `code`')
    expect(result.some(n => (n as React.ReactElement).type === 'strong')).toBe(true)
    expect(result.some(n => (n as React.ReactElement).type === 'code')).toBe(true)
  })

  it('returns only the text node when no marks match', () => {
    const text = 'Plain sentence without any markdown.'
    const result = renderInline(text)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(text)
  })

  it('preserves trailing text after all marks', () => {
    const result = renderInline('Use `npm` package manager')
    expect(result[result.length - 1]).toBe(' package manager')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('renderInline — edge cases', () => {
  it('does not match unclosed bold marker **', () => {
    const result = renderInline('**unclosed bold')
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('**unclosed bold')
  })

  it('does not match unclosed italic marker *', () => {
    const result = renderInline('*unclosed italic')
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('*unclosed italic')
  })

  it('does not match unclosed code marker `', () => {
    const result = renderInline('`unclosed code')
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('`unclosed code')
  })

  it('handles string with only whitespace', () => {
    const result = renderInline('   ')
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('   ')
  })

  it('handles multiline text (marks within same line)', () => {
    const result = renderInline('**Title**\nSome text')
    expect(result.length).toBeGreaterThanOrEqual(1)
    const el = getElement(result[0])
    expect(el.type).toBe('strong')
  })
})
