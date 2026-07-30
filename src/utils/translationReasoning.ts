import type { Provider, TranslationReasoningEffort } from '../types'

const CONFIGURABLE_REASONING_EFFORTS: readonly TranslationReasoningEffort[] = [
  'auto',
  'low',
  'medium',
  'high',
]
const AUTOMATIC_REASONING_ONLY: readonly TranslationReasoningEffort[] = ['auto']

function supportsOpenAIReasoning(model: string) {
  return /^(?:gpt-5(?:[.-]|$)|o[134](?:[.-]|$))/i.test(model)
}

function supportsClaudeReasoning(model: string) {
  return /^claude-(?:sonnet|opus)-(?:4-6|4-7|4-8|5)(?:-|$)/i.test(model)
}

function supportsGeminiReasoning(model: string) {
  return /^gemini-(?:2\.5|3(?:\.\d+)?)-/i.test(model)
}

/**
 * Curated translation capability registry.
 *
 * Model-list endpoints do not expose reasoning controls consistently, so the UI
 * only offers explicit levels for model families documented by each provider.
 * Unknown/dynamic models remain usable with provider defaults (`auto`).
 */
export function getTranslationReasoningEfforts(
  provider: Provider,
  model: string,
): readonly TranslationReasoningEffort[] {
  const configurable = (
    (provider === 'openai' && supportsOpenAIReasoning(model))
    || (provider === 'claude' && supportsClaudeReasoning(model))
    || (provider === 'gemini' && supportsGeminiReasoning(model))
  )

  return configurable ? CONFIGURABLE_REASONING_EFFORTS : AUTOMATIC_REASONING_ONLY
}

export function getEffectiveTranslationReasoningEffort(
  provider: Provider,
  model: string,
  effort: TranslationReasoningEffort,
): TranslationReasoningEffort {
  return getTranslationReasoningEfforts(provider, model).includes(effort) ? effort : 'auto'
}
