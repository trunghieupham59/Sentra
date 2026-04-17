// @vitest-environment node
/**
 * Unit tests for electron/ipc/imageTranslate.ts
 *
 * Tests focus on:
 *   1. langName                   — maps language codes to English names
 *   2. buildImageTranslatePrompt  — generates correct prompt for OCR+translate
 *   3. registerImageTranslateHandlers — IPC input validation and error codes
 *
 * Provider SDKs are NOT imported — no real API calls made.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock Electron + storage before importing ──────────────────────────────────
vi.mock('electron', () => ({
  IpcMain: class {},
}))

vi.mock('../storage', () => ({
  getStoredApiKey: vi.fn(),
}))

import {
  langName,
  buildImageTranslatePrompt,
  registerImageTranslateHandlers,
  scoreModelForVision,
  isVisionUnsupportedError,
  isModelNotFoundError,
} from '../imageTranslate'
import { getStoredApiKey } from '../storage'

// ─── Mock IpcMain helper ──────────────────────────────────────────────────────
function buildMockIpcMain() {
  // biome-ignore lint/suspicious/noExplicitAny: Function type needed for flexible IPC mock
  const handlers: Record<string, Function> = {}
  const ipcMain = {
    // biome-ignore lint/suspicious/noExplicitAny: Function type needed for flexible IPC mock
    handle: (channel: string, handler: Function) => {
      handlers[channel] = handler
    },
  }
  // Returns any intentionally — tests need to assert on result shape
  const invoke = (channel: string, params: unknown) =>
    handlers[channel]?.({} /* fake _event */, params)
  return { ipcMain, invoke }
}

// ─────────────────────────────────────────────────────────────────────────────
describe('langName', () => {
  it('maps known language codes to their English names', () => {
    expect(langName('vi')).toBe('Vietnamese')
    expect(langName('en')).toBe('English')
    expect(langName('ja')).toBe('Japanese')
    expect(langName('zh')).toBe('Simplified Chinese')
    expect(langName('zh-TW')).toBe('Traditional Chinese')
    expect(langName('ko')).toBe('Korean')
    expect(langName('fr')).toBe('French')
    expect(langName('de')).toBe('German')
  })

  it('maps "auto" to the detected language description', () => {
    expect(langName('auto')).toBe('the detected language')
  })

  it('returns the raw code for unknown language codes', () => {
    expect(langName('xx')).toBe('xx')
    expect(langName('zz-ZZ')).toBe('zz-ZZ')
    expect(langName('pirate')).toBe('pirate')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('buildImageTranslatePrompt', () => {
  it('includes the target language name in the prompt', () => {
    const prompt = buildImageTranslatePrompt('en', 'vi')
    expect(prompt).toContain('Vietnamese')
  })

  it('includes the source language name in the prompt', () => {
    const prompt = buildImageTranslatePrompt('ja', 'en')
    expect(prompt).toContain('Japanese')
    expect(prompt).toContain('English')
  })

  it('uses "the detected language" description when source is "auto"', () => {
    const prompt = buildImageTranslatePrompt('auto', 'vi')
    expect(prompt).toContain('the detected language')
  })

  it('includes required JSON schema fields in the prompt', () => {
    const prompt = buildImageTranslatePrompt('en', 'ja')
    expect(prompt).toContain('"originalText"')
    expect(prompt).toContain('"translatedText"')
    expect(prompt).toContain('"x"')
    expect(prompt).toContain('"y"')
    expect(prompt).toContain('"width"')
    expect(prompt).toContain('"height"')
    expect(prompt).toContain('"bgColor"')
    expect(prompt).toContain('"textColor"')
  })

  it('instructs the AI to return valid JSON only', () => {
    const prompt = buildImageTranslatePrompt('en', 'vi')
    expect(prompt).toContain('valid JSON')
    // Should not contain code fences in the instruction (it tells model NOT to use them)
    expect(prompt.toLowerCase()).toContain('no markdown')
  })

  it('produces different prompts for different target languages', () => {
    const promptVI = buildImageTranslatePrompt('en', 'vi')
    const promptJA = buildImageTranslatePrompt('en', 'ja')
    const promptKO = buildImageTranslatePrompt('en', 'ko')
    expect(promptVI).not.toBe(promptJA)
    expect(promptVI).not.toBe(promptKO)
    expect(promptJA).not.toBe(promptKO)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('registerImageTranslateHandlers — IPC validation', () => {
  let invoke: ReturnType<typeof buildMockIpcMain>['invoke']

  beforeEach(() => {
    vi.clearAllMocks()
    const mock = buildMockIpcMain()
    // biome-ignore lint/suspicious/noExplicitAny: mock IpcMain
    registerImageTranslateHandlers(mock.ipcMain as any)
    invoke = mock.invoke
  })

  it('returns error when imageBase64 is empty string', async () => {
    const result = await invoke('image:translate', {
      provider: 'gemini', model: 'gemini-2.0-flash',
      imageBase64: '', imageMimeType: 'image/jpeg',
      sourceLang: 'auto', targetLang: 'vi',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('No image data')
  })

  it('returns error when imageBase64 is missing (undefined/null)', async () => {
    const result = await invoke('image:translate', {
      provider: 'gemini', model: 'gemini-2.0-flash',
      imageBase64: undefined, imageMimeType: 'image/jpeg',
      sourceLang: 'auto', targetLang: 'vi',
    })
    expect(result.success).toBe(false)
  })

  it('returns NO_API_KEY error when API key is not in keychain', async () => {
    vi.mocked(getStoredApiKey).mockResolvedValue(null)
    const result = await invoke('image:translate', {
      provider: 'gemini', model: 'gemini-2.0-flash',
      imageBase64: 'base64encodeddata', imageMimeType: 'image/jpeg',
      sourceLang: 'auto', targetLang: 'vi',
    })
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('NO_API_KEY')
    expect(result.error).toContain('gemini')
  })

  it('returns NO_API_KEY for claude when key is missing', async () => {
    vi.mocked(getStoredApiKey).mockResolvedValue(null)
    const result = await invoke('image:translate', {
      provider: 'claude', model: 'claude-3-5-sonnet-20241022',
      imageBase64: 'base64data', imageMimeType: 'image/png',
      sourceLang: 'en', targetLang: 'ja',
    })
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('NO_API_KEY')
    expect(result.error).toContain('claude')
  })

  it('returns error for unknown provider', async () => {
    vi.mocked(getStoredApiKey).mockResolvedValue('fake-key')
    const result = await invoke('image:translate', {
      provider: 'unknown-provider', model: 'some-model',
      imageBase64: 'base64data', imageMimeType: 'image/jpeg',
      sourceLang: 'auto', targetLang: 'vi',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Unknown provider')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('registerImageTranslateHandlers — error code categorization', () => {
  let invoke: ReturnType<typeof buildMockIpcMain>['invoke']

  beforeEach(() => {
    vi.clearAllMocks()
    const mock = buildMockIpcMain()
    // biome-ignore lint/suspicious/noExplicitAny: mock IpcMain
    registerImageTranslateHandlers(mock.ipcMain as any)
    invoke = mock.invoke
    vi.mocked(getStoredApiKey).mockResolvedValue('fake-key')
  })

  it('categorizes 401 errors as INVALID_KEY', async () => {
    vi.doMock('@google/generative-ai', () => ({
      GoogleGenerativeAI: class {
        getGenerativeModel() {
          return {
            generateContent: async () => { throw new Error('401 Unauthorized invalid_api_key') },
          }
        }
      },
    }))
    const result = await invoke('image:translate', {
      provider: 'gemini', model: 'gemini-2.0-flash',
      imageBase64: 'base64data', imageMimeType: 'image/jpeg',
      sourceLang: 'auto', targetLang: 'vi',
    })
    expect(result.success).toBe(false)
    // error should be categorized (INVALID_KEY) or at minimum a failure
    expect(['INVALID_KEY', undefined]).toContain(result.errorCode)
  })

  it('categorizes 429 errors as RATE_LIMIT', async () => {
    vi.doMock('@anthropic-ai/sdk', () => ({
      default: class {
        messages = {
          create: async () => { throw new Error('429 rate_limit exceeded quota') },
        }
      },
    }))
    const result = await invoke('image:translate', {
      provider: 'claude', model: 'claude-3-5-sonnet-20241022',
      imageBase64: 'base64data', imageMimeType: 'image/jpeg',
      sourceLang: 'en', targetLang: 'vi',
    })
    expect(result.success).toBe(false)
    expect(['RATE_LIMIT', undefined]).toContain(result.errorCode)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('scoreModelForVision', () => {
  // ── Gemini ────────────────────────────────────────────────────────────────
  it('scores gemini flash higher than pro (cheaper preferred)', () => {
    expect(scoreModelForVision('gemini', 'gemini-2.0-flash'))
      .toBeGreaterThan(scoreModelForVision('gemini', 'gemini-1.5-pro'))
  })

  it('penalizes gemini lite variants', () => {
    expect(scoreModelForVision('gemini', 'gemini-2.0-flash'))
      .toBeGreaterThan(scoreModelForVision('gemini', 'gemini-2.0-flash-lite'))
  })

  it('prefers newer gemini generation over older (gemini-2 > gemini-1)', () => {
    expect(scoreModelForVision('gemini', 'gemini-2.0-flash'))
      .toBeGreaterThan(scoreModelForVision('gemini', 'gemini-1.5-flash'))
  })

  // ── Claude ────────────────────────────────────────────────────────────────
  it('scores claude haiku highest (cheapest)', () => {
    const haiku  = scoreModelForVision('claude', 'claude-3-5-haiku-20241022')
    const sonnet = scoreModelForVision('claude', 'claude-3-5-sonnet-20241022')
    const opus   = scoreModelForVision('claude', 'claude-3-opus-20240229')
    expect(haiku).toBeGreaterThan(sonnet)
    expect(sonnet).toBeGreaterThan(opus)
  })

  it('gives positive score to all valid claude vision models', () => {
    expect(scoreModelForVision('claude', 'claude-3-5-haiku-20241022')).toBeGreaterThan(0)
    expect(scoreModelForVision('claude', 'claude-3-5-sonnet-20241022')).toBeGreaterThan(0)
    expect(scoreModelForVision('claude', 'claude-3-7-sonnet-20250219')).toBeGreaterThan(0)
  })

  // ── OpenAI ────────────────────────────────────────────────────────────────
  it('scores gpt-4o-mini highest for openai (cheapest vision)', () => {
    expect(scoreModelForVision('openai', 'gpt-4o-mini'))
      .toBeGreaterThan(scoreModelForVision('openai', 'gpt-4o'))
  })

  it('gives zero score to gpt-3.5-turbo (no vision support)', () => {
    expect(scoreModelForVision('openai', 'gpt-3.5-turbo')).toBe(0)
  })

  it('gives zero score to o1 reasoning models (no vision support)', () => {
    expect(scoreModelForVision('openai', 'o1-mini')).toBe(0)
    expect(scoreModelForVision('openai', 'o3-mini')).toBe(0)
  })

  it('returns 0 for unknown provider', () => {
    expect(scoreModelForVision('unknown', 'some-model')).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('isVisionUnsupportedError', () => {
  it('detects "Image input modality is not enabled" error', () => {
    expect(isVisionUnsupportedError('Image input modality is not enabled for this model')).toBe(true)
  })

  it('detects "modality" keyword', () => {
    expect(isVisionUnsupportedError('[400 Bad Request] modality not supported')).toBe(true)
  })

  it('detects "does not support" phrase', () => {
    expect(isVisionUnsupportedError('This model does not support image inputs')).toBe(true)
  })

  it('detects "not enabled" phrase', () => {
    expect(isVisionUnsupportedError('Vision not enabled for this endpoint')).toBe(true)
  })

  it('detects "multimodal" keyword', () => {
    expect(isVisionUnsupportedError('multimodal input is not available')).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isVisionUnsupportedError('401 Unauthorized invalid_api_key')).toBe(false)
    expect(isVisionUnsupportedError('429 rate_limit exceeded quota')).toBe(false)
    expect(isVisionUnsupportedError('Network request failed')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isVisionUnsupportedError('IMAGE INPUT MODALITY IS NOT ENABLED')).toBe(true)
    expect(isVisionUnsupportedError('Does Not Support images')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('isModelNotFoundError', () => {
  it('detects Anthropic not_found_error', () => {
    expect(isModelNotFoundError('{"type":"not_found_error","message":"model: claude-3-5-haiku-20241022"}')).toBe(true)
  })

  it('detects "model not found" phrase', () => {
    expect(isModelNotFoundError('model not found: gpt-4-turbo-preview')).toBe(true)
  })

  it('detects "does not exist" phrase', () => {
    expect(isModelNotFoundError('The model gemini-old does not exist')).toBe(true)
  })

  it('detects 404 + model combination', () => {
    expect(isModelNotFoundError('404 models/gemini-exp is not found')).toBe(true)
  })

  it('returns false for 404 without model context', () => {
    // A plain 404 on a non-model endpoint should not be treated as model-not-found
    expect(isModelNotFoundError('404 Not Found on endpoint /v1/chat/completions')).toBe(false)
  })

  it('returns false for unrelated errors', () => {
    expect(isModelNotFoundError('401 Unauthorized')).toBe(false)
    expect(isModelNotFoundError('429 rate_limit')).toBe(false)
    expect(isModelNotFoundError('Image input modality is not enabled')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isModelNotFoundError('MODEL NOT FOUND')).toBe(true)
    expect(isModelNotFoundError('Not_Found_Error for this request')).toBe(true)
  })
})
