import { describe, expect, it } from 'vitest'
import {
  getEffectiveTranslationReasoningEffort,
  getTranslationReasoningEfforts,
} from '../translationReasoning'

describe('translation reasoning capabilities', () => {
  it.each([
    ['openai', 'gpt-5-mini'],
    ['claude', 'claude-sonnet-4-6'],
    ['gemini', 'gemini-2.5-flash'],
  ] as const)('offers portable effort levels for %s/%s', (provider, model) => {
    expect(getTranslationReasoningEfforts(provider, model)).toEqual([
      'auto',
      'low',
      'medium',
      'high',
    ])
  })

  it('keeps unknown and local models on provider defaults', () => {
    expect(getTranslationReasoningEfforts('openai', 'gpt-4.1-mini')).toEqual(['auto'])
    expect(getTranslationReasoningEfforts('local', 'qwen3:4b')).toEqual(['auto'])
    expect(getEffectiveTranslationReasoningEffort('local', 'qwen3:4b', 'high')).toBe('auto')
  })
})
