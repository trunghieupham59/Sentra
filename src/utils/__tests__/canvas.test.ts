import { describe, it, expect, vi, beforeEach } from 'vitest'
import { canvasWrapText } from '../canvas'

// Mock CanvasRenderingContext2D
const createMockCtx = (measureWidth: (text: string) => number) => ({
  measureText: vi.fn().mockImplementation((text: string) => ({ width: measureWidth(text) })),
  font: '',
  fillStyle: '',
  globalAlpha: 1,
  textAlign: '',
  textBaseline: '',
  fillRect: vi.fn(),
  fillText: vi.fn(),
} as unknown as CanvasRenderingContext2D)

describe('canvasWrapText', () => {
  it('returns empty array for empty text', () => {
    const ctx = createMockCtx(() => 0)
    expect(canvasWrapText(ctx, '', 200)).toEqual([])
  })

  it('returns single line when text fits within maxWidth', () => {
    const ctx = createMockCtx((text) => text.length * 5) // 5px per char
    const result = canvasWrapText(ctx, 'Hello', 200) // 25px < 200px
    expect(result).toEqual(['Hello'])
  })

  it('wraps long text across multiple lines', () => {
    // Each char = 20px; "Hello World" = 220px; maxWidth = 100px
    // "Hello" = 100px fits, "World" = 100px fits → 2 lines
    const ctx = createMockCtx((text) => text.length * 10)
    const result = canvasWrapText(ctx, 'Hello World', 60)
    expect(result.length).toBeGreaterThanOrEqual(2)
  })

  it('always returns at least [text] for non-empty input', () => {
    const ctx = createMockCtx(() => 999) // everything too wide
    const result = canvasWrapText(ctx, 'A', 100)
    expect(result.length).toBeGreaterThanOrEqual(1)
  })

  it('splits CJK text per character (not whitespace)', () => {
    // CJK: each char is a token; 3 chars × 30px = 90px each; max 50px → needs wrapping
    const ctx = createMockCtx((text) => text.length * 30)
    const result = canvasWrapText(ctx, '日本語', 50)
    // Should produce multiple lines since each char is 30px and max is 50px
    expect(result.length).toBeGreaterThan(1)
  })

  it('treats non-CJK text as whitespace-split tokens', () => {
    // 5px per char; "word1 word2" = 55px; max = 100 → fits in one line
    const ctx = createMockCtx((text) => text.length * 5)
    const result = canvasWrapText(ctx, 'word1 word2', 100)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('word1 word2')
  })

  it('puts each oversized single token on its own line', () => {
    // Very narrow max; every word is wider than maxWidth
    const ctx = createMockCtx((text) => text.length * 20)
    const result = canvasWrapText(ctx, 'Alpha Beta Gamma', 30)
    // Each word (5 chars × 20px = 100px) can't fit; each goes on separate line
    expect(result.length).toBeGreaterThanOrEqual(3)
  })
})
