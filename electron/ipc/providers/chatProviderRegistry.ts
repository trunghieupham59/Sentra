/**
 * Chat provider registry — maps provider IDs to their non-streaming and
 * streaming implementations.
 *
 * The registry keeps the IPC handler in `chat.ts` declarative: a missing entry
 * for a provider yields a typed `unknownProviderError` response without the
 * handler having to know about every provider's SDK.
 *
 * To add a new provider:
 *   1. Implement `chatWithMyProvider` and `streamChatWithMyProvider` in a new
 *      file under `electron/ipc/providers/`.
 *   2. Add its ID to `SUPPORTED_PROVIDERS` in `providers/types.ts`.
 *   3. Wire it into both maps below.
 */
import { chatWithClaude, streamChatWithClaude } from './chatProviderClaude'
import { chatWithGemini, streamChatWithGemini } from './chatProviderGemini'
import { chatWithLocal, streamChatWithLocal } from './chatProviderLocal'
import { chatWithOpenAI, streamChatWithOpenAI } from './chatProviderOpenAI'
import type { ChatFn, ChatStreamFn } from './chatProviderTypes'

/** Non-streaming chat provider lookup table. */
export const CHAT_PROVIDERS: Record<string, ChatFn> = {
  gemini: chatWithGemini,
  claude: chatWithClaude,
  openai: chatWithOpenAI,
  local: chatWithLocal,
}

/** Streaming chat provider lookup table. */
export const CHAT_STREAM_PROVIDERS: Record<string, ChatStreamFn> = {
  gemini: streamChatWithGemini,
  claude: streamChatWithClaude,
  openai: streamChatWithOpenAI,
  local: streamChatWithLocal,
}
