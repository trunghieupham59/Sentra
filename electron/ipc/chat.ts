import type { ImageBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources/messages'
import type { Content, Part } from '@google/generative-ai'
import type { IpcMain } from 'electron'
import type { ChatCompletionContentPartImage, ChatCompletionContentPartText, ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { classifyProviderError, noApiKeyResponse } from './errorUtils'
import { GEMINI_API_BASE, MAX_CHAT_OUTPUT_TOKENS, MAX_CHAT_REQUEST_CHARS } from './ipcConstants'
import { invalidIpcInput, isNonEmptyString, isRecord } from './ipcValidation'
import { isValidProvider, unknownProviderError } from './providers/types'
import { withRetry } from './retry'
import { getStoredApiKey } from './storage'

// DUP-02: Removed local `getApiKey` wrapper — call getStoredApiKey directly.

type MaxOutputTokensRequest = number | 'model-max'

const FALLBACK_MODEL_MAX_OUTPUT_TOKENS = 16_384

const geminiOutputLimitCache = new Map<string, number>()

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

/**
 * DUP-07: This interface is intentionally kept here (not imported from src/types/index.ts)
 * because tsconfig.electron.json only includes ["electron"] — the main process build
 * cannot import from src/. The src/types/index.ts version is the canonical definition
 * (with extra renderer-only fields: imagePreviewUrl, imageFileName) while this version
 * contains only the IPC-relevant fields that need to be transmitted to the main process.
 */
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

interface ChatParams {
  provider: string
  model: string
  messages: ChatMessage[]
  systemPrompt?: string
  /**
   * When true, bypasses the MAX_CHAT_REQUEST_CHARS length guard.
   * Only used for AI Summarize (live-translate) which needs to send longer transcripts.
   */
  bypassLengthCheck?: boolean
  /**
   * Optional per-call output budget for long-form operations such as Deep Research
   * synthesis. Clamped in the IPC handler before reaching provider SDK calls.
   */
  maxOutputTokens?: MaxOutputTokensRequest
}

type ParsedChatParams =
  | { ok: true; value: ChatParams }
  | { ok: false; response: { success: false; error: string; errorCode?: string } }

const CHAT_CONTENT_TYPES = new Set(['text', 'image'])
const CHAT_ROLES = new Set(['user', 'assistant'])
const CHAT_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_CHAT_MODEL_ID_CHARS = 200
const MAX_SYSTEM_PROMPT_CHARS = 20_000

function parseChatParams(rawParams: unknown): ParsedChatParams {
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

  return {
    ok: true,
    value: {
      provider,
      model,
      messages,
      systemPrompt: rawParams.systemPrompt,
      bypassLengthCheck: rawParams.bypassLengthCheck,
      maxOutputTokens: rawParams.maxOutputTokens as MaxOutputTokensRequest | undefined,
    },
  }
}

// HC-08: MAX_CHAT_REQUEST_CHARS now imported from ipcConstants — stays in sync with
// MAX_CHAT_INPUT_CHARS in src/constants/providers.ts (renderer-side enforcement).

/** Wrap user system prompt to enforce strict compliance */
function buildEnforcedSystemPrompt(userPrompt: string): string {
  if (!userPrompt.trim()) {
    return 'You are a helpful AI assistant. Be concise, friendly, and accurate.'
  }
  return `${userPrompt.trim()}

IMPORTANT: You MUST strictly follow the instructions above in every response. Do not deviate, explain or refuse these instructions. Apply them to all messages unconditionally.`
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

  // Build chat history (all messages except the last user message)
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

  const chat = genModel.startChat({ history })

  // Last message is the current user input
  const lastMsg = messages[messages.length - 1]
  // sendMessage accepts Array<string | Part>: strings for plain text, Part objects for inline data
  const parts: Array<string | Part> = []
  for (const c of lastMsg.content) {
    if (c.type === 'text' && c.text) {
      parts.push(c.text)
    } else if (c.type === 'image' && c.imageBase64 && c.imageMimeType) {
      parts.push({ inlineData: { data: c.imageBase64, mimeType: c.imageMimeType } })
    }
  }

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

async function chatWithClaude(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt?: string,
  maxOutputTokens = MAX_CHAT_OUTPUT_TOKENS,
): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })

  const formattedMessages: { role: 'user' | 'assistant'; content: Array<TextBlockParam | ImageBlockParam> }[] = messages.map((msg) => {
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

async function chatWithOpenAI(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt?: string,
  maxOutputTokens = MAX_CHAT_OUTPUT_TOKENS,
): Promise<string> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })

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
    const errMsg = err instanceof Error ? err.message : String(err)
    const isChatEndpointError =
      errMsg.includes('not a chat model') ||
      errMsg.includes('v1/completions') ||
      (errMsg.includes('404') && errMsg.includes('completions'))

    if (isChatEndpointError) {
      // Fetch the best actual chat-capable model from the API
      const bestModel = await fetchBestOpenAIChatModel(apiKey)
      if (bestModel !== model) {
        return await tryChat(bestModel)
      }
    }
    throw err
  }
}

// ── Provider registry — DUP-04 / DUP-06 ──────────────────────────────────────
// Registry eliminates the switch/case dispatch block and makes the provider
// contract explicit. Per-provider functions remain separate (each SDK is different).

type ChatFn = (
  apiKey: string, model: string, messages: ChatMessage[], systemPrompt?: string, maxOutputTokens?: number
) => Promise<string>

const CHAT_PROVIDERS: Record<string, ChatFn> = {
  gemini: chatWithGemini,
  claude: chatWithClaude,
  openai: chatWithOpenAI,
}

/**
 * Register all chat-related IPC handlers with the Electron main process.
 *
 * Handlers registered:
 *  - `chat:send` — Send a conversational message (with optional image attachments
 *                  and system prompt); returns `{ success, reply?, error?, errorCode? }`
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
    const { provider, model, messages, systemPrompt, bypassLengthCheck } = params

    if (!messages || messages.length === 0) {
      return { success: false, error: 'No messages provided' }
    }

    // Validate the last user message doesn't exceed the character limit.
    // bypassLengthCheck=true skips this gate for AI Summarize which sends full transcripts.
    if (!bypassLengthCheck) {
      const lastMsg = messages[messages.length - 1]
      if (lastMsg.role === 'user') {
        const lastMsgTextChars = lastMsg.content.reduce(
          (sum, c) => sum + (c.text?.length ?? 0), 0
        )
        if (lastMsgTextChars > MAX_CHAT_REQUEST_CHARS) {  // HC-08
          return {
            success: false,
            error: `Message too long (${lastMsgTextChars} chars). Maximum is ${MAX_CHAT_REQUEST_CHARS} characters.`,
          }
        }
      }
    }

    // DUP-02 + DUP-03
    const apiKey = getStoredApiKey(provider)
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
      const msg = error instanceof Error ? error.message : String(error)
      // DUP-01: use classifyProviderError for consistent error categorization
      const classified = classifyProviderError(msg)
      return { ...classified, error: classified.errorCode ? classified.error : `Chat failed: ${msg}` }
    }
  })
}
