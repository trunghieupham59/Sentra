/**
 * chatTokenResolver — resolves the maximum output token budget for a given
 * provider/model pair.
 *
 * Strategy:
 *   - Gemini exposes `outputTokenLimit` on its model metadata endpoint, which
 *     we cache per model after the first lookup.
 *   - Other providers (OpenAI, Claude, Local) rely on the static rule table
 *     in chatConfig.ts (`CHAT_MODEL_OUTPUT_TOKEN_RULES`).
 *
 * The single public entry point is `resolveChatOutputTokens`, which interprets
 * the renderer-supplied `maxOutputTokens` request:
 *   - `'model-max'` → use the resolved per-model maximum
 *   - a number      → clamp into [1, modelMax]
 *   - undefined     → use the global `MAX_CHAT_OUTPUT_TOKENS` ceiling
 */
import {
  CHAT_MODEL_OUTPUT_TOKEN_RULES,
  CHAT_PROVIDER_IDS,
  type ChatProviderId,
  CONFIGURED_CHAT_PROVIDERS,
  FALLBACK_MODEL_MAX_OUTPUT_TOKENS,
  GEMINI_MODEL_RESOURCE_PREFIX,
} from './chatConfig'
import { CHAT_LOG_MESSAGES } from './chatMessages'
import type { MaxOutputTokensRequest } from './chatValidation'
import { GEMINI_API_BASE, MAX_CHAT_OUTPUT_TOKENS } from './ipcConstants'

const geminiOutputLimitCache = new Map<string, number>()

function isConfiguredChatProvider(provider: string): provider is ChatProviderId {
  return CONFIGURED_CHAT_PROVIDERS.includes(provider as ChatProviderId)
}

/**
 * Look up the static per-family max output token from the rule table.
 * Returns FALLBACK_MODEL_MAX_OUTPUT_TOKENS when no rule matches.
 *
 * Exported for unit tests; production code should call
 * `resolveModelMaxOutputTokens` to also consider Gemini metadata.
 */
export function getCurrentFamilyModelMaxOutputTokens(provider: string, model: string): number {
  if (!isConfiguredChatProvider(provider)) return FALLBACK_MODEL_MAX_OUTPUT_TOKENS

  const id = model.toLowerCase()
  const rule = CHAT_MODEL_OUTPUT_TOKEN_RULES[provider].find((entry) =>
    'includes' in entry ? id.includes(entry.includes) : id.startsWith(entry.startsWith)
  )
  return rule?.maxOutputTokens ?? FALLBACK_MODEL_MAX_OUTPUT_TOKENS
}

async function fetchGeminiModelMaxOutputTokens(apiKey: string, model: string): Promise<number | null> {
  const cached = geminiOutputLimitCache.get(model)
  if (cached) return cached

  try {
    const modelName = model.startsWith(GEMINI_MODEL_RESOURCE_PREFIX)
      ? model
      : `${GEMINI_MODEL_RESOURCE_PREFIX}${model}`
    const response = await fetch(`${GEMINI_API_BASE}/${modelName}?key=${apiKey}`)
    if (!response.ok) return null
    const data = await response.json() as { outputTokenLimit?: number }
    if (typeof data.outputTokenLimit === 'number' && data.outputTokenLimit > 0) {
      geminiOutputLimitCache.set(model, data.outputTokenLimit)
      return data.outputTokenLimit
    }
  } catch (err) {
    console.warn(CHAT_LOG_MESSAGES.geminiOutputLimitFetchFailed, err)
  }

  return null
}

/**
 * Resolve the model-max output token, fetching Gemini metadata when relevant.
 *
 * Exported because tests assert against the Gemini metadata code path with a
 * stubbed `fetch`.
 */
export async function resolveModelMaxOutputTokens(
  provider: string,
  model: string,
  apiKey: string,
): Promise<number> {
  if (provider === CHAT_PROVIDER_IDS.gemini) {
    return await fetchGeminiModelMaxOutputTokens(apiKey, model)
      ?? getCurrentFamilyModelMaxOutputTokens(provider, model)
  }
  return getCurrentFamilyModelMaxOutputTokens(provider, model)
}

/**
 * Resolve the effective `max_tokens` / `max_output_tokens` value for the call.
 *
 * - `'model-max'` → defer to provider/model metadata.
 * - finite number → clamp to [1, modelMax]; defends against renderer-supplied
 *                   values that exceed what the provider will accept.
 * - anything else → fall back to the global hard ceiling.
 */
export async function resolveChatOutputTokens(
  provider: string,
  model: string,
  apiKey: string,
  requested: MaxOutputTokensRequest | undefined,
): Promise<number> {
  if (requested === 'model-max') return resolveModelMaxOutputTokens(provider, model, apiKey)
  if (typeof requested !== 'number' || !Number.isFinite(requested)) return MAX_CHAT_OUTPUT_TOKENS

  const integerValue = Math.floor(requested)
  const modelMax = await resolveModelMaxOutputTokens(provider, model, apiKey)
  return Math.min(Math.max(integerValue, 1), modelMax)
}
