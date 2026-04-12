export type Provider = 'gemini' | 'claude' | 'openai'

export type TranslationStyle = 'standard' | 'casual' | 'formal' | 'message' | 'technical'

export type TtsVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'

export interface ProviderConfig {
  id: Provider
  name: string
  color: string
  emoji: string
  keyPrefix: string
  docsUrl: string
  models: ModelConfig[]
}

export interface ModelConfig {
  id: string
  name: string
  description: string
  /**
   * 'recommended' = best balance of speed + quality for translation (auto-selected as default)
   * 'balanced'    = good quality, moderate speed
   * 'powerful'    = highest quality, slower/costlier
   */
  tag?: 'recommended' | 'balanced' | 'powerful'
}

export interface Language {
  code: string
  name: string
  nativeName: string
}

export interface TranslateParams {
  provider: Provider
  model: string
  sourceText: string
  sourceLang: string
  targetLang: string
  showFurigana?: boolean
  translationStyle?: TranslationStyle
  /** When true, skip translation — only add phonetic annotations to the already-translated sourceText */
  phoneticOnly?: boolean
}

export interface TranslateResult {
  success: boolean
  translatedText?: string
  error?: string
  errorCode?: 'NO_API_KEY' | 'INVALID_KEY' | 'RATE_LIMIT' | 'NETWORK' | string
}

export interface KeychainResult {
  success?: boolean
  exists?: boolean
  masked?: string | null
  error?: string
}

export interface VerifyResult {
  success: boolean
  error?: string
  errorCode?: 'INVALID_KEY' | 'RATE_LIMIT' | 'NETWORK' | string
  valid?: boolean
}

export interface FetchedModel {
  id: string
  name: string
  description: string
}

export interface TranscribeResult {
  success: boolean
  text?: string
  error?: string
  errorCode?: 'NO_API_KEY' | 'INVALID_KEY' | 'RATE_LIMIT' | string
}

export interface TtsResult {
  success: boolean
  /** base64-encoded MP3 audio (avoids IPC ArrayBuffer serialization issues) */
  audioBase64?: string
  error?: string
  errorCode?: 'NO_API_KEY' | 'INVALID_KEY' | 'RATE_LIMIT' | string
}

export interface FetchModelsResult {
  success: boolean
  models: FetchedModel[]
  /** Best model for translation auto-selected by scoring algorithm */
  recommendedModel?: string
  error?: string
  errorCode?: 'NO_API_KEY' | string
}

export interface HistoryItem {
  id: string
  timestamp: number
  provider: Provider
  model: string
  sourceLang: string
  targetLang: string
  sourceText: string
  translatedText: string
}

// Window API (exposed via contextBridge)
export interface WindowApi {
  keychain: {
    save: (provider: string, key: string) => Promise<KeychainResult>
    get: (provider: string) => Promise<KeychainResult>
    delete: (provider: string) => Promise<KeychainResult>
    hasKey: (provider: string) => Promise<{ exists: boolean }>
  }
  fetchModels: (provider: string) => Promise<FetchModelsResult>
  verifyKey: (provider: string, apiKey: string) => Promise<VerifyResult>
  translate: (params: TranslateParams) => Promise<TranslateResult>
  transcribeAudio: (params: {
    audioData: ArrayBuffer
    mimeType: string
    language?: string
  }) => Promise<TranscribeResult>
  speakText: (params: {
    text: string
    voice?: TtsVoice
  }) => Promise<TtsResult>
  platform: string
  version: string
}

declare global {
  interface Window {
    api: WindowApi
  }
}
