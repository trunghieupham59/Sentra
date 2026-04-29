import { MAX_CHAT_REQUEST_CHARS } from './ipcConstants'
import { invalidIpcInput, isNonEmptyString, isRecord } from './ipcValidation'
import { isValidProvider, unknownProviderError } from './providers/types'

export type MaxOutputTokensRequest = number | 'model-max'

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
  bypassLengthCheck?: boolean
  maxOutputTokens?: MaxOutputTokensRequest
  requestId?: string
}

export type ParsedChatParams =
  | { ok: true; value: ChatParams }
  | { ok: false; response: { success: false; error: string; errorCode?: string } }

const CHAT_CONTENT_TYPES = new Set(['text', 'image'])
const CHAT_ROLES = new Set(['user', 'assistant'])
const CHAT_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_CHAT_MODEL_ID_CHARS = 200
const MAX_SYSTEM_PROMPT_CHARS = 20_000
const MAX_CHAT_REQUEST_ID_CHARS = 100

export function parseChatParams(rawParams: unknown): ParsedChatParams {
  if (!isRecord(rawParams)) {
    return { ok: false, response: invalidIpcInput('Chat payload must be an object') }
  }

  if (!isNonEmptyString(rawParams.provider)) {
    return { ok: false, response: invalidIpcInput('Provider is required') }
  }
  const provider = rawParams.provider.trim()
  if (!isValidProvider(provider)) {
    return { ok: false, response: unknownProviderError(provider) }
  }

  if (!isNonEmptyString(rawParams.model)) {
    return { ok: false, response: invalidIpcInput('Model is required') }
  }
  const model = rawParams.model.trim()
  if (model.length > MAX_CHAT_MODEL_ID_CHARS) {
    return { ok: false, response: invalidIpcInput('Model is too long') }
  }

  if (!Array.isArray(rawParams.messages)) {
    return { ok: false, response: invalidIpcInput('Messages are required') }
  }
  if (rawParams.messages.length === 0) {
    return { ok: false, response: invalidIpcInput('No messages provided') }
  }

  const messages: ChatMessage[] = []
  for (const message of rawParams.messages) {
    if (!isRecord(message) || typeof message.role !== 'string' || !CHAT_ROLES.has(message.role) || !Array.isArray(message.content)) {
      return { ok: false, response: invalidIpcInput('Invalid chat message') }
    }

    const content: ChatMessageContent[] = []
    for (const item of message.content) {
      if (!isRecord(item) || typeof item.type !== 'string' || !CHAT_CONTENT_TYPES.has(item.type)) {
        return { ok: false, response: invalidIpcInput('Invalid chat message content') }
      }

      if (item.type === 'text') {
        if (item.text !== undefined && typeof item.text !== 'string') {
          return { ok: false, response: invalidIpcInput('Invalid chat text content') }
        }
        content.push({ type: 'text', text: item.text })
      } else {
        if (!isNonEmptyString(item.imageBase64) || !isNonEmptyString(item.imageMimeType) || !CHAT_IMAGE_MIME_TYPES.has(item.imageMimeType)) {
          return { ok: false, response: invalidIpcInput('Invalid chat image content') }
        }
        content.push({ type: 'image', imageBase64: item.imageBase64, imageMimeType: item.imageMimeType })
      }
    }

    messages.push({ role: message.role as ChatMessage['role'], content })
  }

  if (rawParams.systemPrompt !== undefined && (typeof rawParams.systemPrompt !== 'string' || rawParams.systemPrompt.length > MAX_SYSTEM_PROMPT_CHARS)) {
    return { ok: false, response: invalidIpcInput('Invalid system prompt') }
  }
  if (rawParams.bypassLengthCheck !== undefined && typeof rawParams.bypassLengthCheck !== 'boolean') {
    return { ok: false, response: invalidIpcInput('Invalid bypass flag') }
  }
  if (
    rawParams.maxOutputTokens !== undefined &&
    rawParams.maxOutputTokens !== 'model-max' &&
    (typeof rawParams.maxOutputTokens !== 'number' || !Number.isFinite(rawParams.maxOutputTokens))
  ) {
    return { ok: false, response: invalidIpcInput('Invalid max output tokens') }
  }
  if (rawParams.requestId !== undefined) {
    if (!isNonEmptyString(rawParams.requestId) || rawParams.requestId.length > MAX_CHAT_REQUEST_ID_CHARS) {
      return { ok: false, response: invalidIpcInput('Invalid chat stream request id') }
    }
  }

  if (!rawParams.bypassLengthCheck) {
    const lastMsg = messages[messages.length - 1]
    if (lastMsg.role === 'user') {
      const lastMsgTextChars = lastMsg.content.reduce((sum, c) => sum + (c.text?.length ?? 0), 0)
      if (lastMsgTextChars > MAX_CHAT_REQUEST_CHARS) {
        return {
          ok: false,
          response: {
            success: false,
            error: `Message too long (${lastMsgTextChars} chars). Maximum is ${MAX_CHAT_REQUEST_CHARS} characters.`,
          },
        }
      }
    }
  }

  return {
    ok: true,
    value: {
      provider,
      model,
      messages,
      systemPrompt: rawParams.systemPrompt,
      bypassLengthCheck: rawParams.bypassLengthCheck,
      maxOutputTokens: rawParams.maxOutputTokens as MaxOutputTokensRequest | undefined,
      requestId: typeof rawParams.requestId === 'string' ? rawParams.requestId.trim() : undefined,
    },
  }
}
