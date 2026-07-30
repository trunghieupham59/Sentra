import { describe, expect, it } from 'vitest'
import {
  getClaudeReasoningConfig,
  getGeminiThinkingConfig,
  getOpenAIReasoningEffort,
} from '../translationReasoning'

describe('translation reasoning provider mapping', () => {
  it('maps OpenAI effort only for documented reasoning families', () => {
    expect(getOpenAIReasoningEffort('gpt-5-mini', 'medium')).toBe('medium')
    expect(getOpenAIReasoningEffort('gpt-4.1-mini', 'medium')).toBeUndefined()
    expect(getOpenAIReasoningEffort('gpt-5-mini', 'auto')).toBeUndefined()
  })

  it('uses adaptive thinking for Claude 4.6+', () => {
    expect(getClaudeReasoningConfig('claude-sonnet-4-6', 'low')).toEqual({
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
    })
    expect(getClaudeReasoningConfig('claude-sonnet-4-20250514', 'high')).toEqual({})
  })

  it('maps Gemini 2.5 levels to documented thinking budgets', () => {
    expect(getGeminiThinkingConfig('gemini-2.5-flash', 'low')).toEqual({ thinkingBudget: 1_024 })
    expect(getGeminiThinkingConfig('gemini-2.5-pro', 'medium')).toEqual({ thinkingBudget: 8_192 })
    expect(getGeminiThinkingConfig('gemini-2.5-flash-lite', 'high')).toEqual({ thinkingBudget: 24_576 })
    expect(getGeminiThinkingConfig('gemini-3.1-pro-preview', 'medium')).toEqual({ thinkingLevel: 'medium' })
    expect(getGeminiThinkingConfig('gemini-2.0-flash', 'high')).toBeUndefined()
  })
})
