import type { ImageBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources/messages'
import type { Content, Part } from '@google/generative-ai'
import type { IpcMain } from 'electron'
import type { ChatCompletionContentPartImage, ChatCompletionContentPartText, ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { classifyProviderError, noApiKeyResponse } from './errorUtils'
import { MAX_CHAT_OUTPUT_TOKENS, MAX_CHAT_REQUEST_CHARS } from './ipcConstants'
import { unknownProviderError } from './providers/types'
import { withRetry } from './retry'
import { getStoredApiKey } from './storage'

// DUP-02: Removed local `getApiKey` wrapper — call getStoredApiKey directly.

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
  systemPrompt?: string
): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const genModel = genAI.getGenerativeModel({
    model,
    systemInstruction: buildEnforcedSystemPrompt(systemPrompt || ''),
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
  return result.response.text().trim()
}

async function chatWithClaude(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt?: string
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
    max_tokens: MAX_CHAT_OUTPUT_TOKENS,  // HC-02
    system: buildEnforcedSystemPrompt(systemPrompt || ''),
    messages: formattedMessages,
  })

  const block = message.content[0]
  if (block.type === 'text') return block.text.trim()
  throw new Error('Unexpected response type from Claude')
}

// ── Exported for unit testing ─────────────────────────────────────────────────

/** @internal — exported for unit tests only */
export { buildEnforcedSystemPrompt, isLikelyChatModel, scoreOpenAIChatModel }

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
  systemPrompt?: string
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
      max_completion_tokens: MAX_CHAT_OUTPUT_TOKENS,  // HC-02
    })
    return (completion.choices[0]?.message?.content ?? '').trim()
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
  apiKey: string, model: string, messages: ChatMessage[], systemPrompt?: string
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
  ipcMain.handle('chat:send', async (_event, params: ChatParams) => {
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

    try {
      let reply = ''

      // DUP-06: registry lookup replaces switch/case — unknownProviderError() provides a typed
      // response with a helpful hint listing supported providers.
      const chatFn = CHAT_PROVIDERS[provider]
      if (!chatFn) return unknownProviderError(provider)
      // withRetry wraps the chat call with exponential backoff for transient network errors.
      // Hard failures (auth, rate limit) are not retried — they propagate immediately.
      reply = await withRetry(() => chatFn(apiKey, model, messages, systemPrompt))

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
