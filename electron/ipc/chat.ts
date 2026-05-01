import type { ImageBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources/messages'
import type { Content, Part } from '@google/generative-ai'
import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import type { ChatCompletionContentPartImage, ChatCompletionContentPartText, ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { type ChatMessage, type MaxOutputTokensRequest, parseChatParams } from './chatValidation'
import { classifyProviderError, noApiKeyResponse } from './errorUtils'
import {
  CHAT_IMAGE_EDIT_TIMEOUT_MS,
  GEMINI_API_BASE,
  GEMINI_IMAGE_EDIT_MODELS,
  MAX_CHAT_OUTPUT_TOKENS,
  MAX_CHAT_REQUEST_CHARS,
  OPENAI_IMAGE_EDIT_MODEL,
} from './ipcConstants'
import { invalidIpcInput, isNonEmptyString, isRecord } from './ipcValidation'
import { isLocalProvider, LOCAL_AI_PLACEHOLDER_KEY, resolveLocalAiRequestModel } from './localAi'
import { isValidProvider, unknownProviderError } from './providers/types'
import { withRetry } from './retry'
import { getStoredApiKey } from './storage'

// DUP-02: Removed local `getApiKey` wrapper — call getStoredApiKey directly.

const FALLBACK_MODEL_MAX_OUTPUT_TOKENS = 16_384
const CHAT_STREAM_EVENT = 'chat:stream:event'
const CHAT_IMAGE_EDIT_SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_CHAT_IMAGE_EDIT_MODEL_ID_CHARS = 200

const geminiOutputLimitCache = new Map<string, number>()

interface ChatImageEditParams {
  provider: string
  model: string
  prompt: string
  imageBase64: string
  imageMimeType: string
}

type ParsedChatImageEditParams =
  | { ok: true; value: ChatImageEditParams }
  | { ok: false; response: { success: false; error: string; errorCode?: string } }

type ChatStreamEvent =
  { requestId: string } & ChatStreamEventPayload

type ChatStreamEventPayload =
  | { type: 'start' }
  | { type: 'token'; token: string }
  | { type: 'end'; reply: string }
  | { type: 'error'; error: string; errorCode?: string }

type ChatStreamTokenHandler = (token: string) => void

function getCurrentFamilyModelMaxOutputTokens(provider: string, model: string): number {
  const id = model.toLowerCase()

  if (provider === 'openai') {
    if (id.includes('chat-latest')) return 16_384
    if (id.startsWith('gpt-5')) return 128_000
    if (id.startsWith('gpt-4.1')) return 32_768
    if (id.startsWith('gpt-4o') || id.startsWith('chatgpt-4o')) return 16_384
  }

  if (provider === 'claude') {
    if (id.startsWith('claude-sonnet-4')) return 64_000
    if (id.startsWith('claude-opus-4')) return 32_000
  }

  if (provider === 'gemini') {
    if (id.includes('2.5')) return 65_536
  }

  return FALLBACK_MODEL_MAX_OUTPUT_TOKENS
}

async function fetchGeminiModelMaxOutputTokens(apiKey: string, model: string): Promise<number | null> {
  const cached = geminiOutputLimitCache.get(model)
  if (cached) return cached

  try {
    const modelName = model.startsWith('models/') ? model : `models/${model}`
    const response = await fetch(`${GEMINI_API_BASE}/${modelName}?key=${apiKey}`)
    if (!response.ok) return null
    const data = await response.json() as { outputTokenLimit?: number }
    if (typeof data.outputTokenLimit === 'number' && data.outputTokenLimit > 0) {
      geminiOutputLimitCache.set(model, data.outputTokenLimit)
      return data.outputTokenLimit
    }
  } catch (err) {
    console.warn('[chat] Failed to fetch Gemini model output limit:', err)
  }

  return null
}

async function resolveModelMaxOutputTokens(provider: string, model: string, apiKey: string): Promise<number> {
  if (provider === 'gemini') {
    return await fetchGeminiModelMaxOutputTokens(apiKey, model)
      ?? getCurrentFamilyModelMaxOutputTokens(provider, model)
  }
  return getCurrentFamilyModelMaxOutputTokens(provider, model)
}

async function resolveChatOutputTokens(
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

/** Wrap user system prompt to enforce strict compliance */
function buildEnforcedSystemPrompt(userPrompt: string): string {
  if (!userPrompt.trim()) {
    return 'You are a helpful AI assistant. Be concise, friendly, and accurate.'
  }
  return `${userPrompt.trim()}

IMPORTANT: You MUST strictly follow the instructions above in every response. Do not deviate, explain or refuse these instructions. Apply them to all messages unconditionally.`
}

function parseChatImageEditParams(rawParams: unknown): ParsedChatImageEditParams {
  if (!isRecord(rawParams)) {
    return { ok: false, response: invalidIpcInput('Chat image edit payload must be an object') }
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
  if (model.length > MAX_CHAT_IMAGE_EDIT_MODEL_ID_CHARS) {
    return { ok: false, response: invalidIpcInput('Model is too long') }
  }

  if (!isNonEmptyString(rawParams.prompt)) {
    return { ok: false, response: invalidIpcInput('Image edit prompt is required') }
  }
  const prompt = rawParams.prompt.trim()
  if (prompt.length > MAX_CHAT_REQUEST_CHARS) {
    return {
      ok: false,
      response: invalidIpcInput(`Image edit prompt is too long. Maximum is ${MAX_CHAT_REQUEST_CHARS} characters.`),
    }
  }

  if (!isNonEmptyString(rawParams.imageBase64)) {
    return { ok: false, response: invalidIpcInput('No image data provided') }
  }
  if (
    !isNonEmptyString(rawParams.imageMimeType) ||
    !CHAT_IMAGE_EDIT_SUPPORTED_MIME_TYPES.has(rawParams.imageMimeType)
  ) {
    return { ok: false, response: invalidIpcInput('Unsupported image MIME type') }
  }

  return {
    ok: true,
    value: {
      provider,
      model,
      prompt,
      imageBase64: rawParams.imageBase64,
      imageMimeType: rawParams.imageMimeType,
    },
  }
}

function buildChatImageEditPrompt(prompt: string): string {
  return `Edit the attached image according to this user request:
${prompt.trim()}

Return the edited image as the primary result. Preserve the subject identity, image quality, framing, lighting, and natural details unless the user explicitly asks to change them.`
}

function buildGeminiChatPayload(messages: ChatMessage[]) {
  const history: Content[] = messages.slice(0, -1).map((msg) => {
    const parts: Part[] = []
    for (const c of msg.content) {
      if (c.type === 'text' && c.text) {
        parts.push({ text: c.text })
      } else if (c.type === 'image' && c.imageBase64 && c.imageMimeType) {
        parts.push({ inlineData: { data: c.imageBase64, mimeType: c.imageMimeType } })
      }
    }
    return { role: msg.role === 'user' ? 'user' : 'model', parts }
  })

  const lastMsg = messages[messages.length - 1]
  const parts: Array<string | Part> = []
  for (const c of lastMsg.content) {
    if (c.type === 'text' && c.text) {
      parts.push(c.text)
    } else if (c.type === 'image' && c.imageBase64 && c.imageMimeType) {
      parts.push({ inlineData: { data: c.imageBase64, mimeType: c.imageMimeType } })
    }
  }

  return { history, parts }
}

async function chatWithGemini(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt?: string,
  maxOutputTokens = MAX_CHAT_OUTPUT_TOKENS,
): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const genModel = genAI.getGenerativeModel({
    model,
    systemInstruction: buildEnforcedSystemPrompt(systemPrompt || ''),
    generationConfig: { maxOutputTokens },
  })

  const { history, parts } = buildGeminiChatPayload(messages)

  const chat = genModel.startChat({ history })
  const result = await chat.sendMessage(parts)
  const text = result.response.text().trim()
  if (!text) {
    const finishReason = result.response.candidates?.[0]?.finishReason
    throw new Error(
      `Gemini returned an empty response${finishReason ? ` (finishReason=${finishReason})` : ''}.`
    )
  }
  return text
}

async function streamChatWithGemini(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt: string | undefined,
  maxOutputTokens: number,
  onToken: ChatStreamTokenHandler,
): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const genModel = genAI.getGenerativeModel({
    model,
    systemInstruction: buildEnforcedSystemPrompt(systemPrompt || ''),
    generationConfig: { maxOutputTokens },
  })
  const { history, parts } = buildGeminiChatPayload(messages)
  const chat = genModel.startChat({ history })
  const result = await chat.sendMessageStream(parts)
  let fullText = ''

  for await (const chunk of result.stream) {
    const token = chunk.text()
    if (token) {
      fullText += token
      onToken(token)
    }
  }

  const text = fullText.trim()
  if (!text) throw new Error('Gemini returned an empty response.')
  return text
}

function formatClaudeMessages(messages: ChatMessage[]) {
  return messages.map((msg) => {
    const content: Array<TextBlockParam | ImageBlockParam> = []
    for (const c of msg.content) {
      if (c.type === 'text' && c.text) {
        content.push({ type: 'text', text: c.text })
      } else if (c.type === 'image' && c.imageBase64 && c.imageMimeType) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: c.imageMimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: c.imageBase64,
          },
        })
      }
    }
    return { role: msg.role, content }
  })
}

async function chatWithClaude(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt?: string,
  maxOutputTokens = MAX_CHAT_OUTPUT_TOKENS,
): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })

  const formattedMessages = formatClaudeMessages(messages)

  const message = await client.messages.create({
    model,
    max_tokens: maxOutputTokens,  // HC-02
    system: buildEnforcedSystemPrompt(systemPrompt || ''),
    messages: formattedMessages,
  })

  const block = message.content[0]
  if (block.type === 'text') {
    const text = block.text.trim()
    if (!text) {
      throw new Error(`Claude returned an empty response (stop_reason=${message.stop_reason ?? 'unknown'}).`)
    }
    return text
  }
  throw new Error('Unexpected response type from Claude')
}

async function streamChatWithClaude(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt: string | undefined,
  maxOutputTokens: number,
  onToken: ChatStreamTokenHandler,
): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  let fullText = ''
  const stream = client.messages.stream({
    model,
    max_tokens: maxOutputTokens,
    system: buildEnforcedSystemPrompt(systemPrompt || ''),
    messages: formatClaudeMessages(messages),
  })

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      const token = event.delta.text
      if (token) {
        fullText += token
        onToken(token)
      }
    }
  }

  const text = fullText.trim()
  if (!text) throw new Error('Claude returned an empty response.')
  return text
}

// ── Exported for unit testing ─────────────────────────────────────────────────

/** @internal — exported for unit tests only */
export {
  buildEnforcedSystemPrompt,
  getCurrentFamilyModelMaxOutputTokens,
  isLikelyChatModel,
  resolveModelMaxOutputTokens,
  scoreOpenAIChatModel,
}

// ─────────────────────────────────────────────────────────────────────────────

/** Patterns for models that do NOT support v1/chat/completions */
const NON_CHAT_PATTERNS = [
  /instruct/i, /^babbage/i, /^davinci/i, /^curie/i, /^ada/i,
  /text-davinci/i, /code-davinci/i,
  // Search / web-search models use different endpoint parameters
  /search/i,
  // Image generation
  /image/i,
  // Codex
  /codex/i,
]

function isLikelyChatModel(id: string): boolean {
  return !NON_CHAT_PATTERNS.some((p) => p.test(id))
}

/**
 * Score OpenAI chat model for fallback selection.
 * Strategy: parse major.minor version number for primary sort,
 * use variant qualifiers (mini, nano) for secondary sort.
 * Higher score = prefer for fallback.
 */
function scoreOpenAIChatModel(id: string): number {
  const lower = id.toLowerCase()

  // Hard exclude non-chat models
  if (!isLikelyChatModel(lower)) return -9999

  let score = 0

  // Extract version number: gpt-X.Y or gpt-X
  // e.g. gpt-5.4 -> major=5, minor=4 -> 54
  // e.g. gpt-4o  -> treat as 4.0 -> 40
  const versionMatch = lower.match(/gpt-(\d+)(?:\.(\d+))?/)
  if (versionMatch) {
    const major = parseInt(versionMatch[1], 10)
    const minor = parseInt(versionMatch[2] ?? '0', 10)
    // Major version dominates: gpt-5 >> gpt-4
    score += major * 1000 + minor * 10
  }

  // Prefer full model over nano/mini variants (full = higher capability)
  // But mini is still better than nothing
  if (lower.includes('nano')) score -= 5
  else if (lower.includes('mini')) score -= 2
  // 'o' suffix (e.g. gpt-4o) is the optimised variant — slight bonus
  if (lower.match(/gpt-\d+o\b/)) score += 1

  // Prefer models with a date (more recent release)
  const dateMatch = lower.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (dateMatch) {
    const dateNum = parseInt(dateMatch[1] + dateMatch[2] + dateMatch[3], 10)
    score += Math.min(dateNum - 20230101, 9999) / 10000 // small tiebreaker
  }

  return score
}

/**
 * Fetch the best chat-capable OpenAI model from the API.
 * Falls back to 'gpt-4o' only if the API call itself fails.
 */
async function fetchBestOpenAIChatModel(apiKey: string): Promise<string> {
  try {
    const OpenAI = (await import('openai')).default
    const client = new OpenAI({ apiKey })
    const response = await client.models.list()

    // Hard excludes beyond what isLikelyChatModel checks
    const hardExcluded = [
      'embedding', 'tts', 'whisper', 'dall-e', 'moderation',
      'text-search', 'text-similarity', 'code-search', 'realtime', 'audio', 'transcribe',
    ]

    const chatModels = response.data
      .filter((m) => {
        const id = m.id.toLowerCase()
        return (
          id.startsWith('gpt-') &&
          isLikelyChatModel(id) &&
          !hardExcluded.some((e) => id.includes(e))
        )
      })
      .sort((a, b) => scoreOpenAIChatModel(b.id) - scoreOpenAIChatModel(a.id))

    if (chatModels.length > 0) {
      console.log(`[chat] Fallback to best chat model: ${chatModels[0].id}`)
      return chatModels[0].id
    }
  } catch (e) {
    console.warn('[chat] Failed to fetch models for fallback:', e)
  }
  // Hard fallback — only reached when models API itself fails
  return 'gpt-4o'
}

function formatOpenAIChatMessages(messages: ChatMessage[], systemPrompt?: string): ChatCompletionMessageParam[] {
  const formattedMessages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: buildEnforcedSystemPrompt(systemPrompt || ''),
    },
  ]

  for (const msg of messages) {
    const content: Array<ChatCompletionContentPartText | ChatCompletionContentPartImage> = []
    for (const c of msg.content) {
      if (c.type === 'text' && c.text) {
        content.push({ type: 'text', text: c.text })
      } else if (c.type === 'image' && c.imageBase64 && c.imageMimeType) {
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${c.imageMimeType};base64,${c.imageBase64}`,
            detail: 'high',
          },
        })
      }
    }
    // If only one text content, send as string for better compatibility
    if (content.length === 1 && content[0].type === 'text') {
      formattedMessages.push({ role: msg.role, content: content[0].text })
    } else {
      // Cast required: SDK types split user/assistant content arrays into separate
      // discriminated variants; at runtime only user messages carry image parts.
      formattedMessages.push({ role: msg.role, content } as ChatCompletionMessageParam)
    }
  }
  return formattedMessages
}

function isOpenAIChatEndpointError(error: unknown) {
  const errMsg = error instanceof Error ? error.message : String(error)
  return (
    errMsg.includes('not a chat model') ||
    errMsg.includes('v1/completions') ||
    (errMsg.includes('404') && errMsg.includes('completions'))
  )
}

async function chatWithOpenAI(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt?: string,
  maxOutputTokens = MAX_CHAT_OUTPUT_TOKENS,
): Promise<string> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })
  const formattedMessages = formatOpenAIChatMessages(messages, systemPrompt)

  const tryChat = async (m: string) => {
    const completion = await client.chat.completions.create({
      model: m,
      messages: formattedMessages,
      max_completion_tokens: maxOutputTokens,  // HC-02
    })
    const choice = completion.choices[0]
    const text = (choice?.message?.content ?? '').trim()
    if (!text) {
      const finishReason = choice?.finish_reason ?? 'unknown'
      const refusal = choice?.message && 'refusal' in choice.message
        ? choice.message.refusal
        : undefined
      throw new Error(
        `OpenAI returned an empty response (finish_reason=${finishReason}${refusal ? `, refusal=${refusal}` : ''}).`
      )
    }
    return text
  }

  try {
    return await tryChat(model)
  } catch (err: unknown) {
    if (isOpenAIChatEndpointError(err)) {
      // Fetch the best actual chat-capable model from the API
      const bestModel = await fetchBestOpenAIChatModel(apiKey)
      if (bestModel !== model) {
        return await tryChat(bestModel)
      }
    }
    throw err
  }
}

async function chatWithLocal(
  _apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt?: string,
  maxOutputTokens = MAX_CHAT_OUTPUT_TOKENS,
): Promise<string> {
  const OpenAI = (await import('openai')).default
  const local = await resolveLocalAiRequestModel(model)
  const client = new OpenAI({ apiKey: LOCAL_AI_PLACEHOLDER_KEY, baseURL: local.baseURL })
  const completion = await client.chat.completions.create({
    model: local.model,
    messages: formatOpenAIChatMessages(messages, systemPrompt),
    max_tokens: maxOutputTokens,
  })
  const choice = completion.choices[0]
  const text = (choice?.message?.content ?? '').trim()
  if (!text) throw new Error(`Local AI returned an empty response (finish_reason=${choice?.finish_reason ?? 'unknown'}).`)
  return text
}

async function streamChatWithOpenAI(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt: string | undefined,
  maxOutputTokens: number,
  onToken: ChatStreamTokenHandler,
): Promise<string> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })
  const formattedMessages = formatOpenAIChatMessages(messages, systemPrompt)
  let emittedToken = false

  const tryChat = async (m: string) => {
    let fullText = ''
    const stream = await client.chat.completions.create({
      model: m,
      messages: formattedMessages,
      stream: true,
      max_completion_tokens: maxOutputTokens,
    })

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? ''
      if (token) {
        emittedToken = true
        fullText += token
        onToken(token)
      }
    }

    const text = fullText.trim()
    if (!text) throw new Error('OpenAI returned an empty response.')
    return text
  }

  try {
    return await tryChat(model)
  } catch (err: unknown) {
    if (!emittedToken && isOpenAIChatEndpointError(err)) {
      const bestModel = await fetchBestOpenAIChatModel(apiKey)
      if (bestModel !== model) return await tryChat(bestModel)
    }
    throw err
  }
}

async function streamChatWithLocal(
  _apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt: string | undefined,
  maxOutputTokens: number,
  onToken: ChatStreamTokenHandler,
): Promise<string> {
  const OpenAI = (await import('openai')).default
  const local = await resolveLocalAiRequestModel(model)
  const client = new OpenAI({ apiKey: LOCAL_AI_PLACEHOLDER_KEY, baseURL: local.baseURL })
  let fullText = ''
  const stream = await client.chat.completions.create({
    model: local.model,
    messages: formatOpenAIChatMessages(messages, systemPrompt),
    stream: true,
    max_tokens: maxOutputTokens,
  })

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? ''
    if (token) {
      fullText += token
      onToken(token)
    }
  }

  const text = fullText.trim()
  if (!text) throw new Error('Local AI returned an empty response.')
  return text
}

type ChatImageEditResultPayload = {
  imageBase64: string
  imageMimeType: string
  usedModel: string
}

function getImageFileNameForMime(mimeType: string): string {
  const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType.replace('image/', '')
  return `chat-image-edit.${ext}`
}

async function convertRemoteImageUrlToBase64(url: string): Promise<{ imageBase64: string; imageMimeType: string }> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`OpenAI image edit returned a URL, but downloading it failed (${response.status}).`)
  }

  const contentType = response.headers.get('content-type') ?? 'image/png'
  const imageMimeType = contentType.split(';')[0] || 'image/png'
  const buffer = Buffer.from(await response.arrayBuffer())
  return { imageBase64: buffer.toString('base64'), imageMimeType }
}

async function editChatImageWithOpenAI(
  apiKey: string,
  _model: string,
  prompt: string,
  imageBase64: string,
  imageMimeType: string,
): Promise<ChatImageEditResultPayload> {
  const openaiModule = await import('openai')
  const OpenAI = openaiModule.default
  const client = new OpenAI({ apiKey, timeout: CHAT_IMAGE_EDIT_TIMEOUT_MS })
  const image = await openaiModule.toFile(
    Buffer.from(imageBase64, 'base64'),
    getImageFileNameForMime(imageMimeType),
    { type: imageMimeType },
  )

  const response = await client.images.edit({
    model: OPENAI_IMAGE_EDIT_MODEL,
    image,
    prompt: buildChatImageEditPrompt(prompt),
    n: 1,
    size: 'auto',
    quality: 'auto',
  })
  const result = response.data?.[0]

  if (result?.b64_json) {
    return {
      imageBase64: result.b64_json,
      imageMimeType: 'image/png',
      usedModel: OPENAI_IMAGE_EDIT_MODEL,
    }
  }

  if (result?.url) {
    const downloaded = await convertRemoteImageUrlToBase64(result.url)
    return { ...downloaded, usedModel: OPENAI_IMAGE_EDIT_MODEL }
  }

  throw new Error('OpenAI image edit did not return an image.')
}

type GeminiInlineDataPart = {
  text?: string
  inline_data?: { mime_type?: string; data?: string }
  inlineData?: { mimeType?: string; data?: string }
}

function shouldTryNextGeminiImageModel(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return (
    msg.includes('404') ||
    msg.includes('not found') ||
    msg.includes('not supported') ||
    msg.includes('not available') ||
    msg.includes('unsupported model')
  )
}

async function requestGeminiImageEdit(
  apiKey: string,
  imageModel: string,
  prompt: string,
  imageBase64: string,
  imageMimeType: string,
): Promise<ChatImageEditResultPayload> {
  const url = `${GEMINI_API_BASE}/models/${imageModel}:generateContent`
  const body = {
    contents: [
      {
        parts: [
          { text: buildChatImageEditPrompt(prompt) },
          {
            inline_data: {
              mime_type: imageMimeType,
              data: imageBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CHAT_IMAGE_EDIT_TIMEOUT_MS)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timer))

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini image edit failed: ${response.status} ${errorText}`)
  }

  const json = await response.json() as {
    candidates?: Array<{ content?: { parts?: GeminiInlineDataPart[] } }>
  }
  const parts = json.candidates?.[0]?.content?.parts ?? []

  for (const part of parts) {
    const inlineData = part.inline_data ?? part.inlineData
    if (inlineData?.data) {
      const outputInlineData = inlineData as { mime_type?: string; mimeType?: string; data: string }
      const outputMimeType = outputInlineData.mime_type ?? outputInlineData.mimeType
      return {
        imageBase64: outputInlineData.data,
        imageMimeType: outputMimeType ?? 'image/png',
        usedModel: imageModel,
      }
    }
  }

  const text = parts.map((part) => part.text).filter(Boolean).join('\n').trim()
  throw new Error(text ? `Gemini returned text but no edited image: ${text}` : 'Gemini image edit did not return an image.')
}

async function editChatImageWithGemini(
  apiKey: string,
  _model: string,
  prompt: string,
  imageBase64: string,
  imageMimeType: string,
): Promise<ChatImageEditResultPayload> {
  let lastError: unknown

  for (const imageModel of GEMINI_IMAGE_EDIT_MODELS) {
    try {
      return await requestGeminiImageEdit(apiKey, imageModel, prompt, imageBase64, imageMimeType)
    } catch (error) {
      lastError = error
      if (!shouldTryNextGeminiImageModel(error)) break
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

// ── Provider registry — DUP-04 / DUP-06 ──────────────────────────────────────
// Registry eliminates the switch/case dispatch block and makes the provider
// contract explicit. Per-provider functions remain separate (each SDK is different).

type ChatFn = (
  apiKey: string, model: string, messages: ChatMessage[], systemPrompt?: string, maxOutputTokens?: number
) => Promise<string>

type ChatStreamFn = (
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt: string | undefined,
  maxOutputTokens: number,
  onToken: ChatStreamTokenHandler,
) => Promise<string>

type ChatImageEditFn = (
  apiKey: string,
  model: string,
  prompt: string,
  imageBase64: string,
  imageMimeType: string,
) => Promise<ChatImageEditResultPayload>

const CHAT_PROVIDERS: Record<string, ChatFn> = {
  gemini: chatWithGemini,
  claude: chatWithClaude,
  openai: chatWithOpenAI,
  local: chatWithLocal,
}

const CHAT_STREAM_PROVIDERS: Record<string, ChatStreamFn> = {
  gemini: streamChatWithGemini,
  claude: streamChatWithClaude,
  openai: streamChatWithOpenAI,
  local: streamChatWithLocal,
}

const CHAT_IMAGE_EDIT_PROVIDERS: Record<string, ChatImageEditFn> = {
  gemini: editChatImageWithGemini,
  openai: editChatImageWithOpenAI,
}

function getProviderCredential(provider: string) {
  return isLocalProvider(provider) ? LOCAL_AI_PLACEHOLDER_KEY : getStoredApiKey(provider)
}

function toChatFailure(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error)
  const classified = classifyProviderError(msg)
  return { ...classified, error: classified.errorCode ? classified.error : `Chat failed: ${msg}` }
}

function sendChatStreamEvent(event: IpcMainInvokeEvent, payload: ChatStreamEvent) {
  event.sender.send(CHAT_STREAM_EVENT, payload)
}

/**
 * Register all chat-related IPC handlers with the Electron main process.
 *
 * Handlers registered:
 *  - `chat:send` — Send a conversational message (with optional image attachments
 *                  and system prompt); returns `{ success, reply?, error?, errorCode? }`
 *  - `chat:image-edit` — Edit an attached image and return a base64 image payload.
 *
 * All handlers:
 *  - Read the API key from the OS Keychain via `getStoredApiKey` (never from renderer).
 *  - Validate inputs before calling the AI provider.
 *  - Categorize errors into typed `errorCode` values (NO_API_KEY, INVALID_KEY, RATE_LIMIT, NETWORK).
 *  - Support multi-modal messages (text + images) for Gemini, Claude, and OpenAI.
 *  - Automatically fall back to the best available chat-capable model when the
 *    requested OpenAI model is not a chat model (e.g. completions-only models).
 *
 * @param ipcMain - Electron's IpcMain instance (passed from main.ts at startup).
 */
export function registerChatHandlers(ipcMain: IpcMain) {
  ipcMain.handle('chat:send', async (_event, rawParams: unknown) => {
    const parsed = parseChatParams(rawParams)
    if (!parsed.ok) return parsed.response
    const params = parsed.value
    const { provider, model, messages, systemPrompt } = params

    // DUP-02 + DUP-03
    const apiKey = getProviderCredential(provider)
    if (!apiKey) return noApiKeyResponse(provider)
    const maxOutputTokens = await resolveChatOutputTokens(provider, model, apiKey, params.maxOutputTokens)

    try {
      let reply = ''

      // DUP-06: registry lookup replaces switch/case — unknownProviderError() provides a typed
      // response with a helpful hint listing supported providers.
      const chatFn = CHAT_PROVIDERS[provider]
      if (!chatFn) return unknownProviderError(provider)
      // withRetry wraps the chat call with exponential backoff for transient network errors.
      // Hard failures (auth, rate limit) are not retried — they propagate immediately.
      reply = await withRetry(() => chatFn(apiKey, model, messages, systemPrompt, maxOutputTokens))

      return { success: true, reply }
    } catch (error: unknown) {
      console.error(`Chat error with ${provider}:`, error)
      return toChatFailure(error)
    }
  })

  ipcMain.handle('chat:image-edit', async (_event, rawParams: unknown) => {
    const parsed = parseChatImageEditParams(rawParams)
    if (!parsed.ok) return parsed.response
    const { provider, model, prompt, imageBase64, imageMimeType } = parsed.value

    const editFn = CHAT_IMAGE_EDIT_PROVIDERS[provider]
    if (!editFn) {
      return {
        success: false,
        error: 'Image editing is currently available with Gemini or OpenAI. Switch provider to edit images directly.',
        errorCode: 'NO_IMAGE_EDIT',
      }
    }

    const apiKey = getProviderCredential(provider)
    if (!apiKey) return noApiKeyResponse(provider)

    try {
      const result = await withRetry(() => editFn(apiKey, model, prompt, imageBase64, imageMimeType))
      return {
        success: true,
        imageBase64: result.imageBase64,
        imageMimeType: result.imageMimeType,
        usedProvider: provider,
        usedModel: result.usedModel,
      }
    } catch (error: unknown) {
      console.error(`Chat image edit error with ${provider}:`, error)
      return toChatFailure(error)
    }
  })

  ipcMain.handle('chat:stream', async (event, rawParams: unknown) => {
    const parsed = parseChatParams(rawParams)
    if (!parsed.ok) return parsed.response
    const params = parsed.value
    const { provider, model, messages, systemPrompt, requestId } = params
    if (!requestId) return { success: false, error: 'Chat stream requestId is required', errorCode: 'INVALID_INPUT' }

    const emit = (payload: ChatStreamEventPayload) => {
      sendChatStreamEvent(event, { requestId, ...payload })
    }

    emit({ type: 'start' })

    const apiKey = getProviderCredential(provider)
    if (!apiKey) {
      const response = noApiKeyResponse(provider)
      emit({ type: 'error', error: response.error, errorCode: response.errorCode })
      return response
    }
    const maxOutputTokens = await resolveChatOutputTokens(provider, model, apiKey, params.maxOutputTokens)

    try {
      const chatFn = CHAT_STREAM_PROVIDERS[provider]
      if (!chatFn) {
        const response = unknownProviderError(provider)
        emit({ type: 'error', error: response.error })
        return response
      }

      const reply = await chatFn(apiKey, model, messages, systemPrompt, maxOutputTokens, (token) => {
        emit({ type: 'token', token })
      })

      emit({ type: 'end', reply })
      return { success: true, reply }
    } catch (error: unknown) {
      console.error(`Chat stream error with ${provider}:`, error)
      const response = toChatFailure(error)
      emit({ type: 'error', error: response.error, errorCode: response.errorCode })
      return response
    }
  })
}
