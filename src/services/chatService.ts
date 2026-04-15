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
import type { ChatResult } from '../types'

export interface ChatMessageContent {
  type: 'text' | 'image'
  text?: string
  imageBase64?: string
  imageMimeType?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: ChatMessageContent[]
}

export interface ChatParams {
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
