import type { TranslationReasoningEffort } from './translateValidation'

export function getOpenAIReasoningEffort(model: string, effort: TranslationReasoningEffort) {
  if (effort === 'auto' || !/^(?:gpt-5(?:[.-]|$)|o[134](?:[.-]|$))/i.test(model)) return undefined
  return effort
}

export function getClaudeReasoningConfig(model: string, effort: TranslationReasoningEffort) {
  if (
    effort === 'auto'
    || !/^claude-(?:sonnet|opus)-(?:4-6|4-7|4-8|5)(?:-|$)/i.test(model)
  ) return {}

  return {
    thinking: { type: 'adaptive' as const },
    output_config: { effort },
  }
}

export function getGeminiThinkingConfig(model: string, effort: TranslationReasoningEffort) {
  if (effort === 'auto') return undefined

  if (/^gemini-3(?:\.\d+)?-/i.test(model)) return { thinkingLevel: effort }
  if (!/^gemini-2\.5-(?:pro|flash(?:-lite)?)(?:-|$)/i.test(model)) return undefined

  return {
    thinkingBudget: {
      low: 1_024,
      medium: 8_192,
      high: 24_576,
    }[effort],
  }
}
