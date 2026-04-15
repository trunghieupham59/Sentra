/**
 * Chat service — thin wrapper over window.api.chat IPC call.
 *
 * Centralizes all chat-related API calls, decoupling ChatPage from the
 * IPC interface directly. If the IPC protocol changes, only this file
 * needs to be updated.
 *
 * Usage:
 *   import { chatService } from '../services/chatService'
 *   const result = await chatService.send({ ... })
 */
// DUP-07: ChatMessageContent is the canonical definition in src/types/index.ts.
// It has extra renderer-only fields (imagePreviewUrl, imageFileName) compared to the
// main-process version in electron/ipc/chat.ts, but the IPC layer ignores unknown fields,
// so using the richer type here is safe.
import type { ChatResult, ChatMessageContent } from '../types'

// Re-export for any consumers that import ChatMessageContent from chatService
export type { ChatMessageContent }

/**
 * IPC-format ChatMessage — contains only fields transmitted over the IPC boundary.
 * Intentionally does NOT include UI-only fields (id, timestamp, isLoading, error)
 * that exist in the full ChatMessage type in src/types/index.ts.
 * These are two different concepts: the store type vs the API transport type.
 */
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: ChatMessageContent[]
}

interface ChatParams {
  provider: string
  model: string
  messages: ChatMessage[]
  systemPrompt?: string
}

export const chatService = {
  /** Send a conversational message — supports text + image content, multi-turn. */
  send: (params: ChatParams): Promise<ChatResult> =>
    window.api.chat(params),
}
