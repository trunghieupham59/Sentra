/**
 * Unit tests for src/utils/markdownInline.tsx
 *
 * Tests cover:
 *   1. Plain text pass-through
 *   2. **bold** → <strong>
 *   3. *italic* → <em>
 *   4. _italic_ → <em>
 *   5. `code` → <code>
 *   6. Mixed content: text + marks + text
 *   7. Multiple consecutive marks
 *   8. Edge cases: empty string, unclosed markers, nested-like patterns
 */
import type React from 'react'
import { describe, expect, it } from 'vitest'
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
