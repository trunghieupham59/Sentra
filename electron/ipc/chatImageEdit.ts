/**
 * Chat image-edit module — orchestrates image generation/edit calls to the
 * two providers that support it: OpenAI (`gpt-image-1`) and Gemini
 * (image-output models).
 *
 * Responsibilities:
 *   - IPC payload validation for `chat:image-edit`
 *   - Provider-specific request building + retries (e.g. fallback Gemini model)
 *   - Result normalisation into `ChatImageEditResultPayload`
 *
 * The IPC channel registration lives in chat.ts; this module exports the
 * pure functions and the validated `parseChatImageEditParams` helper that the
 * handler calls.
 */
import {
  CHAT_IMAGE_EDIT_DEFAULT_MIME_TYPE,
  CHAT_IMAGE_EDIT_EXTENSION_BY_MIME,
  CHAT_IMAGE_EDIT_FILE_BASENAME,
  CHAT_IMAGE_EDIT_JSON_CONTENT_TYPE,
  CHAT_IMAGE_EDIT_RESPONSE_MODALITIES,
  CHAT_IMAGE_EDIT_SUPPORTED_MIME_TYPES,
  GEMINI_IMAGE_MODEL_RETRY_ERROR_MARKERS,
  MAX_CHAT_IMAGE_EDIT_MODEL_ID_CHARS,OPENAI_IMAGE_EDIT_OPTIONS 
} from './chatConfig'
import { CHAT_IMAGE_EDIT_VALIDATION_MESSAGES, CHAT_RUNTIME_MESSAGES } from './chatMessages'
import { buildChatImageEditPrompt } from './chatPrompts'
import {
  CHAT_IMAGE_EDIT_TIMEOUT_MS,
  GEMINI_API_BASE,
  GEMINI_IMAGE_EDIT_MODELS,
  MAX_CHAT_REQUEST_CHARS,
  OPENAI_IMAGE_EDIT_MODEL,
} from './ipcConstants'
import { invalidIpcInput, isNonEmptyString, isRecord } from './ipcValidation'
import type {
  ChatImageEditFn,
  ChatImageEditResultPayload,
} from './providers/chatProviderTypes'
import { isValidProvider, unknownProviderError } from './providers/types'

// ── IPC payload typing ───────────────────────────────────────────────────────

export interface ChatImageEditParams {
  provider: string
  model: string
  prompt: string
  imageBase64: string
  imageMimeType: string
}

export type ParsedChatImageEditParams =
  | { ok: true; value: ChatImageEditParams }
  | { ok: false; response: { success: false; error: string; errorCode?: string } }

/**
 * Validate the renderer-supplied `chat:image-edit` payload.
 *
 * Performs structural + size checks; downstream provider code can therefore
 * trust the shape and concentrate on SDK semantics.
 */
export function parseChatImageEditParams(rawParams: unknown): ParsedChatImageEditParams {
  if (!isRecord(rawParams)) {
    return { ok: false, response: invalidIpcInput(CHAT_IMAGE_EDIT_VALIDATION_MESSAGES.payloadMustBeObject) }
  }

  if (!isNonEmptyString(rawParams.provider)) {
    return { ok: false, response: invalidIpcInput(CHAT_IMAGE_EDIT_VALIDATION_MESSAGES.providerRequired) }
  }
  const provider = rawParams.provider.trim()
  if (!isValidProvider(provider)) {
    return { ok: false, response: unknownProviderError(provider) }
  }

  if (!isNonEmptyString(rawParams.model)) {
    return { ok: false, response: invalidIpcInput(CHAT_IMAGE_EDIT_VALIDATION_MESSAGES.modelRequired) }
  }
  const model = rawParams.model.trim()
  if (model.length > MAX_CHAT_IMAGE_EDIT_MODEL_ID_CHARS) {
    return { ok: false, response: invalidIpcInput(CHAT_IMAGE_EDIT_VALIDATION_MESSAGES.modelTooLong) }
  }

  if (!isNonEmptyString(rawParams.prompt)) {
    return { ok: false, response: invalidIpcInput(CHAT_IMAGE_EDIT_VALIDATION_MESSAGES.promptRequired) }
  }
  const prompt = rawParams.prompt.trim()
  if (prompt.length > MAX_CHAT_REQUEST_CHARS) {
    return {
      ok: false,
      response: invalidIpcInput(CHAT_IMAGE_EDIT_VALIDATION_MESSAGES.promptTooLong(MAX_CHAT_REQUEST_CHARS)),
    }
  }

  if (!isNonEmptyString(rawParams.imageBase64)) {
    return { ok: false, response: invalidIpcInput(CHAT_IMAGE_EDIT_VALIDATION_MESSAGES.noImageData) }
  }
  if (
    !isNonEmptyString(rawParams.imageMimeType) ||
    !CHAT_IMAGE_EDIT_SUPPORTED_MIME_TYPES.has(rawParams.imageMimeType)
  ) {
    return { ok: false, response: invalidIpcInput(CHAT_IMAGE_EDIT_VALIDATION_MESSAGES.unsupportedImageMimeType) }
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function getImageFileNameForMime(mimeType: string): string {
  const ext = CHAT_IMAGE_EDIT_EXTENSION_BY_MIME[mimeType] ?? mimeType.replace('image/', '')
  return `${CHAT_IMAGE_EDIT_FILE_BASENAME}.${ext}`
}

async function convertRemoteImageUrlToBase64(url: string): Promise<{ imageBase64: string; imageMimeType: string }> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(CHAT_RUNTIME_MESSAGES.openAiImageUrlDownloadFailed(response.status))
  }

  const contentType = response.headers.get('content-type') ?? CHAT_IMAGE_EDIT_DEFAULT_MIME_TYPE
  const imageMimeType = contentType.split(';')[0] || CHAT_IMAGE_EDIT_DEFAULT_MIME_TYPE
  const buffer = Buffer.from(await response.arrayBuffer())
  return { imageBase64: buffer.toString('base64'), imageMimeType }
}

// ── OpenAI image edit ────────────────────────────────────────────────────────

export async function editChatImageWithOpenAI(
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
    ...OPENAI_IMAGE_EDIT_OPTIONS,
  })
  const result = response.data?.[0]

  if (result?.b64_json) {
    return {
      imageBase64: result.b64_json,
      imageMimeType: CHAT_IMAGE_EDIT_DEFAULT_MIME_TYPE,
      usedModel: OPENAI_IMAGE_EDIT_MODEL,
    }
  }

  if (result?.url) {
    const downloaded = await convertRemoteImageUrlToBase64(result.url)
    return { ...downloaded, usedModel: OPENAI_IMAGE_EDIT_MODEL }
  }

  throw new Error(CHAT_RUNTIME_MESSAGES.openAiNoEditedImage)
}

// ── Gemini image edit (with model fallback ladder) ───────────────────────────

type GeminiInlineDataPart = {
  text?: string
  inline_data?: { mime_type?: string; data?: string }
  inlineData?: { mimeType?: string; data?: string }
}

function shouldTryNextGeminiImageModel(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return GEMINI_IMAGE_MODEL_RETRY_ERROR_MARKERS.some((marker) => msg.includes(marker))
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
      responseModalities: CHAT_IMAGE_EDIT_RESPONSE_MODALITIES,
    },
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CHAT_IMAGE_EDIT_TIMEOUT_MS)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': CHAT_IMAGE_EDIT_JSON_CONTENT_TYPE,
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timer))

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(CHAT_RUNTIME_MESSAGES.geminiImageEditFailed(response.status, errorText))
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
        imageMimeType: outputMimeType ?? CHAT_IMAGE_EDIT_DEFAULT_MIME_TYPE,
        usedModel: imageModel,
      }
    }
  }

  const text = parts.map((part) => part.text).filter(Boolean).join('\n').trim()
  throw new Error(
    text ? CHAT_RUNTIME_MESSAGES.geminiTextWithoutImage(text) : CHAT_RUNTIME_MESSAGES.geminiNoEditedImage
  )
}

export async function editChatImageWithGemini(
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

// ── Provider registry for image edit ─────────────────────────────────────────

/**
 * Provider → image-edit-fn registry. Only providers whose key is present
 * advertise image edit support; others return `NO_IMAGE_EDIT` from the IPC
 * handler.
 */
export const CHAT_IMAGE_EDIT_PROVIDERS: Record<string, ChatImageEditFn> = {
  gemini: editChatImageWithGemini,
  openai: editChatImageWithOpenAI,
}

// ── Image generation (text-to-image, no input image) ─────────────────────────

export type ChatImageGenerateFn = (
  apiKey: string,
  model: string,
  prompt: string,
) => Promise<ChatImageEditResultPayload>

export async function generateChatImageWithOpenAI(
  apiKey: string,
  _model: string,
  prompt: string,
): Promise<ChatImageEditResultPayload> {
  const openaiModule = await import('openai')
  const OpenAI = openaiModule.default
  const client = new OpenAI({ apiKey, timeout: CHAT_IMAGE_EDIT_TIMEOUT_MS })

  const response = await client.images.generate({
    model: OPENAI_IMAGE_EDIT_MODEL,
    prompt,
    ...OPENAI_IMAGE_EDIT_OPTIONS,
  })
  const result = response.data?.[0]

  if (result?.b64_json) {
    return {
      imageBase64: result.b64_json,
      imageMimeType: CHAT_IMAGE_EDIT_DEFAULT_MIME_TYPE,
      usedModel: OPENAI_IMAGE_EDIT_MODEL,
    }
  }

  if (result?.url) {
    const downloaded = await convertRemoteImageUrlToBase64(result.url)
    return { ...downloaded, usedModel: OPENAI_IMAGE_EDIT_MODEL }
  }

  throw new Error(CHAT_RUNTIME_MESSAGES.openAiNoEditedImage)
}

async function requestGeminiImageGenerate(
  apiKey: string,
  imageModel: string,
  prompt: string,
): Promise<ChatImageEditResultPayload> {
  const url = `${GEMINI_API_BASE}/models/${imageModel}:generateContent`
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: CHAT_IMAGE_EDIT_RESPONSE_MODALITIES },
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CHAT_IMAGE_EDIT_TIMEOUT_MS)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': CHAT_IMAGE_EDIT_JSON_CONTENT_TYPE,
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timer))

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(CHAT_RUNTIME_MESSAGES.geminiImageEditFailed(response.status, errorText))
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
        imageMimeType: outputMimeType ?? CHAT_IMAGE_EDIT_DEFAULT_MIME_TYPE,
        usedModel: imageModel,
      }
    }
  }

  const text = parts.map((part) => part.text).filter(Boolean).join('\n').trim()
  throw new Error(
    text ? CHAT_RUNTIME_MESSAGES.geminiTextWithoutImage(text) : CHAT_RUNTIME_MESSAGES.geminiNoEditedImage
  )
}

export async function generateChatImageWithGemini(
  apiKey: string,
  _model: string,
  prompt: string,
): Promise<ChatImageEditResultPayload> {
  let lastError: unknown
  for (const imageModel of GEMINI_IMAGE_EDIT_MODELS) {
    try {
      return await requestGeminiImageGenerate(apiKey, imageModel, prompt)
    } catch (error) {
      lastError = error
      if (!shouldTryNextGeminiImageModel(error)) break
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

/** Provider → image-generate-fn registry (text-to-image). */
export const CHAT_IMAGE_GENERATE_PROVIDERS: Record<string, ChatImageGenerateFn> = {
  gemini: generateChatImageWithGemini,
  openai: generateChatImageWithOpenAI,
}
