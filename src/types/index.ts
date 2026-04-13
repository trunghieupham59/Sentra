export type Provider = 'gemini' | 'claude' | 'openai'

export type TranslationStyle = 'friendly' | 'neutral' | 'professional' | 'business' | 'slack' | 'polite' | 'technical'

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
  /** base64-encoded audio (avoids IPC ArrayBuffer serialization issues) */
  audioBase64?: string
  /** MIME type of the audio: 'audio/mpeg' (OpenAI) or 'audio/wav' (Gemini) */
  mimeType?: string
  /** Which provider produced the audio: 'openai' | 'gemini' */
  provider?: string
  error?: string
  errorCode?: 'NO_API_KEY' | 'INVALID_KEY' | 'RATE_LIMIT' | string
}

export interface ImageTextRegion {
  x: number        // 0.0–1.0 fraction of image width
  y: number        // 0.0–1.0 fraction of image height
  width: number    // 0.0–1.0 fraction of image width
  height: number   // 0.0–1.0 fraction of image height
  originalText: string
  translatedText: string
  fontSize: number  // 0.0–1.0 fraction of image height
  bgColor: string
  textColor: string
}

export interface ImageTranslateResult {
  success: boolean
  regions?: ImageTextRegion[]
  /** base64 of the fully edited image (returned when Gemini image-edit is used) */
  editedImageBase64?: string
  error?: string
  errorCode?: 'NO_API_KEY' | 'INVALID_KEY' | 'RATE_LIMIT' | 'NO_VISION' | string
}

export interface FetchModelsResult {
  success: boolean
  models: FetchedModel[]
  /** Best model for translation auto-selected by scoring algorithm */
  recommendedModel?: string
  error?: string
  errorCode?: 'NO_API_KEY' | string
}

// ─── Chat types ───────────────────────────────────────────────────────────────

export interface SystemPromptPreset {
  id: string
  name: string
  content: string
  isDefault?: boolean
}

export interface ChatMessageContent {
  type: 'text' | 'image'
  text?: string
  imageBase64?: string
  imageMimeType?: string
  /** Preview URL for display only (not sent to API) */
  imagePreviewUrl?: string
  imageFileName?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: ChatMessageContent[]
  timestamp: number
  isLoading?: boolean
  error?: string
}

export interface ChatSession {
  id: string
  title: string
  provider: Provider
  model: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

export interface ChatResult {
  success: boolean
  reply?: string
  error?: string
  errorCode?: 'NO_API_KEY' | 'INVALID_KEY' | 'RATE_LIMIT' | 'NETWORK' | string
}

// ─── History ──────────────────────────────────────────────────────────────────

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

// ─── Window API (exposed via contextBridge) ───────────────────────────────────

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
  translateImage: (params: {
    provider: string
    model: string
    imageBase64: string
    imageMimeType: string
    sourceLang: string
    targetLang: string
  }) => Promise<ImageTranslateResult>
  chat: (params: {
    provider: string
    model: string
    messages: Array<{
      role: 'user' | 'assistant'
      content: Array<{
        type: 'text' | 'image'
        text?: string
        imageBase64?: string
        imageMimeType?: string
      }>
    }>
    systemPrompt?: string
  }) => Promise<ChatResult>
  openExternal: (url: string) => Promise<void>
  platform: string
  version: string
}

declare global {
  interface Window {
    api: WindowApi
  }
}
