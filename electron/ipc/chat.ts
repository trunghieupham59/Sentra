import { IpcMain } from 'electron'
import { getStoredApiKey } from './storage'

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
}

/**
 * Maximum total text characters allowed in a single chat request.
 * Mirrors MAX_CHAT_INPUT_CHARS enforced in the renderer — prevents UI bypass
 * (e.g., direct IPC calls skipping the input field limit).
 */
const MAX_CHAT_REQUEST_CHARS = 3000

/** Wrap user system prompt to enforce strict compliance */
function buildEnforcedSystemPrompt(userPrompt: string): string {
  if (!userPrompt.trim()) {
    return 'You are a helpful AI assistant. Be concise, friendly, and accurate.'
  }
  return `${userPrompt.trim()}

IMPORTANT: You MUST strictly follow the instructions above in every response. Do not deviate, explain or refuse these instructions. Apply them to all messages unconditionally.`
}

async function getApiKey(provider: string): Promise<string | null> {
  return getStoredApiKey(provider)
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
  const history = messages.slice(0, -1).map((msg) => {
    // biome-ignore lint/suspicious/noExplicitAny: Gemini SDK Part type compatibility
    const parts: any[] = []
    for (const c of msg.content) {
      if (c.type === 'text' && c.text) {
        parts.push({ text: c.text })
      } else if (c.type === 'image' && c.imageBase64 && c.imageMimeType) {
        parts.push({ inlineData: { data: c.imageBase64, mimeType: c.imageMimeType } })
      }
    }
    return { role: msg.role === 'user' ? 'user' : 'model', parts }
  })

  // biome-ignore lint/suspicious/noExplicitAny: Gemini SDK Content[] type compatibility
  const chat = genModel.startChat({ history: history as any[] })

  // Last message is the current user input
  const lastMsg = messages[messages.length - 1]
  // biome-ignore lint/suspicious/noExplicitAny: Gemini SDK parts type
  const parts: any[] = []
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

  // biome-ignore lint/suspicious/noExplicitAny: Anthropic SDK content type
  const formattedMessages: { role: 'user' | 'assistant'; content: any[] }[] = messages.map((msg) => {
    // biome-ignore lint/suspicious/noExplicitAny: Anthropic SDK content type
    const content: any[] = []
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
    max_tokens: 4096,
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

  // biome-ignore lint/suspicious/noExplicitAny: OpenAI SDK message type
  const formattedMessages: any[] = [
    {
      role: 'system',
      content: buildEnforcedSystemPrompt(systemPrompt || ''),
    },
  ]

  for (const msg of messages) {
    // biome-ignore lint/suspicious/noExplicitAny: OpenAI SDK content type
    const content: any[] = []
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
      formattedMessages.push({ role: msg.role, content })
    }
  }

  const tryChat = async (m: string) => {
    const completion = await client.chat.completions.create({
      model: m,
      messages: formattedMessages,
      max_completion_tokens: 4096,
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
    const { provider, model, messages, systemPrompt } = params

    if (!messages || messages.length === 0) {
      return { success: false, error: 'No messages provided' }
    }

    // Validate the last user message doesn't exceed the character limit.
    // This enforces the same limit as MAX_CHAT_INPUT_CHARS in the renderer,
    // preventing bypass via direct IPC calls.
    const lastMsg = messages[messages.length - 1]
    if (lastMsg.role === 'user') {
      const lastMsgTextChars = lastMsg.content.reduce(
        (sum, c) => sum + (c.text?.length ?? 0), 0
      )
      if (lastMsgTextChars > MAX_CHAT_REQUEST_CHARS) {
        return {
          success: false,
          error: `Message too long (${lastMsgTextChars} chars). Maximum is ${MAX_CHAT_REQUEST_CHARS} characters.`,
        }
      }
    }

    const apiKey = await getApiKey(provider)
    if (!apiKey) {
      return {
        success: false,
        error: `No API key found for ${provider}. Please add it in Settings.`,
        errorCode: 'NO_API_KEY',
      }
    }

    try {
      let reply = ''

      switch (provider) {
        case 'gemini':
          reply = await chatWithGemini(apiKey, model, messages, systemPrompt)
          break
        case 'claude':
          reply = await chatWithClaude(apiKey, model, messages, systemPrompt)
          break
        case 'openai':
          reply = await chatWithOpenAI(apiKey, model, messages, systemPrompt)
          break
        default:
          return { success: false, error: `Unknown provider: ${provider}` }
      }

      return { success: true, reply }
    } catch (error: unknown) {
      console.error(`Chat error with ${provider}:`, error)
      const msg = error instanceof Error ? error.message : String(error)

      if (msg.includes('401') || msg.includes('invalid_api_key') || msg.includes('authentication')) {
        return { success: false, error: 'Invalid API key. Please check your key in Settings.', errorCode: 'INVALID_KEY' }
      }
      if (msg.includes('429') || msg.includes('rate_limit') || msg.includes('quota')) {
        return { success: false, error: 'Rate limit exceeded. Please wait and try again.', errorCode: 'RATE_LIMIT' }
      }
      if (msg.includes('ENOTFOUND') || msg.includes('network') || msg.includes('fetch')) {
        return { success: false, error: 'No internet connection.', errorCode: 'NETWORK' }
      }
      return { success: false, error: `Chat failed: ${msg}` }
    }
  })
}
