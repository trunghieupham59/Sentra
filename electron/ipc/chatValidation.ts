import { MAX_CHAT_PAYLOAD_BYTES, MAX_CHAT_REQUEST_CHARS } from './ipcConstants'
import { invalidIpcInput, isNonEmptyString, isRecord, parseProviderModel } from './ipcValidation'


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
  /**
   * When true, the system prompt is augmented with the "REASONING DISCIPLINE"
   * directive (see `chatPrompts.ts`) so the model restates assumptions and
   * walks through math step-by-step before answering. Used for finance/tax/
   * quantitative questions where silent miscalculation is the failure mode.
   */
  carefulReasoning?: boolean
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

/**
 * Cheaply estimate the IPC payload size by counting the base64 and text
 * lengths inside `messages`. We deliberately avoid `JSON.stringify` on the
 * raw payload because for very large requests (50+ MB) the stringify itself
 * costs hundreds of milliseconds; the per-field length sum is within ~5%
 * of the JSON byte count and is sufficient for cap enforcement.
 */
function estimateChatPayloadBytes(rawParams: Record<string, unknown>): number {
  let bytes = 0
  if (typeof rawParams.systemPrompt === 'string') bytes += rawParams.systemPrompt.length
  const messages = rawParams.messages
  if (Array.isArray(messages)) {
    for (const m of messages) {
      if (!isRecord(m) || !Array.isArray(m.content)) continue
      for (const c of m.content) {
        if (!isRecord(c)) continue
        if (typeof c.text === 'string') bytes += c.text.length
        if (typeof c.imageBase64 === 'string') bytes += c.imageBase64.length
      }
    }
  }
  return bytes
}

export function parseChatParams(rawParams: unknown): ParsedChatParams {
  const providerModel = parseProviderModel(rawParams, {
    payloadName: 'Chat',
    maxModelChars: MAX_CHAT_MODEL_ID_CHARS,
  })
  if (!providerModel.ok) return providerModel
  const { provider, model } = providerModel.value
  const params = providerModel.params

  // Cap total payload size — protects RAM from runaway image+history payloads.
  // The renderer should never reach this in normal use (image resize caps at
  // ~1.5 MB), so a violation indicates either a bug or a hostile caller.
  const payloadBytes = estimateChatPayloadBytes(params)
  if (payloadBytes > MAX_CHAT_PAYLOAD_BYTES) {
    const mb = (payloadBytes / (1024 * 1024)).toFixed(1)
    const limitMb = (MAX_CHAT_PAYLOAD_BYTES / (1024 * 1024)).toFixed(0)
    return {
      ok: false,
      response: {
        success: false,
        error: `Chat payload too large (${mb} MB). Maximum is ${limitMb} MB. Try removing an image attachment.`,
        errorCode: 'PAYLOAD_TOO_LARGE',
      },
    }
  }


  if (!Array.isArray(params.messages)) {
    return { ok: false, response: invalidIpcInput('Messages are required') }
  }
  if (params.messages.length === 0) {
    return { ok: false, response: invalidIpcInput('No messages provided') }
  }

  const messages: ChatMessage[] = []
  for (const message of params.messages) {
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

  if (params.systemPrompt !== undefined && (typeof params.systemPrompt !== 'string' || params.systemPrompt.length > MAX_SYSTEM_PROMPT_CHARS)) {
    return { ok: false, response: invalidIpcInput('Invalid system prompt') }
  }
  if (params.bypassLengthCheck !== undefined && typeof params.bypassLengthCheck !== 'boolean') {
    return { ok: false, response: invalidIpcInput('Invalid bypass flag') }
  }
  if (params.carefulReasoning !== undefined && typeof params.carefulReasoning !== 'boolean') {
    return { ok: false, response: invalidIpcInput('Invalid careful-reasoning flag') }
  }

  if (
    params.maxOutputTokens !== undefined &&
    params.maxOutputTokens !== 'model-max' &&
    (typeof params.maxOutputTokens !== 'number' || !Number.isFinite(params.maxOutputTokens))
  ) {
    return { ok: false, response: invalidIpcInput('Invalid max output tokens') }
  }
  if (params.requestId !== undefined) {
    if (!isNonEmptyString(params.requestId) || params.requestId.length > MAX_CHAT_REQUEST_ID_CHARS) {
      return { ok: false, response: invalidIpcInput('Invalid chat stream request id') }
    }
  }

  if (!params.bypassLengthCheck) {
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
      systemPrompt: params.systemPrompt,
      bypassLengthCheck: params.bypassLengthCheck,
      maxOutputTokens: params.maxOutputTokens as MaxOutputTokensRequest | undefined,
      requestId: typeof params.requestId === 'string' ? params.requestId.trim() : undefined,
      carefulReasoning: params.carefulReasoning as boolean | undefined,
    },
  }
}

