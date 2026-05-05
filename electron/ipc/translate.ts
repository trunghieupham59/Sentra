import type { IpcMain } from 'electron'
import { classifyProviderError, noApiKeyResponse } from './errorUtils'
import { DETECT_LANG_MAX_CHARS } from './ipcConstants'
import { isNonEmptyString, isRecord } from './ipcValidation'
import { isLocalProvider, LOCAL_AI_PLACEHOLDER_KEY } from './localAi'
import { isAbortError } from './providers/chatProviderTypes'
import { isValidProvider, unknownProviderError } from './providers/types'
import { withRetry } from './retry'
import { getStoredApiKey } from './storage'
import { CHUNK_CHAR_LIMIT, promisePool, splitIntoChunks, translateChunked, withTimeout } from './translateChunking'
import { normalizeDetectedLang } from './translateLanguage'
import { buildDetectLanguagePrompt, buildPrompt, buildRewritePrompt } from './translatePrompts'
import {
  DETECT_PROVIDERS,
  REWRITE_PROVIDERS,
  streamTranslation,
  TRANSLATE_PROVIDERS,
  VERIFY_PROVIDERS,
} from './translateProviders'
import {
  type PhoneticMode,
  parseDetectLanguageParams,
  parseRewriteParams,
  parseTranslateParams,
} from './translateValidation'

export {
  buildPrompt,
  buildRewritePrompt,
  normalizeDetectedLang,
  promisePool,
  splitIntoChunks,
  streamTranslation,
  withTimeout,
}

function getProviderCredential(provider: string) {
  return isLocalProvider(provider) ? LOCAL_AI_PLACEHOLDER_KEY : getStoredApiKey(provider)
}

const TRANSLATE_CANCELLED_MESSAGE = 'translate-cancelled'
const activeTranslateControllers = new Map<string, AbortController>()

export function registerTranslateHandlers(ipcMain: IpcMain) {
  ipcMain.handle('translate:cancel', async (_event, rawParams: unknown) => {
    if (!isRecord(rawParams) || !isNonEmptyString(rawParams.requestId)) {
      return { success: false, error: 'INVALID_INPUT' }
    }
    const controller = activeTranslateControllers.get(rawParams.requestId)
    if (!controller) return { success: false, error: 'NOT_FOUND' }
    controller.abort()
    activeTranslateControllers.delete(rawParams.requestId)
    return { success: true }
  })

  ipcMain.handle('translate:verify', async (_event, provider: string, apiKey: string) => {
    if (!isLocalProvider(provider) && !apiKey?.trim()) {
      return { success: false, error: 'API key is empty' }
    }
    if (!isValidProvider(provider)) return unknownProviderError(provider)

    try {
      const verifyFn = VERIFY_PROVIDERS[provider]
      if (!verifyFn) return unknownProviderError(provider)
      await verifyFn(isLocalProvider(provider) ? LOCAL_AI_PLACEHOLDER_KEY : apiKey)
      return { success: true }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
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

  ipcMain.handle('translate', async (_event, rawParams: unknown) => {
    const parsed = parseTranslateParams(rawParams)
    if (!parsed.ok) return parsed.response
    const params = parsed.value
    const { provider, model, requestId, sourceText, sourceLang, targetLang, showFurigana, translationStyle, phoneticOnly, phoneticMode } = params
    const effectivePhoneticMode: PhoneticMode = phoneticMode ?? (showFurigana ? 'standard' : 'off')

    if (!sourceText.trim()) return { success: false, error: 'Source text is empty' }
    if (!model?.trim()) return { success: false, error: 'Model is required' }

    const apiKey = getProviderCredential(provider)
    if (!apiKey) return noApiKeyResponse(provider)

    try {
      const translateFn = TRANSLATE_PROVIDERS[provider]
      if (!translateFn) return unknownProviderError(provider)

      const controller = requestId ? new AbortController() : null
      if (requestId && controller) activeTranslateControllers.set(requestId, controller)
      const options = controller ? { signal: controller.signal } : undefined
      const needsChunking = !phoneticOnly && sourceText.length > CHUNK_CHAR_LIMIT
      try {
        const translatedText = needsChunking
          ? await translateChunked(
              (text) => {
                if (controller?.signal.aborted) throw new Error(TRANSLATE_CANCELLED_MESSAGE)
                return translateFn(apiKey, model, text, sourceLang, targetLang, !!showFurigana, translationStyle ?? 'general', false, effectivePhoneticMode, options)
              },
              sourceText,
            )
          : await withRetry(() =>
              translateFn(apiKey, model, sourceText, sourceLang, targetLang, !!showFurigana, translationStyle ?? 'general', !!phoneticOnly, effectivePhoneticMode, options)
            )

        return { success: true, translatedText }
      } finally {
        if (requestId && activeTranslateControllers.get(requestId) === controller) {
          activeTranslateControllers.delete(requestId)
        }
      }
    } catch (error: unknown) {
      if (isAbortError(error)) {
        return { success: false, error: TRANSLATE_CANCELLED_MESSAGE, errorCode: 'CANCELLED' }
      }
      console.error(`Translation error with ${provider}:`, error)
      const msg = error instanceof Error ? error.message : String(error)
      const classified = classifyProviderError(msg)
      return { ...classified, error: classified.errorCode ? classified.error : `Translation failed: ${msg}` }
    }
  })

  ipcMain.handle('translate:rewrite', async (_event, rawParams: unknown) => {
    const parsed = parseRewriteParams(rawParams)
    if (!parsed.ok) return parsed.response
    const { provider, model, text, lang, translationStyle } = parsed.value

    if (!text.trim()) return { success: false, error: 'Text is empty' }
    if (!model?.trim()) return { success: false, error: 'Model is required' }

    const apiKey = getProviderCredential(provider)
    if (!apiKey) return noApiKeyResponse(provider)

    try {
      const rewriteFn = REWRITE_PROVIDERS[provider]
      if (!rewriteFn) return unknownProviderError(provider)

      const rewrittenText = text.length > CHUNK_CHAR_LIMIT
        ? await translateChunked((t) => rewriteFn(apiKey, model, t, lang, translationStyle), text)
        : await rewriteFn(apiKey, model, text, lang, translationStyle)

      return { success: true, translatedText: rewrittenText }
    } catch (error: unknown) {
      console.error(`Rewrite error with ${provider}:`, error)
      const msg = error instanceof Error ? error.message : String(error)
      const classified = classifyProviderError(msg)
      return { ...classified, error: classified.errorCode ? classified.error : `Rewrite failed: ${msg}` }
    }
  })

  ipcMain.handle('translate:detect-lang', async (_event, rawParams: unknown) => {
    const parsed = parseDetectLanguageParams(rawParams)
    if (!parsed.ok) return parsed.response
    const { provider, model, text } = parsed.value
    if (!text.trim()) return { success: false, error: 'Text is empty' }

    const apiKey = getProviderCredential(provider)
    if (!apiKey) return noApiKeyResponse(provider)

    const snippet = text.slice(0, DETECT_LANG_MAX_CHARS)
    const prompt = buildDetectLanguagePrompt(snippet)

    try {
      const detectFn = DETECT_PROVIDERS[provider]
      if (!detectFn) return unknownProviderError(provider)

      let raw = ''
      try {
        raw = await detectFn(apiKey, model, prompt)
      } catch {
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
