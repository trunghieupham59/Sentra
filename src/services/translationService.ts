/**
 * Translation service — thin wrapper over window.api IPC calls.
 *
 * Centralizes all translation-related API calls in one place, decoupling
 * pages from the IPC interface. If the IPC protocol changes, only this file
 * needs to be updated — not every page that calls window.api directly.
 *
 * Usage:
 *   import { translationService } from '../services/translationService'
 *   const result = await translationService.translate({ ... })
 */
import type { TranslateParams, ImageTranslateResult, TranslateResult } from '../types'
import type { TranslationStyle } from '../types'

export interface TranslateImageParams {
  provider: string
  model: string
  imageBase64: string
  imageMimeType: string
  sourceLang: string
  targetLang: string
}

export interface RewriteParams {
  provider: string
  model: string
  text: string
  lang: string
  translationStyle?: TranslationStyle
}

export const translationService = {
  /** Translate text — supports chunking for long documents. */
  translate: (params: TranslateParams): Promise<TranslateResult> =>
    window.api.translate(params),

  /** Translate text inside an image — returns regions or edited image. */
  translateImage: (params: TranslateImageParams): Promise<ImageTranslateResult> =>
    window.api.translateImage(params),

  /** Rewrite text to sound more natural in its own language. */
  rewriteText: (params: RewriteParams): Promise<TranslateResult> =>
    window.api.rewriteText(params),

  /** Verify an API key with a minimal test request. */
  verifyKey: (provider: string, apiKey: string) =>
    window.api.verifyKey(provider, apiKey),
}
