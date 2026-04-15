import { IpcMain } from 'electron'
import { getStoredApiKey } from './storage'
import { classifyProviderError, noApiKeyResponse } from './errorUtils'
import {
  MAX_OUTPUT_TOKENS_CLAUDE,
  MAX_OUTPUT_TOKENS_OPENAI,
  VERIFY_MODEL_GEMINI,
  VERIFY_MODEL_CLAUDE,
  VERIFY_MODEL_OPENAI,
} from './ipcConstants'

// DUP-02: Removed local `getApiKey` wrapper — call getStoredApiKey directly.

type TranslationStyle = 'friendly' | 'neutral' | 'professional' | 'business' | 'slack' | 'polite' | 'technical'

interface TranslateParams {
  provider: string
  model: string
  sourceText: string
  sourceLang: string
  targetLang: string
  showFurigana?: boolean
  translationStyle?: TranslationStyle
  /** When true, skip translation — only add phonetic annotations to the already-translated sourceText */
  phoneticOnly?: boolean
}

interface RewriteParams {
  provider: string
  model: string
  text: string
  lang: string
  translationStyle?: TranslationStyle
}

const STYLE_TONE: Record<TranslationStyle, string> = {
  friendly: 'friendly, warm, casual — like chatting with a close friend or family member; use informal language, contractions, and expressive wording; convey genuine warmth and personal closeness; feel free to use common colloquialisms and playful phrasing; avoid any stiff, corporate, or overly formal expression',
  neutral: 'neutral, clear, natural — well-balanced register suitable for general everyday use; neither overly formal nor overly casual; factual, direct, and easy to understand without any emotional coloring or bias; appropriate for informational or general-purpose content',
  professional: 'professional, polished, confident — appropriate for interactions with colleagues, clients, or business partners; clear, well-structured, and demonstrates competence and mutual respect; avoids slang and colloquialisms but remains approachable and human; suitable for workplace emails, presentations, and reports',
  business: 'formal business register — highly concise, precise, and objective; appropriate for official corporate communication, formal emails, proposals, contracts, and business reports; uses standard formal business vocabulary; maintains a respectful but impersonal tone; avoids personal feelings, humor, or informality',
  slack: 'concise workplace chat style — informal yet professional; direct and efficient as in instant messaging; uses common workplace abbreviations and natural digital communication patterns; friendly but task-focused; avoids long sentences or over-explanation; feels like a message from a trusted colleague',
  polite: 'polite, respectful, considerate — suitable for addressing someone of higher status, seniority, or unfamiliar parties; uses appropriate honorifics, respectful vocabulary, and softened expressions for the target language and culture; conveys deference and care without being servile; avoids bluntness, casual slang, or any expression that could seem presumptuous',
  technical: 'technical, precise, domain-specific — uses accurate, industry-standard technical terminology; sentences are clear, unambiguous, and logically structured; suitable for documentation, technical specifications, research, or expert-to-expert communication; avoids casual language, metaphors, and any imprecision; prioritizes exactness over readability for a lay audience',
}

const SYSTEM_PROMPT = `You are an expert translator and linguist with deep knowledge of cultural nuance. Your translations sound completely natural to native speakers of the target language.

Core rules:
1. Translate with full accuracy — preserve meaning, intent, emotional tone, nuance, voice, and register.
2. Output ONLY the translation. No explanations, no alternatives, no translator notes.
3. Never change: URLs, email addresses, code snippets, variable names, numbers, markdown/HTML formatting.
4. Match the requested tone and style with precision — not just vocabulary but sentence rhythm, formality, and feel.

CRITICAL — Proper names and honorifics:
- When names appear with honorific suffixes, treat them correctly for the target language.
- Translating INTO Japanese: "Yokoyama-san" → "横山さん", "Tanaka-kun" → "田中くん", "Sato-chan" → "佐藤ちゃん", "Suzuki-sama" → "鈴木様", "Yamada-sensei" → "山田先生". Always convert common Japanese surnames from romaji to kanji: Yokoyama→横山, Tanaka→田中, Sato/Satou→佐藤, Suzuki→鈴木, Watanabe→渡辺, Ito/Itou→伊藤, Yamamoto→山本, Nakamura→中村, Kobayashi→小林, Kato/Katou→加藤, Yamada→山田, Hayashi→林, Inoue→井上, Kimura→木村, Saito/Saitou→斉藤, Matsumoto→松本, Fujiwara→藤原, Ogawa→小川, Nishimura→西村, Hashimoto→橋本. If the surname is not on this list but ends with a Japanese-style romanization, keep it in katakana.
- Translating OUT OF Japanese: render honorifics naturally in the target language, or retain the "-san"/"-kun" etc. suffix where culturally appropriate.
- For Vietnamese relational address pronouns used as names or titles (Anh, Em, Chị, Cô, Chú, Bác, Ông, Bà): preserve or adapt them appropriately to fit the target language's cultural register.
- Korean honorifics (씨, 님, 선생님 etc.) and Chinese honorifics (先生, 女士, 老师 etc.) should similarly be adapted appropriately.`

const REWRITE_SYSTEM_PROMPT = `You are a native speaker and expert editor with deep cultural knowledge. Your task is to rewrite text so it sounds completely authentic and natural — exactly the way a confident, educated native speaker of that language would write or speak. You understand the subtle idioms, colloquialisms, cultural references, and speech patterns that distinguish native writing from translated or non-native text. While preserving the original meaning, intent, and register, you elevate the language so it feels genuine, fluent, and culturally resonant.`

function buildPrompt(sourceText: string, sourceLang: string, targetLang: string, showFurigana = false, style: TranslationStyle = 'neutral', phoneticOnly = false): string {
  // phoneticOnly mode: add phonetic annotations to already-translated text without re-translating
  if (phoneticOnly && showFurigana) {
    let phoneticInstruction = ''
    if (targetLang === 'ja') {
      phoneticInstruction = 'For every kanji word or phrase, wrap it with its furigana reading in the format {kanji|reading} (e.g. {東京|とうきょう}). Apply to ALL kanji including standalone characters.'
    } else if (targetLang === 'zh' || targetLang === 'zh-TW') {
      phoneticInstruction = 'For every Chinese word or character, wrap it with its pinyin reading in the format {character|pīnyīn} (e.g. {北京|Běijīng}). Apply to ALL Chinese characters.'
    } else if (targetLang === 'ko') {
      phoneticInstruction = 'For every Korean word, wrap it with its romanization in the format {한국어|romanization} (e.g. {서울|Seoul}). Apply to ALL Korean words.'
    } else {
      phoneticInstruction = 'For every word, wrap it with its pronunciation or phonetic transcription in the format {word|pronunciation} (e.g. {hello|həˈloʊ}). Use IPA notation where applicable.'
    }
    return `Add phonetic annotations to the following ${targetLang} text. Do NOT translate or change the text content in any way — only add phonetic annotations. Return only the annotated text, no explanations, no notes.\n\n${phoneticInstruction}\n\nText to annotate:\n${sourceText}`
  }

  const tone = STYLE_TONE[style] ?? STYLE_TONE.neutral
  let phoneticInstruction = ''
  if (showFurigana) {
    if (targetLang === 'ja') {
      phoneticInstruction = ' For every kanji word or phrase in the translation, wrap it with its furigana reading in the format {kanji|reading} (e.g. {東京|とうきょう}). Apply to ALL kanji including standalone characters.'
    } else if (targetLang === 'zh' || targetLang === 'zh-TW') {
      phoneticInstruction = ' For every Chinese word or character in the translation, wrap it with its pinyin reading in the format {character|pīnyīn} (e.g. {北京|Běijīng}). Apply to ALL Chinese characters.'
    } else if (targetLang === 'ko') {
      phoneticInstruction = ' For every Korean word in the translation, wrap it with its romanization in the format {한국어|romanization} (e.g. {서울|Seoul}). Apply to ALL Korean words.'
    } else {
      phoneticInstruction = ' For every word in the translation, wrap it with its pronunciation or phonetic transcription in the format {word|pronunciation} (e.g. {hello|həˈloʊ}). Use IPA notation where applicable.'
    }
  }
  return `Translate into ${targetLang}. Tone: ${tone}. Preserve meaning, intent, and nuance exactly. Use natural wording for a native speaker. Keep names, numbers, links, email addresses, code, and formatting unchanged unless localization is requested. Output only the translation.${phoneticInstruction}\n\n${sourceText}`
}

function buildRewritePrompt(text: string, lang: string, style?: TranslationStyle): string {
  const styleName = style ?? 'neutral'
  const toneDesc = STYLE_TONE[styleName] ?? STYLE_TONE.neutral

  return `Rewrite the following text so it sounds completely natural and authentic in ${lang} — as a native speaker with full cultural fluency would express it.

Style to match: ${styleName} — ${toneDesc}

Requirements:
- Rewrite it so it sounds genuinely native: use natural idioms, culturally authentic expressions, and real speech patterns of ${lang}
- Apply the style above precisely — not just vocabulary but sentence rhythm, formality level, and overall feel
- Keep the EXACT same meaning, intent, nuance, emotional tone, and subject matter
- Keep the same perspective (first/second/third person)
- Do NOT change the language (must stay in ${lang})
- Do NOT add new information or remove important content
- Eliminate any phrasing that feels translated, awkward, unnatural, or non-idiomatic
- The result should be indistinguishable from something written by a confident, articulate native speaker of ${lang}

Output ONLY the rewritten text. No explanations, no notes, no alternatives.

Text to rewrite:
${text}`
}

// ── Chunked translation helpers ───────────────────────────────────────────────

/**
 * Maximum characters per chunk sent to the AI.
 * ~12 000 chars ≈ 3 000 tokens — safely fits in context window even for smaller
 * models (8K ctx) after accounting for system prompt (~500 tok) + output (~3 000 tok).
 * For modern large-context models this just means fewer, larger chunks.
 */
const CHUNK_CHAR_LIMIT = 12_000

/** How many chars of the previous source chunk to include as overlap context */
const CONTEXT_TAIL_CHARS = 400

/**
 * Split `text` into chunks ≤ `maxChars`, preferring natural break points:
 *   1. Double newline (paragraph break)
 *   2. Single newline
 *   3. Sentence-ending punctuation (., !, ?, 。, ！, ？)
 *   4. Hard split at maxChars (last resort)
 */
function splitIntoChunks(text: string, maxChars = CHUNK_CHAR_LIMIT): string[] {
  if (text.length <= maxChars) return [text]

  const chunks: string[] = []
  let pos = 0

  while (pos < text.length) {
    const remaining = text.length - pos
    if (remaining <= maxChars) {
      chunks.push(text.slice(pos))
      break
    }

    const window = text.slice(pos, pos + maxChars)
    let splitAt = maxChars // default: hard split

    // 1. Paragraph break (\n\n)
    const para = window.lastIndexOf('\n\n')
    if (para > maxChars * 0.35) { splitAt = para + 2 }
    else {
      // 2. Single newline
      const line = window.lastIndexOf('\n')
      if (line > maxChars * 0.35) { splitAt = line + 1 }
      else {
        // 3. Sentence-ending punctuation followed by whitespace or end
        const ends = ['. ', '! ', '? ', '。', '！', '？', '…']
        let best = -1
        for (const e of ends) {
          const idx = window.lastIndexOf(e)
          if (idx > best && idx > maxChars * 0.35) best = idx
        }
        if (best > 0) splitAt = best + 2
        // else: hard split at maxChars
      }
    }

    chunks.push(text.slice(pos, pos + splitAt).trimEnd())
    pos += splitAt
  }

  return chunks.filter(c => c.trim().length > 0)
}

/** Timeout (ms) per individual chunk request — prevents a single AI call from hanging forever */
const CHUNK_TIMEOUT_MS = 90_000  // 90 s

/** Max concurrent chunk requests — limits parallel API calls to avoid rate-limit errors */
const CHUNK_CONCURRENCY = 5

/**
 * Wraps a promise with a hard timeout.
 * Rejects with a clear message if `ms` elapses before the promise settles.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Chunk translation timed out after ${ms / 1000}s (${label})`)),
      ms
    )
    promise.then(
      (val) => { clearTimeout(timer); resolve(val) },
      (err) => { clearTimeout(timer); reject(err) },
    )
  })
}

/**
 * Run `tasks` with at most `concurrency` active at a time, preserving order.
 * - Unlimited total tasks (no hardcoded cap).
 * - If any task rejects the error propagates immediately (Promise.all semantics).
 */
async function promisePool<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let next = 0

  async function worker(): Promise<void> {
    while (next < tasks.length) {
      const i = next++
      results[i] = await tasks[i]()
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker(),
  )
  await Promise.all(workers)
  return results
}

/**
 * Wrap a raw translate function with automatic chunking, per-chunk timeout,
 * and concurrency-limited parallel execution.
 *
 * Strategy:
 * - Text ≤ CHUNK_CHAR_LIMIT → translated in a single call (no overhead).
 * - Text > CHUNK_CHAR_LIMIT → split into N chunks of arbitrary size:
 *     • Chunk 1: plain translation with a "part 1 of N" note.
 *     • Chunk k (k > 1): prepended with the last ~400 chars of the *source*
 *       text of chunk k-1 so the model maintains consistent terminology/style
 *       without waiting for previous chunk outputs (enables full parallelism).
 * - Up to CHUNK_CONCURRENCY chunks run simultaneously; remaining chunks queue
 *   and start as slots free.
 * - Each chunk is individually wrapped in a CHUNK_TIMEOUT_MS deadline.
 * - Results are joined with '\n'.
 */
async function translateChunked(
  translateFn: (text: string) => Promise<string>,
  sourceText: string,
  chunkLimit = CHUNK_CHAR_LIMIT,
): Promise<string> {
  const chunks = splitIntoChunks(sourceText, chunkLimit)
  if (chunks.length === 1) {
    return withTimeout(translateFn(sourceText), CHUNK_TIMEOUT_MS, 'single chunk')
  }

  const tasks: Array<() => Promise<string>> = chunks.map((chunk, idx) => () => {
    let text: string
    if (idx === 0) {
      text =
        `[NOTE: This is part 1 of ${chunks.length} of a larger document. ` +
        `Translate only this part; more will follow. Maintain consistent terminology and style.]\n\n` +
        chunk
    } else {
      const prevTail = chunks[idx - 1].slice(-CONTEXT_TAIL_CHARS).trim()
      text =
        `[NOTE: This is part ${idx + 1} of ${chunks.length} of a larger document. ` +
        `The immediately preceding source text (already translated separately) was:\n` +
        `"${prevTail}"\n` +
        `Translate ONLY the text below this note. Use consistent terminology and style ` +
        `with the rest of the document. Output only the translation — no notes or prefix.]\n\n` +
        chunk
    }
    return withTimeout(translateFn(text), CHUNK_TIMEOUT_MS, `chunk ${idx + 1}/${chunks.length}`)
  })

  const results = await promisePool(tasks, CHUNK_CONCURRENCY)
  return results.join('\n')
}

async function translateWithGemini(
  apiKey: string,
  model: string,
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  showFurigana: boolean,
  style: TranslationStyle,
  phoneticOnly: boolean
): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const genModel = genAI.getGenerativeModel({
    model,
    systemInstruction: SYSTEM_PROMPT,
  })
  const result = await genModel.generateContent(buildPrompt(sourceText, sourceLang, targetLang, showFurigana, style, phoneticOnly))
  return result.response.text().trim()
}

async function translateWithClaude(
  apiKey: string,
  model: string,
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  showFurigana: boolean,
  style: TranslationStyle,
  phoneticOnly: boolean
): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  const message = await client.messages.create({
    model,
    max_tokens: MAX_OUTPUT_TOKENS_CLAUDE,  // HC-01
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildPrompt(sourceText, sourceLang, targetLang, showFurigana, style, phoneticOnly),
      },
    ],
  })
  const block = message.content[0]
  if (block.type === 'text') return block.text.trim()
  throw new Error('Unexpected response type from Claude')
}

async function translateWithOpenAI(
  apiKey: string,
  model: string,
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  showFurigana: boolean,
  style: TranslationStyle,
  phoneticOnly: boolean
): Promise<string> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })
  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: buildPrompt(sourceText, sourceLang, targetLang, showFurigana, style, phoneticOnly),
      },
    ],
    max_completion_tokens: MAX_OUTPUT_TOKENS_OPENAI,  // HC-01
  })
  return (completion.choices[0]?.message?.content ?? '').trim()
}

// ── Rewrite helpers — one per provider ───────────────────────────────────────

async function rewriteWithGemini(apiKey: string, model: string, text: string, lang: string, style?: TranslationStyle): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const genModel = genAI.getGenerativeModel({ model, systemInstruction: REWRITE_SYSTEM_PROMPT })
  const result = await genModel.generateContent(buildRewritePrompt(text, lang, style))
  return result.response.text().trim()
}

async function rewriteWithClaude(apiKey: string, model: string, text: string, lang: string, style?: TranslationStyle): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  const message = await client.messages.create({
    model,
    max_tokens: MAX_OUTPUT_TOKENS_CLAUDE,  // HC-01
    system: REWRITE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildRewritePrompt(text, lang, style) }],
  })
  const block = message.content[0]
  if (block.type === 'text') return block.text.trim()
  throw new Error('Unexpected response type from Claude')
}

async function rewriteWithOpenAI(apiKey: string, model: string, text: string, lang: string, style?: TranslationStyle): Promise<string> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: REWRITE_SYSTEM_PROMPT },
      { role: 'user', content: buildRewritePrompt(text, lang, style) },
    ],
    max_completion_tokens: MAX_OUTPUT_TOKENS_OPENAI,  // HC-01
  })
  return (completion.choices[0]?.message?.content ?? '').trim()
}

async function verifyGeminiKey(apiKey: string): Promise<void> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  // Lightweight verification — use the cheapest model available
  const model = genAI.getGenerativeModel({ model: VERIFY_MODEL_GEMINI })  // HC-05
  const result = await model.generateContent('Say "ok" in one word.')
  const text = result.response.text()
  if (!text) throw new Error('No response from Gemini')
}

async function verifyClaudeKey(apiKey: string): Promise<void> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  const message = await client.messages.create({
    model: VERIFY_MODEL_CLAUDE,  // HC-05
    max_tokens: 10,
    messages: [{ role: 'user', content: 'Say "ok".' }],
  })
  if (!message.content[0]) throw new Error('No response from Claude')
}

async function verifyOpenAIKey(apiKey: string): Promise<void> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })
  const completion = await client.chat.completions.create({
    model: VERIFY_MODEL_OPENAI,  // HC-05
    messages: [{ role: 'user', content: 'Say "ok".' }],
    max_completion_tokens: 5,
  })
  if (!completion.choices[0]) throw new Error('No response from OpenAI')
}

// ── Streaming translation — yields tokens via callback ────────────────────────
/**
 * Calls the AI provider with streaming enabled and invokes `onToken` for every
 * generated token.  Returns the full accumulated text when done.
 *
 * Note: showFurigana / phoneticOnly are deliberately excluded from the live
 * streaming path to keep latency minimal.
 */
// ── Exported for unit testing ─────────────────────────────────────────────────
/** @internal — exported for unit tests only */
export { splitIntoChunks, buildPrompt, withTimeout, promisePool }

// ─────────────────────────────────────────────────────────────────────────────

export async function streamTranslation(
  provider: string,
  apiKey: string,
  model: string,
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  style: TranslationStyle = 'neutral',
  onToken: (token: string) => void
): Promise<string> {
  const prompt = buildPrompt(sourceText, sourceLang, targetLang, false, style, false)
  let fullText = ''

  if (provider === 'openai') {
    const OpenAI = (await import('openai')).default
    const client = new OpenAI({ apiKey })
    const stream = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: prompt },
      ],
      stream: true,
      max_completion_tokens: MAX_OUTPUT_TOKENS_OPENAI,  // HC-01
    })
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? ''
      if (token) { fullText += token; onToken(token) }
    }

  } else if (provider === 'gemini') {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(apiKey)
    const genModel = genAI.getGenerativeModel({ model, systemInstruction: SYSTEM_PROMPT })
    const result = await genModel.generateContentStream(prompt)
    for await (const chunk of result.stream) {
      const token = chunk.text()
      if (token) { fullText += token; onToken(token) }
    }

  } else if (provider === 'claude') {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey })
    const stream = client.messages.stream({
      model,
      max_tokens: MAX_OUTPUT_TOKENS_CLAUDE,  // HC-01
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })
    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        const token = event.delta.text
        if (token) { fullText += token; onToken(token) }
      }
    }

  } else {
    // Unknown provider — fall back to batch translate and emit all at once
    fullText = await translateWithOpenAI(apiKey, model, sourceText, sourceLang, targetLang, false, style, false)
    onToken(fullText)
  }

  return fullText
}

/**
 * Register all translation-related IPC handlers with the Electron main process.
 *
 * Handlers registered:
 *  - `translate:verify`   — Test an API key with a minimal request; returns `{ success, errorCode? }`
 *  - `translate`          — Full text translation with optional chunking for long documents;
 *                           returns `{ success, translatedText?, error?, errorCode? }`
 *  - `translate:rewrite`  — Rewrite text to sound more natural in its target language;
 *                           returns `{ success, translatedText?, error?, errorCode? }`
 *
 * All handlers:
 *  - Read the API key from the OS Keychain via `getStoredApiKey` (never from renderer).
 *  - Validate inputs before calling the AI provider.
 *  - Categorize errors into typed `errorCode` values (INVALID_KEY, RATE_LIMIT, NETWORK).
 *
 * @param ipcMain - Electron's IpcMain instance (passed from main.ts at startup).
 */
export function registerTranslateHandlers(ipcMain: IpcMain) {
  // Verify API key by making a minimal test request
  ipcMain.handle('translate:verify', async (_event, provider: string, apiKey: string) => {
    if (!apiKey?.trim()) {
      return { success: false, error: 'API key is empty' }
    }
    try {
      switch (provider) {
        case 'gemini':
          await verifyGeminiKey(apiKey)
          break
        case 'claude':
          await verifyClaudeKey(apiKey)
          break
        case 'openai':
          await verifyOpenAIKey(apiKey)
          break
        default:
          return { success: false, error: `Unknown provider: ${provider}` }
      }
      return { success: true }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      // Verify handler has a special case: rate-limit means key IS valid
      if (msg.includes('401') || msg.includes('invalid_api_key') || msg.includes('authentication') || msg.includes('API key')) {
        return { success: false, error: 'Invalid API key', errorCode: 'INVALID_KEY' }
      }
      if (msg.includes('429') || msg.includes('quota') || msg.includes('rate_limit')) {
        return { success: false, error: 'Rate limit hit, but key is valid!', errorCode: 'RATE_LIMIT', valid: true }
      }
      if (msg.includes('ENOTFOUND') || msg.includes('network')) {
        return { success: false, error: 'No internet connection', errorCode: 'NETWORK' }
      }
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('translate', async (_event, params: TranslateParams) => {
    const { provider, model, sourceText, sourceLang, targetLang, showFurigana, translationStyle, phoneticOnly } = params

    if (!sourceText.trim()) {
      return { success: false, error: 'Source text is empty' }
    }

    // DUP-02: call getStoredApiKey directly (no local wrapper)
    // DUP-03: use noApiKeyResponse() helper
    const apiKey = getStoredApiKey(provider)
    if (!apiKey) return noApiKeyResponse(provider)

    try {
      let translatedText = ''

      // phoneticOnly (furigana pass) operates on already-translated short text — skip chunking
      const needsChunking = !phoneticOnly && sourceText.length > CHUNK_CHAR_LIMIT

      switch (provider) {
        case 'gemini':
          translatedText = needsChunking
            ? await translateChunked(
                (text) => translateWithGemini(apiKey, model, text, sourceLang, targetLang, !!showFurigana, translationStyle ?? 'neutral', false),
                sourceText,
              )
            : await translateWithGemini(apiKey, model, sourceText, sourceLang, targetLang, !!showFurigana, translationStyle ?? 'neutral', !!phoneticOnly)
          break
        case 'claude':
          translatedText = needsChunking
            ? await translateChunked(
                (text) => translateWithClaude(apiKey, model, text, sourceLang, targetLang, !!showFurigana, translationStyle ?? 'neutral', false),
                sourceText,
              )
            : await translateWithClaude(apiKey, model, sourceText, sourceLang, targetLang, !!showFurigana, translationStyle ?? 'neutral', !!phoneticOnly)
          break
        case 'openai':
          translatedText = needsChunking
            ? await translateChunked(
                (text) => translateWithOpenAI(apiKey, model, text, sourceLang, targetLang, !!showFurigana, translationStyle ?? 'neutral', false),
                sourceText,
              )
            : await translateWithOpenAI(apiKey, model, sourceText, sourceLang, targetLang, !!showFurigana, translationStyle ?? 'neutral', !!phoneticOnly)
          break
        default:
          return { success: false, error: `Unknown provider: ${provider}` }
      }

      return { success: true, translatedText }
    } catch (error: unknown) {
      console.error(`Translation error with ${provider}:`, error)
      const msg = error instanceof Error ? error.message : String(error)
      // DUP-01: use classifyProviderError for consistent error categorization
      const classified = classifyProviderError(msg)
      return { ...classified, error: classified.errorCode ? classified.error : `Translation failed: ${msg}` }
    }
  })

  // Rewrite handler — make text more natural in its own language without changing meaning
  ipcMain.handle('translate:rewrite', async (_event, params: RewriteParams) => {
    const { provider, model, text, lang, translationStyle } = params

    if (!text.trim()) {
      return { success: false, error: 'Text is empty' }
    }

    // DUP-02 + DUP-03
    const apiKey = getStoredApiKey(provider)
    if (!apiKey) return noApiKeyResponse(provider)

    try {
      let rewrittenText = ''
      const needsChunking = text.length > CHUNK_CHAR_LIMIT

      switch (provider) {
        case 'gemini':
          rewrittenText = needsChunking
            ? await translateChunked((t) => rewriteWithGemini(apiKey, model, t, lang, translationStyle), text)
            : await rewriteWithGemini(apiKey, model, text, lang, translationStyle)
          break
        case 'claude':
          rewrittenText = needsChunking
            ? await translateChunked((t) => rewriteWithClaude(apiKey, model, t, lang, translationStyle), text)
            : await rewriteWithClaude(apiKey, model, text, lang, translationStyle)
          break
        case 'openai':
          rewrittenText = needsChunking
            ? await translateChunked((t) => rewriteWithOpenAI(apiKey, model, t, lang, translationStyle), text)
            : await rewriteWithOpenAI(apiKey, model, text, lang, translationStyle)
          break
        default:
          return { success: false, error: `Unknown provider: ${provider}` }
      }

      return { success: true, translatedText: rewrittenText }
    } catch (error: unknown) {
      console.error(`Rewrite error with ${provider}:`, error)
      const msg = error instanceof Error ? error.message : String(error)
      // DUP-01: use classifyProviderError for consistent error categorization
      const classified = classifyProviderError(msg)
      return { ...classified, error: classified.errorCode ? classified.error : `Rewrite failed: ${msg}` }
    }
  })
}
