/**
 * Shared types & helpers for the chat provider layer.
 *
 * These primitives are consumed by every provider implementation
 * (Gemini / Claude / OpenAI / Local) and by the chat IPC handler.
 *
 * Kept intentionally small: only cross-provider concepts live here;
 * provider-specific SDK wiring belongs in the per-provider modules.
 */

import type { ChatMessage } from '../chatValidation'

// ── Streaming primitives ─────────────────────────────────────────────────────

/** Callback invoked once per provider-emitted token during streaming. */
export type ChatStreamTokenHandler = (token: string) => void

/**
 * Sentinel error message used by provider stream functions to signal that the
 * user (renderer) explicitly aborted the stream. The IPC stream handler
 * recognises this string and emits a typed `CANCELLED` error code so the
 * renderer can suppress it from showing as a real error.
 */
export const CHAT_STREAM_CANCELLED_MESSAGE = 'chat-stream-cancelled'

/**
 * Detect whether an error represents an abort/cancellation, regardless of
 * which provider SDK threw it. Recognises:
 *   - DOMException AbortError
 *   - The CHAT_STREAM_CANCELLED_MESSAGE sentinel
 *   - "aborted" / "cancelled" / "canceled" anywhere in the message
 *   - Node's `ABORT_ERR` / `ECONNRESET` codes
 */
export function isAbortError(error: unknown): boolean {
  if (!error) return false
  if (error instanceof Error) {
    if (error.name === 'AbortError') return true
    const msg = error.message || ''
    if (msg === CHAT_STREAM_CANCELLED_MESSAGE) return true
    if (msg.toLowerCase().includes('aborted')) return true
    if (msg.toLowerCase().includes('cancelled') || msg.toLowerCase().includes('canceled')) return true
  }
  const anyError = error as { name?: string; code?: string }
  if (anyError.name === 'AbortError') return true
  if (anyError.code === 'ABORT_ERR' || anyError.code === 'ECONNRESET') return true
  return false
}

// ── Provider function signatures ─────────────────────────────────────────────

/**
 * Per-request behaviour flags that providers must respect when present.
 * Kept as a single options bag so adding a new behaviour (e.g. `webSearch`,
 * `reasoningEffort`) does not break every provider's signature.
 */
export interface ChatProviderOptions {
  /**
   * When true, the system prompt is augmented with the
   * "REASONING DISCIPLINE" directive (see `chatPrompts.ts`). Providers
   * forward this into `buildEnforcedSystemPrompt(systemPrompt, { carefulReasoning })`.
   */
  carefulReasoning?: boolean
}

/** Non-streaming chat function — every provider implements this shape. */
export type ChatFn = (
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt?: string,
  maxOutputTokens?: number,
  options?: ChatProviderOptions,
) => Promise<string>

/** Streaming chat function — every provider implements this shape. */
export type ChatStreamFn = (
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt: string | undefined,
  maxOutputTokens: number,
  onToken: ChatStreamTokenHandler,
  signal?: AbortSignal,
  options?: ChatProviderOptions,
) => Promise<string>


// ── Image edit primitives ────────────────────────────────────────────────────

/** Outcome of an image-edit call, normalised across providers. */
export interface ChatImageEditResultPayload {
  imageBase64: string
  imageMimeType: string
  usedModel: string
}

/** Image-edit function — only providers that support it implement this. */
export type ChatImageEditFn = (
  apiKey: string,
  model: string,
  prompt: string,
  imageBase64: string,
  imageMimeType: string,
) => Promise<ChatImageEditResultPayload>
