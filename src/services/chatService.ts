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
import type { ChatImageEditResult, ChatMessageContent, ChatResult, ChatStreamEvent } from '../types'

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
  /** Bypass the 3k char limit — used for Deep Research synthesis with long context */
  bypassLengthCheck?: boolean
  /** Optional larger output budget for long-form synthesis calls */
  maxOutputTokens?: number | 'model-max'
}

interface ChatImageEditParams {
  provider: string
  model: string
  prompt: string
  imageBase64: string
  imageMimeType: string
}

interface ChatStreamCallbacks {
  onStart?: () => void
  onToken?: (token: string) => void
  onEnd?: (reply: string) => void
  onError?: (error: string, errorCode?: string) => void
}

function createChatStreamRequestId() {
  return `chat-stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const chatService = {
  /** Send a conversational message — supports text + image content, multi-turn. */
  send: (params: ChatParams): Promise<ChatResult> =>
    window.api.chat(params),

  /** Edit an attached image and return the generated image result. */
  editImage: (params: ChatImageEditParams): Promise<ChatImageEditResult> =>
    window.api.editChatImage?.(params) ?? Promise.resolve({
      success: false,
      error: 'Image editing bridge is unavailable. Restart Viezan and try again.',
      errorCode: 'PRELOAD_OUTDATED',
    }),

  /** Stream a conversational message and receive provider tokens as they arrive. */
  stream: async (params: ChatParams, callbacks: ChatStreamCallbacks = {}): Promise<ChatResult> => {
    if (
      typeof window.api.chatStream !== 'function' ||
      typeof window.api.onChatStreamEvent !== 'function'
    ) {
      return window.api.chat(params)
    }

    const requestId = createChatStreamRequestId()
    const cleanup = window.api.onChatStreamEvent(requestId, (event: ChatStreamEvent) => {
      if (event.type === 'start') callbacks.onStart?.()
      if (event.type === 'token' && event.token) callbacks.onToken?.(event.token)
      if (event.type === 'end' && event.reply !== undefined) callbacks.onEnd?.(event.reply)
      if (event.type === 'error' && event.error) callbacks.onError?.(event.error, event.errorCode)
    })

    try {
      return await window.api.chatStream({ ...params, requestId })
    } finally {
      cleanup()
    }
  },
}
