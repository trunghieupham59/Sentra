/**
 * Chat & image-translate preload API — multi-turn AI chat and image OCR+translation.
 */
import { ipcRenderer } from 'electron'

type ChatStreamEvent = {
  requestId: string
  type: 'start' | 'token' | 'end' | 'error'
  token?: string
  reply?: string
  error?: string
  errorCode?: string
}

type ChatParams = {
  provider: string
  model: string
  messages: Array<{
    role: 'user' | 'assistant'
    content: Array<{
      type: 'text' | 'image'
      text?: string
      imageBase64?: string
      imageMimeType?: string
    }>
  }>
  systemPrompt?: string
  /** Bypass the char limit — only set true for AI Summarize on long transcripts */
  bypassLengthCheck?: boolean
  /** Optional larger output budget for long-form synthesis calls */
  maxOutputTokens?: number | 'model-max'
}

export const chatSection = {
  // Image translation — extracts text regions from image and returns translated regions
  translateImage: (params: {
    provider: string
    model: string
    imageBase64: string
    imageMimeType: string
    sourceLang: string
    targetLang: string
  }) => ipcRenderer.invoke('image:translate', params),

  /**
   * Subscribe to model/provider switch events pushed during image translation fallback.
   * Fired immediately when the system decides to try a different model, before translation completes.
   * Returns a cleanup function — call it to unsubscribe.
   */
  onImageModelSwitched: (cb: (data: { model: string; provider: string }) => void) => {
    const handler = (_: unknown, data: { model: string; provider: string }) => cb(data)
    ipcRenderer.on('image:model-switched', handler)
    return () => ipcRenderer.removeListener('image:model-switched', handler)
  },

  // AI Chat — supports text + image messages, multi-turn conversation
  chat: (params: ChatParams) => ipcRenderer.invoke('chat:send', params),

  chatStream: (params: ChatParams & { requestId: string }) =>
    ipcRenderer.invoke('chat:stream', params),

  onChatStreamEvent: (requestId: string, cb: (event: ChatStreamEvent) => void) => {
    const handler = (_: unknown, event: ChatStreamEvent) => {
      if (event?.requestId === requestId) cb(event)
    }
    ipcRenderer.on('chat:stream:event', handler)
    return () => ipcRenderer.removeListener('chat:stream:event', handler)
  },
}
