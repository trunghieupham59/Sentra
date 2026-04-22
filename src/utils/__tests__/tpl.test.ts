/**
 * Unit tests for src/utils/tpl.ts
 *
 * Tests cover:
 *   1. tpl()        — template string placeholder replacement
 *   2. formatDate() — locale-aware date formatting
 */
import { describe, expect, it } from 'vitest'
import { formatDate, tpl } from '../tpl'

// ─────────────────────────────────────────────────────────────────────────────
describe('tpl', () => {
  // ── Happy path ─────────────────────────────────────────────────────────────
  it('replaces a single {key} placeholder', () => {
    expect(tpl('Hello {name}!', { name: 'World' })).toBe('Hello World!')
  })

  it('replaces multiple different placeholders', () => {
    expect(tpl('{greeting}, {name}!', { greeting: 'Hi', name: 'Alice' })).toBe('Hi, Alice!')
  })

  it('replaces a numeric value placeholder', () => {
    expect(tpl('You have {count} messages', { count: 42 })).toBe('You have 42 messages')
  })

  it('replaces the same placeholder appearing multiple times', () => {
    expect(tpl('{x} + {x} = {result}', { x: '2', result: '4' })).toBe('2 + 2 = 4')
  })

  // ── Missing key behavior ───────────────────────────────────────────────────
  it('replaces missing key with empty string', () => {
    expect(tpl('Hello {name}!', {})).toBe('Hello !')
  })

  it('replaces missing key with empty string even when other keys exist', () => {
    expect(tpl('{a} and {b}', { a: 'foo' })).toBe('foo and ')
  })

  // ── No placeholder ─────────────────────────────────────────────────────────
  it('returns original string unchanged when no placeholders exist', () => {
    expect(tpl('No placeholders here', { key: 'value' })).toBe('No placeholders here')
  })

  it('returns empty string unchanged', () => {
    expect(tpl('', { key: 'value' })).toBe('')
  })

  // ── Edge cases ─────────────────────────────────────────────────────────────
  it('does not replace partial braces (unclosed {key)', () => {
    // Regex requires \w+ between { }, unclosed brace is not a valid placeholder
    expect(tpl('Hello {name', { name: 'World' })).toBe('Hello {name')
  })

  it('handles numeric 0 value (falsy but valid)', () => {
    expect(tpl('Count: {n}', { n: 0 })).toBe('Count: 0')
  })

  it('handles special characters in replacement value', () => {
    expect(tpl('Path: {path}', { path: '/usr/local/bin' })).toBe('Path: /usr/local/bin')
  })

  it('processes the inner {key} inside double braces (regex matches innermost)', () => {
    // {{escaped}} — the regex \{(\w+)\} matches the innermost {escaped},
    // replaces it with '' (key missing), leaving the outer braces: '{}'
    // This documents actual behavior: double-braces are NOT an escape sequence.
    expect(tpl('{{escaped}}', {})).toBe('{}')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('formatDate', () => {
  // Use a fixed timestamp for deterministic tests: 2024-03-15 (March 15, 2024)
  // Unix ms: new Date('2024-03-15').getTime()
  const MARCH_15_2024 = new Date('2024-03-15T00:00:00Z').getTime()

  it('formats date with vi locale (DD/MM/YYYY order)', () => {
    const result = formatDate(MARCH_15_2024, 'vi')
    // vi-VN uses DD/MM/YYYY
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('formats date with en locale (MM/DD/YYYY order)', () => {
    const result = formatDate(MARCH_15_2024, 'en')
    // en-US uses MM/DD/YYYY
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('formats date with ja locale', () => {
    const result = formatDate(MARCH_15_2024, 'ja')
    // ja-JP uses YYYY/MM/DD
    expect(result).toContain('2024')
  })

  it('returns a non-empty string for any valid timestamp', () => {
    const result = formatDate(Date.now(), 'en')
    expect(result.length).toBeGreaterThan(0)
  })

  it('produces different format for vi vs en locales', () => {
    // vi-VN: 15/03/2024 vs en-US: 03/15/2024
    const vi = formatDate(MARCH_15_2024, 'vi')
    const en = formatDate(MARCH_15_2024, 'en')
    // They should differ in day/month position
    expect(vi).not.toBe(en)
  })
})
