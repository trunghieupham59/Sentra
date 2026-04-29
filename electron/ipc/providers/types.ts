/**
 * Provider type definitions — single source of truth for AI providers in the main process.
 *
 * This module defines the provider type contract and runtime validation used by all
 * IPC handlers. By centralizing provider identity here, adding a new provider requires:
 *   1. Adding its ID to SUPPORTED_PROVIDERS below
 *   2. Implementing the per-function handlers in translate.ts / chat.ts / tts.ts
 *   3. Adding it to the respective provider registries (TRANSLATE_PROVIDERS, etc.)
 *
 * The renderer-side equivalent is in src/constants/providers.ts.
 * Sync is verified by electron/ipc/__tests__/constants.test.ts.
 */

// ── Provider identity ──────────────────────────────────────────────────────────

/** All provider IDs the app currently supports. */
export const SUPPORTED_PROVIDERS = ['gemini', 'claude', 'openai', 'local'] as const

/** Union type of all supported provider IDs. */
export type SupportedProvider = typeof SUPPORTED_PROVIDERS[number]

/**
 * Type guard — returns true when `provider` is a recognized, supported provider ID.
 *
 * Prefer this over scattered `provider === 'gemini' || provider === 'claude'` checks.
 * When a new provider is added, update SUPPORTED_PROVIDERS — this guard updates automatically.
 *
 * @example
 * ```ts
 * if (!isValidProvider(params.provider)) {
 *   return unknownProviderError(params.provider)
 * }
 * ```
 */
export function isValidProvider(provider: string): provider is SupportedProvider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(provider)
}

/**
 * Returns a standardized "unknown provider" IPC error response.
 * Includes a helpful hint listing the supported providers.
 */
export function unknownProviderError(provider: string) {
  return {
    success: false as const,
    error: `Unknown provider: "${provider}". Supported: ${SUPPORTED_PROVIDERS.join(', ')}`,
  }
}

// ── Provider interface contract ────────────────────────────────────────────────

/**
 * ITranslationProvider — the interface contract every AI provider must fulfill for text translation.
 *
 * This interface is intentionally kept narrow — it covers only what translate.ts needs.
 * Each provider (Gemini, Claude, OpenAI) implements these operations using its own SDK,
 * which is why the implementations are kept as separate functions rather than class instances.
 *
 * When adding a new provider, implement all four operations and register them in the
 * respective registry objects (TRANSLATE_PROVIDERS, REWRITE_PROVIDERS, DETECT_PROVIDERS,
 * STREAM_PROVIDERS) in electron/ipc/translate.ts.
 *
 * @example Adding a new provider
 * ```ts
 * // 1. Add provider ID to SUPPORTED_PROVIDERS above
 * // 2. Implement the functions:
 * async function translateWithMyProvider(apiKey, model, sourceText, ...) { ... }
 * async function rewriteWithMyProvider(apiKey, model, text, lang) { ... }
 * async function detectWithMyProvider(apiKey, model, prompt) { ... }
 * async function streamWithMyProvider(apiKey, model, prompt, onToken) { ... }
 * // 3. Register in the registries:
 * TRANSLATE_PROVIDERS['myprovider'] = translateWithMyProvider
 * REWRITE_PROVIDERS['myprovider'] = rewriteWithMyProvider
 * DETECT_PROVIDERS['myprovider'] = detectWithMyProvider
 * STREAM_PROVIDERS['myprovider'] = streamWithMyProvider
 * ```
 */
export interface ITranslationProvider {
  /**
   * Translate text from `sourceLang` to `targetLang`.
   * Must return the translated string only — no metadata, no preamble.
   */
  translate(
    apiKey: string,
    model: string,
    sourceText: string,
    sourceLang: string,
    targetLang: string,
    showFurigana: boolean,
    style: string,
    phoneticOnly: boolean,
  ): Promise<string>

  /**
   * Rewrite text to sound more natural in its target language.
   * Must return only the rewritten text.
   */
  rewrite(
    apiKey: string,
    model: string,
    text: string,
    lang: string,
    style?: string,
  ): Promise<string>

  /**
   * Detect the BCP-47 language code of `text`.
   * Must return a short code like "vi", "en", "ja" — nothing else.
   */
  detect(
    apiKey: string,
    model: string,
    prompt: string,
  ): Promise<string>

  /**
   * Stream-translate text, invoking `onToken` for each generated token.
   * Must return the full accumulated text when the stream is complete.
   */
  stream(
    apiKey: string,
    model: string,
    prompt: string,
    onToken: (token: string) => void,
  ): Promise<string>

  /**
   * Verify that the API key is valid by making a minimal test request.
   * Must throw if the key is invalid or the provider is unreachable.
   */
  verify(apiKey: string): Promise<void>
}
