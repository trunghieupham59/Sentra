import { IpcMain } from 'electron'
import { getStoredApiKey } from './storage'

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

async function getApiKey(provider: string): Promise<string | null> {
  return getStoredApiKey(provider)
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
  // Use the dedicated image-generation model
  const editModel = 'gemini-2.0-flash-exp-image-generation'
  const sourceName = langName(sourceLang)
  const targetName = langName(targetLang)

  // We call the REST endpoint directly because the JS SDK may not yet expose
  // responseModalities in a typed way for all versions.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${editModel}:generateContent?key=${apiKey}`

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

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

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
    max_tokens: 4096,
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
    max_completion_tokens: 4096,
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
export { langName, buildPrompt as buildImageTranslatePrompt }

// ─────────────────────────────────────────────────────────────────────────────

export function registerImageTranslateHandlers(ipcMain: IpcMain) {
  ipcMain.handle('image:translate', async (_event, params: ImageTranslateParams) => {
    const { provider, model, imageBase64, imageMimeType, sourceLang, targetLang } = params

    if (!imageBase64) {
      return { success: false, error: 'No image data provided' }
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

      let regions: TextRegion[] = []

      switch (provider) {
        case 'gemini':
          regions = await translateImageWithGemini(apiKey, model, imageBase64, imageMimeType, sourceLang, targetLang)
          break
        case 'claude':
          regions = await translateImageWithClaude(apiKey, model, imageBase64, imageMimeType, sourceLang, targetLang)
          break
        case 'openai':
          regions = await translateImageWithOpenAI(apiKey, model, imageBase64, imageMimeType, sourceLang, targetLang)
          break
        default:
          return { success: false, error: `Unknown provider: ${provider}` }
      }

      return { success: true, regions }
    } catch (error: unknown) {
      console.error(`Image translation error with ${provider}:`, error)
      const msg = error instanceof Error ? error.message : String(error)

      if (msg.includes('401') || msg.includes('invalid_api_key') || msg.includes('authentication')) {
        return { success: false, error: 'Invalid API key. Please check your key in Settings.', errorCode: 'INVALID_KEY' }
      }
      if (msg.includes('429') || msg.includes('rate_limit') || msg.includes('quota')) {
        return { success: false, error: 'Rate limit exceeded. Please wait and try again.', errorCode: 'RATE_LIMIT' }
      }
      if (msg.includes('vision') || msg.includes('image') || msg.includes('multimodal')) {
        return { success: false, error: 'The selected model does not support image input. Please use a vision-capable model (e.g. gpt-4o, gemini-1.5-flash, claude-3).', errorCode: 'NO_VISION' }
      }
      return { success: false, error: `Image translation failed: ${msg}` }
    }
  })
}
