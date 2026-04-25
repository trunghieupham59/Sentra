import { IpcMain } from 'electron'
import { getStoredApiKey } from './storage'
import { classifyProviderError, noApiKeyResponse } from './errorUtils'
import { unknownProviderError, isValidProvider } from './providers/types'
import { withRetry } from './retry'
import {
  MAX_OUTPUT_TOKENS_CLAUDE,
  MAX_OUTPUT_TOKENS_OPENAI,
  VERIFY_MODEL_GEMINI,
  VERIFY_MODEL_CLAUDE,
  VERIFY_MODEL_OPENAI,
  VERIFY_MAX_TOKENS,
  DETECT_LANG_MAX_CHARS,
  TRANSLATE_CHUNK_CHAR_LIMIT,
  TRANSLATE_CHUNK_TIMEOUT_MS,
  TRANSLATE_CHUNK_CONCURRENCY,
  TRANSLATE_CONTEXT_TAIL_CHARS,
} from './ipcConstants'

// DUP-02: Removed local `getApiKey` wrapper — call getStoredApiKey directly.

type TranslationStyle = 'general' | 'formal' | 'casual' | 'business' | 'technical' | 'natural'

type PhoneticMode = 'off' | 'standard' | 'phonetic'

interface TranslateParams {
  provider: string
  model: string
  sourceText: string
  sourceLang: string
  targetLang: string
  showFurigana?: boolean
  /**
   * Explicit phonetic mode:
   *  - 'standard' — add {word|reading} ruby annotations (furigana/pinyin/romanization above original script)
   *  - 'phonetic' — replace script with pure phonetics (hiragana-only, pinyin-only, romanization-only, IPA)
   */
  phoneticMode?: PhoneticMode
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
  general:   'clear, natural, well-balanced — suitable for general everyday use; neither overly formal nor overly casual; reads naturally to any native speaker',
  formal:    'formal, polished, and respectful — appropriate for official correspondence, letters, reports, or interactions with superiors and unfamiliar parties; uses proper honorifics where applicable; avoids contractions and casual expressions',
  casual:    'casual, relaxed, conversational — like chatting with a close friend; uses informal language, contractions, colloquialisms, and expressive wording; feels natural in everyday conversation, texting, or social media',
  business:  'formal business register — highly concise, precise, and objective; appropriate for corporate emails, executive communication, and business documents; avoids unnecessary words; maintains a professional and authoritative tone',
  technical: 'precise, technical, and domain-specific — uses accurate industry-standard terminology; sentences are clear, unambiguous, and logically structured; suitable for documentation, specs, or expert-to-expert communication; prioritizes exactness; avoids casual language, metaphors, and any imprecision',
  natural:   'authentic, idiomatic, and naturally fluent — as if a confident native speaker originally wrote it in the target language; uses natural collocations, real idioms, and native rhythm; eliminates any trace of translation or foreignness; prioritizes how a real native would genuinely express the idea',
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

const REWRITE_SYSTEM_PROMPT = `You are a brilliant native writer — not a translator, not an editor of translations. You have never "fixed" translated text in your life. Your only instinct when reading text is: "Would a real native speaker of this language actually write or say this?" If not, you reimagine it entirely from the inside out.

You restructure sentences, choose authentic collocations, apply real idioms, and match the natural rhythm and feel of the target language — until every trace of foreignness disappears. You eliminate translationese ruthlessly: awkward word order, calques, unnatural prepositions, overly literal phrasing, stiff sentence length, and anything that reveals a foreign source. You think in the target language, not about it.`

function buildPrompt(
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  showFurigana = false,
  style: TranslationStyle = 'general',
  phoneticOnly = false,
  phoneticMode: PhoneticMode = 'standard',
): string {
  // ── phoneticOnly pass: annotate already-translated text ─────────────────────
  if (phoneticOnly && showFurigana) {

    // ── PHIÊN ÂM NGỮ ÂM (pure phonetic transcription) ──────────────────────
    // Replace the target script entirely with its phonetic representation.
    // Output contains ONLY phonetics — no original characters, no ruby format.
    if (phoneticMode === 'phonetic') {
      let phoneticInstruction = ''
      if (targetLang === 'ja') {
        phoneticInstruction =
          'Convert ALL kanji and katakana to hiragana. ' +
          'Output ONLY hiragana text — remove every kanji character entirely. ' +
          'Preserve spaces, punctuation, and particles as hiragana where applicable. ' +
          'Do NOT use {kanji|reading} brackets or any annotation format.'
      } else if (targetLang === 'zh' || targetLang === 'zh-TW') {
        phoneticInstruction =
          'Convert ALL Chinese characters to pinyin romanization with correct tone marks (ā á ǎ à etc.). ' +
          'Output ONLY pinyin — remove every Chinese character entirely. ' +
          'Separate syllables with spaces; capitalize proper nouns. ' +
          'Do NOT use {character|pinyin} brackets or any annotation format.'
      } else if (targetLang === 'ko') {
        phoneticInstruction =
          'Convert ALL Korean hangul to Revised Romanization of Korean. ' +
          'Output ONLY romanized text — remove every hangul character entirely. ' +
          'Do NOT use {한국어|romanization} brackets or any annotation format.'
      } else {
        phoneticInstruction =
          'Transcribe the text into IPA (International Phonetic Alphabet). ' +
          'Output ONLY the IPA transcription enclosed in /.../ for each sentence. ' +
          'Transcribe every word phonetically — do not keep the original spelling.'
      }
      return (
        `Convert the following ${targetLang} text to its pure phonetic representation. ` +
        `Do NOT translate or alter the meaning — only convert the script to phonetics. ` +
        `Return only the phonetic text, no explanations, no notes, no original characters.\n\n` +
        `${phoneticInstruction}\n\nText:\n${sourceText}`
      )
    }

    // ── NGỮ ÂM CHUẨN (standard ruby/furigana annotations) ────────────────────
    // Keep the original script and annotate it with {word|reading} ruby format.
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

  // ── Normal translation (with optional inline standard annotations) ──────────
  const tone = STYLE_TONE[style] ?? STYLE_TONE.general
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
  const styleName = style ?? 'general'
  const toneDesc = STYLE_TONE[styleName] ?? STYLE_TONE.general

  return `Make the text below indistinguishable from something a confident, articulate native speaker of ${lang} would genuinely write or say — not a polished translation, but authentic original expression.

Target language: ${lang}
Style: ${styleName} — ${toneDesc}

How to approach this:
1. Grasp the core idea and emotional intent — forget the exact words.
2. Ask yourself: "If I were a native speaker of ${lang} who just had this thought, how would I actually express it?"
3. Rewrite from that perspective. Change word order, sentence structure, and phrasing freely — as long as meaning, intent, and register stay intact.
4. Apply the style above to every dimension: vocabulary, sentence rhythm, formality level, and overall feel — not just surface-level word swaps.
5. Use collocations, idioms, and expressions that are natural and current in ${lang}.
6. Ruthlessly eliminate:
   - Literal translations or calques of foreign structures
   - Unnatural word order or awkward prepositions
   - Any phrase that "feels foreign" when a native reads it aloud
   - Formality mismatches (too stiff or too casual for the style)
   - Overly long or artificially short sentences for the register

Constraints:
- Preserve the exact meaning, intent, emotional tone, nuance, and perspective (1st/2nd/3rd person)
- Keep the language as ${lang} — do NOT translate into another language
- Keep names, numbers, URLs, code, and technical terms unchanged
- Do NOT add new information or omit important content

Output ONLY the rewritten text. No explanations, no notes, no alternatives.

Text:
${text}`
}

// ── Chunked translation helpers ───────────────────────────────────────────────
// Chunk parameters are imported from ipcConstants.ts (HC-09 through HC-12)
// so they can be tuned in one place without touching translate.ts.

// Convenience aliases — keep the local code readable while referencing the canonical values.
const CHUNK_CHAR_LIMIT    = TRANSLATE_CHUNK_CHAR_LIMIT
const CONTEXT_TAIL_CHARS  = TRANSLATE_CONTEXT_TAIL_CHARS

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

// Convenience aliases for chunk parameters (canonical values in ipcConstants.ts, HC-10/HC-11)
const CHUNK_TIMEOUT_MS  = TRANSLATE_CHUNK_TIMEOUT_MS
const CHUNK_CONCURRENCY = TRANSLATE_CHUNK_CONCURRENCY

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
  phoneticOnly: boolean,
  phoneticMode: PhoneticMode,
): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const genModel = genAI.getGenerativeModel({
    model,
    systemInstruction: SYSTEM_PROMPT,
  })
  const result = await genModel.generateContent(buildPrompt(sourceText, sourceLang, targetLang, showFurigana, style, phoneticOnly, phoneticMode))
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
  phoneticOnly: boolean,
  phoneticMode: PhoneticMode,
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
        content: buildPrompt(sourceText, sourceLang, targetLang, showFurigana, style, phoneticOnly, phoneticMode),
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
  phoneticOnly: boolean,
  phoneticMode: PhoneticMode,
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
        content: buildPrompt(sourceText, sourceLang, targetLang, showFurigana, style, phoneticOnly, phoneticMode),
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
    max_tokens: VERIFY_MAX_TOKENS,  // HC-NEW-09
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
    max_completion_tokens: VERIFY_MAX_TOKENS,  // HC-NEW-09
  })
  if (!completion.choices[0]) throw new Error('No response from OpenAI')
}

// ── Provider registries — DUP-04 / DUP-06 ─────────────────────────────────────
// Typed function registries replace the switch/case dispatch blocks and make the
// provider contract explicit via TypeScript types. Per-provider implementations are
// kept separate because each SDK has a fundamentally different API surface —
// the structural similarity is intentional (same contract, different SDKs), not
// avoidable duplication.

type TranslateFn = (
  apiKey: string, model: string,
  sourceText: string, sourceLang: string, targetLang: string,
  showFurigana: boolean, style: TranslationStyle, phoneticOnly: boolean,
  phoneticMode: PhoneticMode,
) => Promise<string>

type RewriteFn = (
  apiKey: string, model: string, text: string, lang: string, style?: TranslationStyle
) => Promise<string>

const TRANSLATE_PROVIDERS: Record<string, TranslateFn> = {
  gemini: translateWithGemini,
  claude: translateWithClaude,
  openai: translateWithOpenAI,
}

const REWRITE_PROVIDERS: Record<string, RewriteFn> = {
  gemini: rewriteWithGemini,
  claude: rewriteWithClaude,
  openai: rewriteWithOpenAI,
}

// ── Language detection helpers — one per provider ─────────────────────────────
// Each receives a pre-built detection prompt and returns the raw AI response string.
// max_tokens / maxOutputTokens is deliberately tiny (10) — we only need a short lang code.

type DetectFn = (apiKey: string, model: string, prompt: string) => Promise<string>

async function detectWithGemini(apiKey: string, model: string, prompt: string): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const genModel = genAI.getGenerativeModel({ model })
  const result = await genModel.generateContent(prompt)
  return result.response.text().trim()
}

async function detectWithClaude(apiKey: string, model: string, prompt: string): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  const message = await client.messages.create({
    model,
    max_tokens: 10,
    messages: [{ role: 'user', content: prompt }],
  })
  const block = message.content[0]
  if (block.type === 'text') return block.text.trim()
  throw new Error('Unexpected response type from Claude')
}

async function detectWithOpenAI(apiKey: string, model: string, prompt: string): Promise<string> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })
  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_completion_tokens: 10,
  })
  return (completion.choices[0]?.message?.content ?? '').trim()
}

const DETECT_PROVIDERS: Record<string, DetectFn> = {
  gemini: detectWithGemini,
  claude: detectWithClaude,
  openai: detectWithOpenAI,
}

// ── Exported for unit testing ─────────────────────────────────────────────────
/** @internal — exported for unit tests only */
export { splitIntoChunks, buildPrompt, withTimeout, promisePool, normalizeDetectedLang }

// ── Language detection — known BCP-47 codes this app supports ─────────────────
const KNOWN_LANG_CODES = ['vi', 'en', 'zh', 'zh-tw', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'ru', 'ar', 'th', 'id', 'it', 'nl', 'pl', 'tr', 'hi']

function normalizeDetectedLang(raw: string): string | null {
  // Strip quotes, whitespace, punctuation
  const cleaned = raw.toLowerCase().replace(/^["'`\s]+|["'`\s]+$/g, '').replace(/\s+/g, '-')
  if (KNOWN_LANG_CODES.includes(cleaned)) {
    // Fix capitalization: zh-TW must be zh-TW not zh-tw
    if (cleaned === 'zh-tw') return 'zh-TW'
    return cleaned
  }
  // Partial match as fallback (e.g. "vietnamese" → "vi")
  const partial = KNOWN_LANG_CODES.find(l => cleaned.startsWith(l) || l.startsWith(cleaned))
  if (partial) return partial === 'zh-tw' ? 'zh-TW' : partial
  return null
}

// ── Streaming helpers — one per provider ─────────────────────────────────────
/**
 * Per-provider streaming function type.
 * Accepts a pre-built prompt, calls the SDK streaming API, invokes `onToken`
 * for each generated token, and returns the full accumulated text.
 */
type StreamFn = (
  apiKey: string,
  model: string,
  prompt: string,
  onToken: (token: string) => void,
) => Promise<string>

async function streamWithOpenAI(
  apiKey: string, model: string, prompt: string,
  onToken: (token: string) => void,
): Promise<string> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })
  let fullText = ''
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
  return fullText
}

async function streamWithGemini(
  apiKey: string, model: string, prompt: string,
  onToken: (token: string) => void,
): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const genModel = genAI.getGenerativeModel({ model, systemInstruction: SYSTEM_PROMPT })
  let fullText = ''
  const result = await genModel.generateContentStream(prompt)
  for await (const chunk of result.stream) {
    const token = chunk.text()
    if (token) { fullText += token; onToken(token) }
  }
  return fullText
}

async function streamWithClaude(
  apiKey: string, model: string, prompt: string,
  onToken: (token: string) => void,
): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  let fullText = ''
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
  return fullText
}

// Registry eliminates the if/else dispatch block in streamTranslation
// (same pattern as TRANSLATE_PROVIDERS / REWRITE_PROVIDERS / DETECT_PROVIDERS above).
// Per-provider implementations remain separate because each SDK has a different streaming API.
const STREAM_PROVIDERS: Record<string, StreamFn> = {
  openai: streamWithOpenAI,
  gemini: streamWithGemini,
  claude: streamWithClaude,
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call the AI provider with streaming enabled and invoke `onToken` for every
 * generated token.  Returns the full accumulated text when done.
 *
 * Note: showFurigana / phoneticOnly are deliberately excluded from the live
 * streaming path to keep latency minimal.
 */
export async function streamTranslation(
  provider: string,
  apiKey: string,
  model: string,
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  style: TranslationStyle = 'general',
  onToken: (token: string) => void
): Promise<string> {
  const prompt = buildPrompt(sourceText, sourceLang, targetLang, false, style, false)

  const streamFn = STREAM_PROVIDERS[provider]
  if (!streamFn) {
    // Unknown provider — fall back to batch translate and emit all at once
    const fullText = await translateWithOpenAI(apiKey, model, sourceText, sourceLang, targetLang, false, style, false, 'off')
    onToken(fullText)
    return fullText
  }

  return streamFn(apiKey, model, prompt, onToken)
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
    // Validate provider identity before attempting any SDK call —
    // prevents unrecognized provider strings from reaching the switch.
    if (!isValidProvider(provider)) return unknownProviderError(provider)
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
          return unknownProviderError(provider)
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
    const { provider, model, sourceText, sourceLang, targetLang, showFurigana, translationStyle, phoneticOnly, phoneticMode } = params
    // Resolve effective phonetic mode: 'standard' is the default when showFurigana is true without an explicit mode
    const effectivePhoneticMode: PhoneticMode = phoneticMode ?? (showFurigana ? 'standard' : 'off')

    if (!sourceText.trim()) {
      return { success: false, error: 'Source text is empty' }
    }
    if (!model?.trim()) {
      return { success: false, error: 'Model is required' }
    }

    // DUP-02: call getStoredApiKey directly (no local wrapper)
    // DUP-03: use noApiKeyResponse() helper
    const apiKey = getStoredApiKey(provider)
    if (!apiKey) return noApiKeyResponse(provider)

    try {
      let translatedText = ''

      // phoneticOnly (furigana pass) operates on already-translated short text — skip chunking
      const needsChunking = !phoneticOnly && sourceText.length > CHUNK_CHAR_LIMIT

      // DUP-06: registry lookup replaces switch/case — unknownProviderError() provides a typed
      // response with a helpful hint listing supported providers.
      const translateFn = TRANSLATE_PROVIDERS[provider]
      if (!translateFn) return unknownProviderError(provider)

      // withRetry wraps single-chunk calls with exponential backoff for transient network errors.
      // Chunked translation has its own per-chunk timeout (CHUNK_TIMEOUT_MS) so retry isn't applied there.
      translatedText = needsChunking
        ? await translateChunked(
            (text) => translateFn(apiKey, model, text, sourceLang, targetLang, !!showFurigana, translationStyle ?? 'general', false, effectivePhoneticMode),
            sourceText,
          )
        : await withRetry(() =>
            translateFn(apiKey, model, sourceText, sourceLang, targetLang, !!showFurigana, translationStyle ?? 'general', !!phoneticOnly, effectivePhoneticMode)
          )

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
    if (!model?.trim()) {
      return { success: false, error: 'Model is required' }
    }

    // DUP-02 + DUP-03
    const apiKey = getStoredApiKey(provider)
    if (!apiKey) return noApiKeyResponse(provider)

    try {
      let rewrittenText = ''
      const needsChunking = text.length > CHUNK_CHAR_LIMIT

      // DUP-06: registry lookup replaces switch/case
      const rewriteFn = REWRITE_PROVIDERS[provider]
      if (!rewriteFn) return unknownProviderError(provider)

      rewrittenText = needsChunking
        ? await translateChunked((t) => rewriteFn(apiKey, model, t, lang, translationStyle), text)
        : await rewriteFn(apiKey, model, text, lang, translationStyle)

      return { success: true, translatedText: rewrittenText }
    } catch (error: unknown) {
      console.error(`Rewrite error with ${provider}:`, error)
      const msg = error instanceof Error ? error.message : String(error)
      // DUP-01: use classifyProviderError for consistent error categorization
      const classified = classifyProviderError(msg)
      return { ...classified, error: classified.errorCode ? classified.error : `Rewrite failed: ${msg}` }
    }
  })

  // Language detection handler — identify the language of source text so the swap button
  // can set the correct target language after switching source ↔ target panels.
  ipcMain.handle('translate:detect-lang', async (_event, params: { provider: string; model: string; text: string }) => {
    const { provider, model, text } = params
    if (!text.trim()) return { success: false, error: 'Text is empty' }

    const apiKey = getStoredApiKey(provider)
    if (!apiKey) return noApiKeyResponse(provider)

    // Truncate to DETECT_LANG_MAX_CHARS — enough for reliable detection, minimises token cost
    const snippet = text.slice(0, DETECT_LANG_MAX_CHARS)
    const prompt = `Identify the language of the following text. Reply with ONLY the BCP-47 language code (e.g. vi, en, ja, zh, zh-TW, ko, fr, de, es, pt, ru, ar, th, id, it, nl, pl, tr, hi). Nothing else — no punctuation, no explanation, no quotes.\n\nText:\n${snippet}`

    try {
      // DUP: use per-provider detect function via DETECT_PROVIDERS registry
      const detectFn = DETECT_PROVIDERS[provider]
      if (!detectFn) return unknownProviderError(provider)

      let raw = ''
      try {
        raw = await detectFn(apiKey, model, prompt)
      } catch {
        // Detection is best-effort — convert provider errors to a clean failure response
        return { success: false, error: 'Detection call failed' }
      }

      const lang = normalizeDetectedLang(raw)
      if (!lang) return { success: false, error: `Unrecognized language code: "${raw}"` }

      return { success: true, lang }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      const classified = classifyProviderError(msg)
      return { ...classified, error: classified.errorCode ? classified.error : `Language detection failed: ${msg}` }
    }
  })
}
