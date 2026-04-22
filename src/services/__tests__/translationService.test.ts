/**
 * Unit tests for src/services/translationService.ts
 *
 * translationService is a thin wrapper over window.api IPC calls.
 * Tests verify that each method delegates to the correct window.api function
 * with the correct parameters, and passes results through unchanged.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { translationService } from '../translationService'

// ── Mock window.api ───────────────────────────────────────────────────────────
const mockApi = {
  translate: vi.fn(),
  translateImage: vi.fn(),
  rewriteText: vi.fn(),
  verifyKey: vi.fn(),
  detectLanguage: vi.fn(),
}

// Inject into global window before imports resolve
// biome-ignore lint/suspicious/noExplicitAny: test global setup
;(globalThis as any).window = { api: mockApi }

// ─────────────────────────────────────────────────────────────────────────────

const BASE_TRANSLATE_PARAMS = {
  provider: 'gemini' as const,
  model: 'gemini-2.0-flash',
  sourceText: 'Hello',
  sourceLang: 'en',
  targetLang: 'vi',
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
describe('translationService.translate', () => {
  it('delegates to window.api.translate with the given params', async () => {
    mockApi.translate.mockResolvedValueOnce({ success: true, translatedText: 'Xin chào' })

    const result = await translationService.translate(BASE_TRANSLATE_PARAMS)

    expect(mockApi.translate).toHaveBeenCalledOnce()
    expect(mockApi.translate).toHaveBeenCalledWith(BASE_TRANSLATE_PARAMS)
    expect(result.success).toBe(true)
    expect((result as { translatedText?: string }).translatedText).toBe('Xin chào')
  })

  it('passes through failure response unchanged', async () => {
    mockApi.translate.mockResolvedValueOnce({ success: false, error: 'Rate limit', errorCode: 'RATE_LIMIT' })

    const result = await translationService.translate(BASE_TRANSLATE_PARAMS)

    expect(result.success).toBe(false)
    expect((result as { error?: string }).error).toBe('Rate limit')
  })

  it('passes translation style and showFurigana when provided', async () => {
    mockApi.translate.mockResolvedValueOnce({ success: true, translatedText: 'result' })

    const params = { ...BASE_TRANSLATE_PARAMS, translationStyle: 'friendly' as const, showFurigana: true }
    await translationService.translate(params)

    expect(mockApi.translate).toHaveBeenCalledWith(params)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('translationService.rewriteText', () => {
  it('delegates to window.api.rewriteText', async () => {
    mockApi.rewriteText.mockResolvedValueOnce({ success: true, translatedText: 'Natural text' })

    const result = await translationService.rewriteText({
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      text: 'Original text',
      lang: 'vi',
    })

    expect(mockApi.rewriteText).toHaveBeenCalledOnce()
    expect(result.success).toBe(true)
  })

  it('passes translation style through to window.api.rewriteText', async () => {
    mockApi.rewriteText.mockResolvedValueOnce({ success: true, translatedText: 'result' })

    const params = { provider: 'openai', model: 'gpt-4o', text: 'text', lang: 'en', translationStyle: 'technical' as const }
    await translationService.rewriteText(params)

    expect(mockApi.rewriteText).toHaveBeenCalledWith(params)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('translationService.verifyKey', () => {
  it('delegates to window.api.verifyKey with provider and apiKey', async () => {
    mockApi.verifyKey.mockResolvedValueOnce({ success: true })

    await translationService.verifyKey('gemini', 'my-api-key')

    expect(mockApi.verifyKey).toHaveBeenCalledWith('gemini', 'my-api-key')
  })

  it('passes through INVALID_KEY response', async () => {
    mockApi.verifyKey.mockResolvedValueOnce({ success: false, errorCode: 'INVALID_KEY', error: 'Invalid API key' })

    const result = await translationService.verifyKey('openai', 'bad-key')
    expect(result.success).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('translationService.detectLanguage', () => {
  it('delegates to window.api.detectLanguage', async () => {
    mockApi.detectLanguage.mockResolvedValueOnce({ success: true, lang: 'vi' })

    const result = await translationService.detectLanguage({
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      text: 'Xin chào',
    })

    expect(mockApi.detectLanguage).toHaveBeenCalledOnce()
    expect(result.success).toBe(true)
    expect((result as { lang?: string }).lang).toBe('vi')
  })

  it('passes through failure when text is too short or detection fails', async () => {
    mockApi.detectLanguage.mockResolvedValueOnce({ success: false, error: 'Detection call failed' })

    const result = await translationService.detectLanguage({
      provider: 'gemini', model: 'gemini-2.0-flash', text: 'Hi',
    })

    expect(result.success).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('translationService.translateImage', () => {
  it('delegates to window.api.translateImage', async () => {
    mockApi.translateImage.mockResolvedValueOnce({ success: true, regions: [] })

    const params = {
      provider: 'gemini', model: 'gemini-2.0-flash',
      imageBase64: 'base64data', imageMimeType: 'image/png',
      sourceLang: 'en', targetLang: 'vi',
    }
    await translationService.translateImage(params)

    expect(mockApi.translateImage).toHaveBeenCalledWith(params)
  })
})
