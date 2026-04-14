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
  /**
   * Whisper-internal confidence signals (only present when verbose_json is used).
   * Use these as a "no-speech gate" before accepting the transcript:
   *   • noSpeechProb  > 0.65 → model thinks no speech was present → reject
   *   • avgLogprob    < −1.0 → model is uncertain about the output  → reject
   *   • compressionRatio > 2.4 → output has unusual repetition     → reject
   */
  noSpeechProb?: number
  avgLogprob?: number
  compressionRatio?: number
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

// ─── Live Session History ─────────────────────────────────────────────────────

export interface LiveSession {
  id: string
  createdAt: number
  sourceLang: string
  targetLang: string
  provider: string
  model: string
  rawTranscript: string
  translation: string
  summary?: string
  wordCount: number
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

// ─── Subtitle appearance settings ────────────────────────────────────────────

export interface SubtitleSettings {
  /** Hex color for subtitle text, e.g. '#ffffff' */
  textColor: string
  /** Font size in pixels (12–40) */
  fontSize: number
  /** Background opacity percentage (0–100) */
  bgOpacity: number
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
  rewriteText: (params: {
    provider: string
    model: string
    text: string
    lang: string
    translationStyle?: TranslationStyle
  }) => Promise<TranslateResult>
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
  checkScreenPermission: () => Promise<string>
  openExternal: (url: string) => Promise<void>
  /**
   * Streaming translation — each AI token is pushed directly to the subtitle
   * window in real-time. Returns the full translated text when complete.
   */
  translateStream: (params: {
    provider: string
    model: string
    sourceText: string
    sourceLang: string
    targetLang: string
    translationStyle?: string
  }) => Promise<TranslateResult>
  /** Floating subtitle overlay — runs in a separate always-on-top OS window */
  subtitle: {
    show: () => Promise<void>
    hide: () => Promise<void>
    update: (text: string, isTranslating: boolean) => Promise<void>
    setStyle: (style: SubtitleSettings) => Promise<void>
    /** Returns a cleanup function that removes the listener */
    onClosed: (callback: () => void) => () => void
  }
  platform: string
  version: string

  /** Global hotkey — translate selected text in any OS application */
  hotkey: {
    update: (settings: {
      hotkey?: string
      enabled?: boolean
      provider?: string
      model?: string
      sourceLang?: string
      targetLang?: string
    }) => Promise<{ success: boolean; settings?: Record<string, unknown>; error?: string }>
    get: () => Promise<{ success: boolean; settings?: Record<string, unknown> }>
    disable: () => Promise<{ success: boolean }>
    onTranslating: (cb: (data: { text: string }) => void) => () => void
    onTranslated: (cb: (data: { original: string; translated: string }) => void) => () => void
    onError: (cb: (data: { error: string }) => void) => () => void
  }

  /** Legacy Assistant — floating icon injected into browsers without an extension */
  legacyAssistant: {
    get: () => Promise<{ success: boolean; settings?: Record<string, unknown> }>
    update: (settings: { enabled?: boolean; targetLang?: string }) => Promise<{ success: boolean }>
    getBookmarklet: () => Promise<{ success: boolean; bookmarklet?: string; error?: string }>
    injectNow: () => Promise<{ success: boolean }>
  }

  /** Local HTTP server — Chrome Extension bridge (multi-token) */
  localServer: {
    createToken: (p: { name: string; ttlDays: number }) => Promise<{
      success: boolean; token?: string; id?: string; name?: string
      createdAt?: number; expiresAt?: number; error?: string
    }>
    listTokens: () => Promise<{
      success: boolean; port: number
      tokens: Array<{ id: string; name: string; createdAt: number; expiresAt: number }>
    }>
    deleteToken: (p: { id: string }) => Promise<{ success: boolean; error?: string }>
    regenerateToken: (p: { id: string; ttlDays?: number }) => Promise<{
      success: boolean; token?: string; id?: string; name?: string
      createdAt?: number; expiresAt?: number; error?: string
    }>
  }
}

declare global {
  interface Window {
    api: WindowApi
  }
}
