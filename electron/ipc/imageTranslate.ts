import type { IpcMain } from 'electron'
import { classifyProviderError, noApiKeyResponse } from './errorUtils'
import {
  ANTHROPIC_API_BASE, ANTHROPIC_API_VERSION,ANTHROPIC_MODELS_LIMIT, 
  GEMINI_API_BASE, GEMINI_IMAGE_EDIT_MODEL,
  GEMINI_MODELS_PAGE_SIZE, 
  MAX_CHAT_OUTPUT_TOKENS,VISION_DISCOVERY_TIMEOUT_MS,VISION_SCORE_BASIC,VISION_SCORE_CAPABLE, 
  VISION_SCORE_CHEAP, VISION_SCORE_GEN_WEIGHT, VISION_SCORE_LITE_PENALTY,VISION_SCORE_MID, 
  VISION_SCORE_SLOW, 
} from './ipcConstants'
import { invalidIpcInput, isNonEmptyString, isRecord, isSafeLanguageCode } from './ipcValidation'
import { isValidProvider, unknownProviderError } from './providers/types'
import { getStoredApiKey } from './storage'

/** Allowed image MIME types for Gemini image-edit (whitelist prevents injection via IPC). */
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

/** Returns a fetch with a timeout via AbortController. Rejects with AbortError on timeout. */
function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

// ── Vision model discovery (no hardcoded model IDs) ───────────────────────────

/**
 * Patterns that indicate a model is NOT capable of image/vision input.
 * Used to filter out TTS, embedding, reasoning-only, and generation-only models.
 */
const NON_VISION_PATTERN = /tts|embed|aqa|image-generation|learnlm|thinking|whisper|dall-?e|moderation|realtime|transcribe|instruct|codex/i

/** Returns true if the error indicates the model does not support image/vision input. */
function isVisionUnsupportedError(msg: string): boolean {
  const lower = msg.toLowerCase()
  return lower.includes('image input') || lower.includes('modality') ||
    lower.includes('vision') || lower.includes('multimodal') ||
    lower.includes('not enabled') || lower.includes('does not support') ||
    lower.includes('image generation') || lower.includes('image modality')
}

/**
 * Returns true if the error indicates the model does not exist / was deprecated.
 * These errors are retryable — try the next fallback model.
 */
function isModelNotFoundError(msg: string): boolean {
  const lower = msg.toLowerCase()
  return lower.includes('not_found_error') || lower.includes('model not found') ||
    lower.includes('no such model') || lower.includes('does not exist') ||
    (lower.includes('404') && lower.includes('model'))
}

/**
 * Score a model for vision fallback selection: higher score = cheaper/faster (preferred).
 * Used to sort the dynamically-fetched model list so cheap models are tried first.
 */
function scoreModelForVision(provider: string, modelId: string): number {
  const id = modelId.toLowerCase()
  let score = 0

  if (provider === 'gemini') {
    if (id.includes('flash'))      score += VISION_SCORE_CHEAP
    else if (id.includes('pro'))   score += VISION_SCORE_CAPABLE
    if (id.includes('lite') || id.includes('nano')) score -= VISION_SCORE_LITE_PENALTY
    // Bonus per generation number: gemini-2 > gemini-1.5 > gemini-1
    const gen = id.match(/gemini-(\d+)\.?(\d*)/)
    if (gen) score += parseFloat(`${gen[1]}.${gen[2] || 0}`) * VISION_SCORE_GEN_WEIGHT
  } else if (provider === 'claude') {
    if (id.includes('haiku'))       score += VISION_SCORE_CHEAP
    else if (id.includes('sonnet')) score += VISION_SCORE_MID
    else if (id.includes('opus'))   score += VISION_SCORE_SLOW
    // Newer versions preferred (claude-3-7 > claude-3-5 > claude-3)
    const ver = id.match(/claude-(\d+)-?(\d*)/)
    if (ver) score += parseFloat(`${ver[1]}.${ver[2] || 0}`) * VISION_SCORE_GEN_WEIGHT
  } else if (provider === 'openai') {
    if (id.includes('mini'))          score += VISION_SCORE_CHEAP
    else if (id.includes('4o'))       score += VISION_SCORE_MID
    else if (id.startsWith('gpt-4'))  score += VISION_SCORE_BASIC
    // gpt-3.5 / o1 / o3 don't support vision — give zero so they're excluded
    if (id.includes('3.5') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4')) score = 0
  }

  return score
}

/**
 * Fetch vision-capable models for a provider from its API, sorted cheapest/fastest first.
 * Returns an empty array on any error (fail silently — the caller handles graceful degradation).
 * No hardcoded model IDs — the list is always fresh from the provider's models API.
 */
async function fetchVisionModels(provider: string, apiKey: string): Promise<string[]> {
  try {
    let ids: string[] = []

    if (provider === 'gemini') {
      const url = `${GEMINI_API_BASE}/models?key=${apiKey}&pageSize=${GEMINI_MODELS_PAGE_SIZE}`
      const res = await fetchWithTimeout(url, {}, VISION_DISCOVERY_TIMEOUT_MS)
      if (!res.ok) return []
      const data = await res.json() as {
        models?: Array<{ name: string; supportedGenerationMethods?: string[] }>
      }
      ids = (data.models ?? [])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name.replace('models/', ''))
        .filter(id => id.startsWith('gemini-') && !NON_VISION_PATTERN.test(id))
    } else if (provider === 'claude') {
      const res = await fetchWithTimeout(
        `${ANTHROPIC_API_BASE}/v1/models?limit=${ANTHROPIC_MODELS_LIMIT}`,
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_API_VERSION,
            'content-type': 'application/json',
          },
        },
        VISION_DISCOVERY_TIMEOUT_MS,
      )
      if (!res.ok) return []
      const data = await res.json() as { data?: Array<{ id: string }> }
      ids = (data.data ?? [])
        .map(m => m.id)
        .filter(id => id.startsWith('claude') && !NON_VISION_PATTERN.test(id))
    } else if (provider === 'openai') {
      const OpenAI = (await import('openai')).default
      // Pass timeout to the client so models.list() respects VISION_DISCOVERY_TIMEOUT_MS
      const client = new OpenAI({ apiKey, timeout: VISION_DISCOVERY_TIMEOUT_MS })
      const response = await client.models.list()
      ids = response.data
        .map(m => m.id)
        .filter(id => {
          const lower = id.toLowerCase()
          // Only gpt-4+ family supports vision; gpt-3.5 and reasoning models do not
          return lower.startsWith('gpt-4') && !NON_VISION_PATTERN.test(id)
        })
    }

    // R-PRF-02: precompute scores once to avoid O(n log n × 2) calls in sort comparator
    const scored = ids.map(id => ({ id, score: scoreModelForVision(provider, id) }))
    return scored
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.id)
  } catch (err) {
    console.warn(`fetchVisionModels(${provider}) failed, no fallback candidates:`, err)
    return []
  }
}

// DUP-02: Removed local `getApiKey` wrapper — call getStoredApiKey directly.
// HC-06: Gemini base URL now uses GEMINI_API_BASE constant.
// HC-02: Token limits now use MAX_CHAT_OUTPUT_TOKENS constant.

/** Map language codes → human-readable English names for prompts */
const LANG_NAMES: Record<string, string> = {
  auto: 'the detected language',
  vi: 'Vietnamese', en: 'English', zh: 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese', ja: 'Japanese', ko: 'Korean',
  fr: 'French', de: 'German', es: 'Spanish', pt: 'Portuguese',
  ru: 'Russian', ar: 'Arabic', th: 'Thai', id: 'Indonesian',
  it: 'Italian', nl: 'Dutch', pl: 'Polish', tr: 'Turkish', hi: 'Hindi',
}

function langName(code: string): string {
  return LANG_NAMES[code] ?? code
}

interface ImageTranslateParams {
  provider: string
  model: string
  imageBase64: string
  imageMimeType: string
  sourceLang: string
  targetLang: string
}

type ParsedImageTranslateParams =
  | { ok: true; value: ImageTranslateParams }
  | { ok: false; response: { success: false; error: string; errorCode?: string } }

const MAX_IMAGE_MODEL_ID_CHARS = 200

function parseImageTranslateParams(rawParams: unknown): ParsedImageTranslateParams {
  if (!isRecord(rawParams)) {
    return { ok: false, response: invalidIpcInput('Image translate payload must be an object') }
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
  if (model.length > MAX_IMAGE_MODEL_ID_CHARS) {
    return { ok: false, response: invalidIpcInput('Model is too long') }
  }
  if (!isNonEmptyString(rawParams.imageBase64)) {
    return { ok: false, response: invalidIpcInput('No image data provided') }
  }
  if (!isNonEmptyString(rawParams.imageMimeType) || !ALLOWED_IMAGE_MIME_TYPES.has(rawParams.imageMimeType)) {
    return { ok: false, response: invalidIpcInput('Unsupported image MIME type') }
  }
  if (!isSafeLanguageCode(rawParams.sourceLang)) {
    return { ok: false, response: invalidIpcInput('Invalid source language') }
  }
  if (!isSafeLanguageCode(rawParams.targetLang)) {
    return { ok: false, response: invalidIpcInput('Invalid target language') }
  }

  return {
    ok: true,
    value: {
      provider,
      model,
      imageBase64: rawParams.imageBase64,
      imageMimeType: rawParams.imageMimeType,
      sourceLang: rawParams.sourceLang,
      targetLang: rawParams.targetLang,
    },
  }
}

export interface TextRegion {
  x: number        // 0.0–1.0 fraction of image width
  y: number        // 0.0–1.0 fraction of image height
  width: number    // 0.0–1.0 fraction of image width
  height: number   // 0.0–1.0 fraction of image height
  originalText: string
  translatedText: string
  fontSize: number  // 0.0–1.0 fraction of image height
  bgColor: string   // estimated background color hex
  textColor: string // estimated text color hex
}

function buildPrompt(sourceLang: string, targetLang: string): string {
  const sourceName = langName(sourceLang)
  const targetName = langName(targetLang)
  return `You are an expert OCR and translation assistant. Analyze this image and extract ALL visible text, then translate it to ${targetName}.

Step 1 — OCR: Read every piece of visible text in the image in reading order (top-to-bottom, left-to-right). Group lines that belong to the same logical block (e.g. one chat message = one block).

Step 2 — Translate: Translate each text block from ${sourceName} to ${targetName}. Produce natural, fluent ${targetName} — not word-for-word. Preserve the meaning and tone.

Return ONLY a JSON array (no markdown fences, no explanation) using this exact schema:
[
  {
    "x": 0.05,
    "y": 0.10,
    "width": 0.90,
    "height": 0.08,
    "originalText": "original text here",
    "translatedText": "translated text here",
    "fontSize": 0.05,
    "bgColor": "#1a1a1a",
    "textColor": "#ffffff"
  }
]

Rules:
- x, y, width, height are decimal fractions (0.0–1.0) of image dimensions (x=left, y=top)
- Group consecutive lines of the same message/paragraph into ONE region — do NOT split into tiny pieces
- The bounding box must fully cover the original text area (add small padding)
- fontSize = fraction of image height (e.g. 0.04 = 4% of image height)
- bgColor = dominant background color behind the text (hex)
- textColor = color of the text itself (hex)
- translatedText MUST be a complete, high-quality ${targetName} translation — this is the most important field
- If no text is found, return: []
- Return ONLY valid JSON. No extra text.`
}

/**
 * Use Gemini image-generation/editing model to translate text inside the image directly.
 * Returns the base64 of the edited image (with translated text rendered by Gemini).
 * Falls back to null if the model does not return an image part.
 */
async function translateImageWithGeminiEdit(
  apiKey: string,
  imageBase64: string,
  imageMimeType: string,
  sourceLang: string,
  targetLang: string
): Promise<string | null> {
  // R-SEC-02: Whitelist validate MIME type before embedding in JSON request body
  if (!ALLOWED_IMAGE_MIME_TYPES.has(imageMimeType)) {
    throw new Error(`Unsupported image MIME type: ${imageMimeType}`)
  }

  // HC-06: Use GEMINI_API_BASE instead of hardcoded URL prefix
  const url = `${GEMINI_API_BASE}/models/${GEMINI_IMAGE_EDIT_MODEL}:generateContent?key=${apiKey}`
  const sourceName = langName(sourceLang)
  const targetName = langName(targetLang)

  // We call the REST endpoint directly because the JS SDK may not yet expose
  // responseModalities in a typed way for all versions.
  const body = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: imageMimeType,
              data: imageBase64,
            },
          },
          {
            text: `Edit this image: find every piece of ${sourceName} text visible in the image and replace it with a fluent, natural ${targetName} translation. Preserve the original font style, size, color, and background as closely as possible. Only change the text — do not alter any other visual elements. Return the edited image.`,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  }

  // R-REL-03: Use fetchWithTimeout (already defined above) to prevent indefinite hang
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, VISION_DISCOVERY_TIMEOUT_MS)

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini image edit failed: ${res.status} ${errText}`)
  }

  const json = await res.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string
          inline_data?: { mime_type: string; data: string }
        }>
      }
    }>
  }

  const parts = json.candidates?.[0]?.content?.parts ?? []
  for (const part of parts) {
    if (part.inline_data?.data) {
      return part.inline_data.data // base64 of the edited image
    }
  }
  return null
}

async function translateImageWithGemini(
  apiKey: string,
  model: string,
  imageBase64: string,
  imageMimeType: string,
  sourceLang: string,
  targetLang: string
): Promise<TextRegion[]> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const genModel = genAI.getGenerativeModel({ model })

  const result = await genModel.generateContent([
    {
      inlineData: {
        data: imageBase64,
        mimeType: imageMimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
      },
    },
    buildPrompt(sourceLang, targetLang),
  ])

  const text = result.response.text().trim()
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []
  try { return JSON.parse(jsonMatch[0]) as TextRegion[] } catch { return [] }
}

async function translateImageWithClaude(
  apiKey: string,
  model: string,
  imageBase64: string,
  imageMimeType: string,
  sourceLang: string,
  targetLang: string
): Promise<TextRegion[]> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model,
    max_tokens: MAX_CHAT_OUTPUT_TOKENS,  // HC-02
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageMimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: buildPrompt(sourceLang, targetLang),
          },
        ],
      },
    ],
  })

  const block = message.content[0]
  if (block.type !== 'text') return []
  const text = block.text.trim()
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []
  try { return JSON.parse(jsonMatch[0]) as TextRegion[] } catch { return [] }
}

async function translateImageWithOpenAI(
  apiKey: string,
  model: string,
  imageBase64: string,
  imageMimeType: string,
  sourceLang: string,
  targetLang: string
): Promise<TextRegion[]> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })

  // Ensure we use a vision-capable model
  const visionModel = model.includes('o1') || model === 'gpt-3.5-turbo' ? 'gpt-4o' : model

  const completion = await client.chat.completions.create({
    model: visionModel,
    max_completion_tokens: MAX_CHAT_OUTPUT_TOKENS,  // HC-02
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${imageMimeType};base64,${imageBase64}`,
              detail: 'high',
            },
          },
          {
            type: 'text',
            text: buildPrompt(sourceLang, targetLang),
          },
        ],
      },
    ],
  })

  const text = (completion.choices[0]?.message?.content ?? '').trim()
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []
  try { return JSON.parse(jsonMatch[0]) as TextRegion[] } catch { return [] }
}

// ── Exported for unit testing ─────────────────────────────────────────────────
/** @internal — exported for unit tests only */
export {
  buildPrompt as buildImageTranslatePrompt,
  isModelNotFoundError,
  isVisionUnsupportedError,
  langName,
  scoreModelForVision,
}

// ── Provider registry — DUP-04 / DUP-06 ──────────────────────────────────────
// Registry eliminates the switch/case dispatch block and makes the provider
// contract explicit. Per-provider functions remain separate (each SDK is different).

type ImageTranslateFn = (
  apiKey: string, model: string, imageBase64: string, imageMimeType: string,
  sourceLang: string, targetLang: string
) => Promise<TextRegion[]>

const IMAGE_TRANSLATE_PROVIDERS: Record<string, ImageTranslateFn> = {
  gemini: translateImageWithGemini,
  claude: translateImageWithClaude,
  openai: translateImageWithOpenAI,
}

// ─────────────────────────────────────────────────────────────────────────────

export function registerImageTranslateHandlers(ipcMain: IpcMain) {
  ipcMain.handle('image:translate', async (event, rawParams: unknown) => {
    const parsed = parseImageTranslateParams(rawParams)
    if (!parsed.ok) return parsed.response
    const params = parsed.value
    const { provider, model, imageBase64, imageMimeType, sourceLang, targetLang } = params

    if (!imageBase64) {
      return { success: false, error: 'No image data provided' }
    }

    if (provider === 'local') {
      return {
        success: false,
        error: 'Local image translation is not supported in this phase. Use local chat with image input when the selected model supports vision.',
        errorCode: 'NO_VISION',
      }
    }

    // DUP-02 + DUP-03
    const apiKey = getStoredApiKey(provider)
    if (!apiKey) return noApiKeyResponse(provider)

    if (!IMAGE_TRANSLATE_PROVIDERS[provider]) {
      return { success: false, error: `Unknown provider: ${provider}` }
    }

    try {
      // ── Gemini: try image-edit model first for best quality ───────────────
      if (provider === 'gemini') {
        try {
          const editedImageBase64 = await translateImageWithGeminiEdit(
            apiKey, imageBase64, imageMimeType, sourceLang, targetLang
          )
          if (editedImageBase64) {
            return { success: true, editedImageBase64, regions: [] }
          }
        } catch (editErr) {
          console.warn('Gemini image-edit failed, falling back to regions:', editErr)
          // Fall through to OCR+regions approach below
        }
      }

      // ── Smart vision fallback ─────────────────────────────────────────────
      // Strategy:
      //   1. Try user's selected model first (always, regardless of type)
      //   2. On vision/not-found error → fetch available models from the same provider API,
      //      filter vision-capable, sort cheapest/fastest first, try each
      //   3. If all same-provider models fail → try other providers (if key available),
      //      using their dynamically-fetched vision models
      // No hardcoded model IDs — always uses live data from the provider's models API.

      // Start with just the user's model; fallback candidates are fetched lazily on first failure
      const triedModels = new Set<string>()
      let fallbacksFetched = false
      const candidates: Array<{ p: string; m: string }> = [{ p: provider, m: model }]

      let regions: TextRegion[] = []
      let usedModel = model
      let usedProvider = provider
      let succeeded = false

      for (let i = 0; i < candidates.length; i++) {
        const { p, m } = candidates[i]
        const candidateKey = `${p}/${m}`
        if (triedModels.has(candidateKey)) continue
        triedModels.add(candidateKey)

        const fn = IMAGE_TRANSLATE_PROVIDERS[p]
        if (!fn) continue
        const key = p === provider ? apiKey : getStoredApiKey(p)
        if (!key) continue

        // Notify renderer immediately when switching to a fallback model/provider
        if (m !== model || p !== provider) {
          event.sender.send('image:model-switched', { model: m, provider: p })
          console.info(`Image translate: switching to ${p}/${m} (requested: ${provider}/${model})`)
        }

        try {
          regions = await fn(key, m, imageBase64, imageMimeType, sourceLang, targetLang)
          usedModel = m
          usedProvider = p
          succeeded = true
          break
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          const retryable = isVisionUnsupportedError(msg) || isModelNotFoundError(msg)

          if (!retryable) {
            // Non-retryable error (auth, rate-limit, network) → stop immediately
            throw err
          }

          console.warn(`Image translate: ${p}/${m} failed (${retryable ? 'retryable' : 'fatal'}): ${msg.slice(0, 120)}`)

          // Lazily fetch fallback candidates on first retryable failure
          if (!fallbacksFetched) {
            fallbacksFetched = true

            // Same-provider fallbacks: fetch vision models from provider API
            const sameProviderModels = await fetchVisionModels(provider, apiKey)
            for (const fb of sameProviderModels) {
              if (fb !== model) candidates.push({ p: provider, m: fb })
            }

            // Cross-provider fallbacks: fetch all other providers in parallel (R-PRF-02)
            const otherProviders = Object.keys(IMAGE_TRANSLATE_PROVIDERS)
              .filter(op => op !== provider)
              .map(op => ({ op, key: getStoredApiKey(op) }))
              .filter((x): x is { op: string; key: string } => !!x.key)

            const crossResults = await Promise.all(
              otherProviders.map(({ op, key }) =>
                fetchVisionModels(op, key).then(models => ({ op, models }))
              )
            )
            for (const { op, models } of crossResults) {
              if (models.length > 0) candidates.push({ p: op, m: models[0] })
            }
          }
          // Continue loop — next iteration picks the next candidate
        }
      }

      if (!succeeded) {
        return {
          success: false,
          error: 'No vision-capable model available. Please select a vision-capable model (e.g. gemini-2.0-flash, gpt-4o, claude-3-5-haiku).',
          errorCode: 'NO_VISION',
        }
      }

      const switched = usedModel !== model || usedProvider !== provider
      return {
        success: true,
        regions,
        ...(switched ? { usedModel, usedProvider } : {}),
      }
    } catch (error: unknown) {
      console.error(`Image translation error with ${provider}:`, error)
      const msg = error instanceof Error ? error.message : String(error)
      // DUP-01: use classifyProviderError for standard error categorization
      return classifyProviderError(msg)
    }
  })
}
