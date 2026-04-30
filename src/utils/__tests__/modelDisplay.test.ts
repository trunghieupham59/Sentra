/**
 * Tests for modelDisplay — short pretty names + family-level dedupe.
 *
 * Why these cases matter:
 *  - The footer in Quick Chat is space-constrained — short names are critical.
 *  - The model dropdown collapses date-stamped snapshots so users don't see
 *    five rows of `gpt-5-mini-*` clutter.
 */
import { describe, expect, it } from 'vitest'
import type { FetchedModel } from '../../types'
import { dedupeModelsByFamily, formatModelName } from '../modelDisplay'

describe('formatModelName', () => {
  it('shortens dated OpenAI snapshots into prefix-first display names', () => {
    expect(formatModelName('openai', 'gpt-5.4-mini-2026-03-17')).toBe('GPT 5.4 Mini')
    expect(formatModelName('openai', 'gpt-5.5-mini-latest')).toBe('GPT 5.5 Mini')
    expect(formatModelName('openai', 'gpt-5.5-mini-2026-05-01')).toBe('GPT 5.5 Mini')
    expect(formatModelName('openai', 'gpt-5-thinking')).toBe('GPT 5 Thinking')
    expect(formatModelName('openai', 'gpt-4o')).toBe('GPT 4o')
    expect(formatModelName('openai', 'gpt-4.1-mini')).toBe('GPT 4.1 Mini')
  })

  it('formats Claude ids and collapses split version numbers', () => {
    expect(formatModelName('claude', 'claude-sonnet-4-20250514')).toBe('Claude Sonnet 4')
    expect(formatModelName('claude', 'claude-opus-4-1-20250805')).toBe('Claude Opus 4.1')
    expect(formatModelName('claude', 'claude-3-5-sonnet-latest')).toBe('Claude 3.5 Sonnet')
    expect(formatModelName('claude', 'claude-haiku-3-5')).toBe('Claude Haiku 3.5')
  })

  it('formats Gemini ids and strips preview suffixes', () => {
    expect(formatModelName('gemini', 'gemini-2.5-flash')).toBe('Gemini 2.5 Flash')
    expect(formatModelName('gemini', 'gemini-2.5-flash-lite')).toBe('Gemini 2.5 Flash Lite')
    expect(formatModelName('gemini', 'gemini-1.5-pro-preview')).toBe('Gemini 1.5 Pro')
  })

  it('falls back to the provided fallback name for unknown ids', () => {
    expect(formatModelName('local', 'qwen3:4b', 'Qwen3 4B')).toBe('Qwen3 4B')
    // No known prefix → returns raw id when no fallback supplied.
    expect(formatModelName('local', 'qwen3:4b')).toBe('qwen3:4b')
  })
})

describe('dedupeModelsByFamily', () => {
  const m = (id: string): FetchedModel => ({ id, name: id, description: '' })

  it('keeps only the newest snapshot per family for OpenAI', () => {
    const result = dedupeModelsByFamily('openai', [
      m('gpt-5.5-mini-2026-04-15'),
      m('gpt-5.5-mini-latest'),
      m('gpt-5.5-mini-2026-05-01'),
      m('gpt-5.4-mini-2026-03-17'),
      m('gpt-5'),
    ])
    expect(result.map((x) => x.id)).toEqual([
      // Newest of the gpt-5.5-mini-* family is the dated snapshot
      // (lex-sorted, '2026-05-01' > 'latest').
      'gpt-5.5-mini-2026-05-01',
      'gpt-5.4-mini-2026-03-17',
      'gpt-5',
    ])
  })

  it('collapses Claude dated snapshots to one entry per family', () => {
    const result = dedupeModelsByFamily('claude', [
      m('claude-opus-4-1-20250805'),
      m('claude-opus-4-1-20250901'),
      m('claude-sonnet-4-20250514'),
    ])
    expect(result.map((x) => x.id)).toEqual([
      'claude-opus-4-1-20250901',
      'claude-sonnet-4-20250514',
    ])
  })

  it('preserves the local provider list verbatim', () => {
    const list = [m('qwen3:4b'), m('gemma3:4b'), m('local-auto')]
    const result = dedupeModelsByFamily('local', list)
    expect(result).toEqual(list)
  })
})
