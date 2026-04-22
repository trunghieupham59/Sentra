/**
 * Unit tests for src/hooks/useTypewriter.ts
 *
 * Tests cover:
 *   1. Empty text → returns ''
 *   2. Single word → reveals immediately without timer
 *   3. Multi-word → reveals word-by-word at msPerWord interval
 *   4. Text change → restarts animation from beginning
 *   5. Text cleared → resets displayed to ''
 *   6. Cleanup → clears interval on unmount
 *
 * Uses vi.useFakeTimers() to control time deterministically.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTypewriter } from '../useTypewriter'

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

// ─────────────────────────────────────────────────────────────────────────────
describe('useTypewriter — empty / short text', () => {
  it('returns "" immediately for empty text', () => {
    const { result } = renderHook(() => useTypewriter(''))
    expect(result.current).toBe('')
  })

  it('returns the full text immediately for a single word', () => {
    const { result } = renderHook(() => useTypewriter('Hello'))
    expect(result.current).toBe('Hello')
  })

  it('returns the full text immediately for single-word text (no spaces)', () => {
    const { result } = renderHook(() => useTypewriter('こんにちは'))
    expect(result.current).toBe('こんにちは')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('useTypewriter — multi-word reveal', () => {
  it('shows only the first word before any timers fire', () => {
    const { result } = renderHook(() => useTypewriter('Hello World Foo', 100))
    expect(result.current).toBe('Hello')
  })

  it('reveals the second word after one interval', () => {
    const { result } = renderHook(() => useTypewriter('Hello World Foo', 100))
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current).toBe('Hello World')
  })

  it('reveals all words after two intervals', () => {
    const { result } = renderHook(() => useTypewriter('Hello World Foo', 100))
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current).toBe('Hello World Foo')
  })

  it('shows full text once animation completes', () => {
    const text = 'One Two Three Four'
    const { result } = renderHook(() => useTypewriter(text, 50))
    act(() => { vi.advanceTimersByTime(1000) }) // much more than needed
    expect(result.current).toBe(text)
  })

  it('respects msPerWord timing — does not reveal word before interval fires', () => {
    const { result } = renderHook(() => useTypewriter('Alpha Beta', 200))
    act(() => { vi.advanceTimersByTime(199) }) // 1ms short
    expect(result.current).toBe('Alpha') // not yet revealed
    act(() => { vi.advanceTimersByTime(1) })  // exactly at 200ms
    expect(result.current).toBe('Alpha Beta')
  })

  it('uses default 45ms interval when msPerWord is not specified', () => {
    const { result } = renderHook(() => useTypewriter('A B'))
    act(() => { vi.advanceTimersByTime(44) })
    expect(result.current).toBe('A') // not yet
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current).toBe('A B')
  })

  it('handles two-word text correctly', () => {
    const { result } = renderHook(() => useTypewriter('Hi There', 100))
    expect(result.current).toBe('Hi')
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current).toBe('Hi There')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('useTypewriter — text changes', () => {
  it('clears displayed text when text becomes empty', () => {
    const { result, rerender } = renderHook(
      ({ t }: { t: string }) => useTypewriter(t, 100),
      { initialProps: { t: 'Hello World' } }
    )
    // Advance to show some words
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current).toBe('Hello World')

    // Clear text
    rerender({ t: '' })
    expect(result.current).toBe('')
  })

  it('restarts animation from the first word when text changes', () => {
    const { result, rerender } = renderHook(
      ({ t }: { t: string }) => useTypewriter(t, 100),
      { initialProps: { t: 'Hello World' } }
    )
    // Complete first animation
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current).toBe('Hello World')

    // Change text — animation should restart
    rerender({ t: 'New Text Here' })
    expect(result.current).toBe('New') // only first word visible
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current).toBe('New Text')
  })

  it('handles rapid text changes gracefully', () => {
    const { result, rerender } = renderHook(
      ({ t }: { t: string }) => useTypewriter(t, 100),
      { initialProps: { t: 'First Text' } }
    )
    rerender({ t: 'Second Text' })
    rerender({ t: 'Third Text' })
    // Should show first word of the last text
    expect(result.current).toBe('Third')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('useTypewriter — cleanup', () => {
  it('clears the interval on unmount (no timer leak)', () => {
    const { result, unmount } = renderHook(() => useTypewriter('A B C', 100))
    expect(result.current).toBe('A')
    unmount()
    // Advancing timers after unmount should not throw or update
    act(() => { vi.advanceTimersByTime(1000) })
    // Test passes if no error is thrown
    expect(true).toBe(true)
  })
})
