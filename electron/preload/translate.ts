/**
 * Translation & model preload API — text translation, rewrite, language detection,
 * live-stream, model fetching, and API key verification.
 */
import { ipcRenderer } from 'electron'

export const translateSection = {
  // Fetch available models from provider API
  fetchModels: (provider: string) =>
    ipcRenderer.invoke('models:fetch', provider),

  // Verify API key (test call to provider)
  verifyKey: (provider: string, apiKey: string) =>
    ipcRenderer.invoke('translate:verify', provider, apiKey),

  // Full text translation with optional chunking for long documents
  translate: (params: {
    provider: string
    model: string
    sourceText: string
    sourceLang: string
    targetLang: string
    showFurigana?: boolean
    translationStyle?: string
    phoneticOnly?: boolean
  }) => ipcRenderer.invoke('translate', params),

  // Rewrite text to be more natural in its own language (preserves meaning/tone)
  rewriteText: (params: {
    provider: string
    model: string
    text: string
    lang: string
    translationStyle?: string
  }) => ipcRenderer.invoke('translate:rewrite', params),

  // Detect the language of source text — returns the BCP-47 code (e.g. "vi", "en", "ja")
  detectLanguage: (params: {
    provider: string
    model: string
    text: string
  }) => ipcRenderer.invoke('translate:detect-lang', params),

  // Streaming translate — sends each AI token directly to subtitle window,
  // returns the full translated text when done.
  translateStream: (params: {
    provider: string
    model: string
    sourceText: string
    sourceLang: string
    targetLang: string
    translationStyle?: string
  }) => ipcRenderer.invoke('translate:live-stream', params),
}
