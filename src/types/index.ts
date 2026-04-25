export type Provider = 'gemini' | 'claude' | 'openai'

export type TranslationStyle = 'general' | 'formal' | 'casual' | 'business' | 'technical' | 'natural'

/**
 * Phonetic annotation mode:
 *  - 'off'      — no phonetic annotations
 *  - 'standard' — add {word|reading} ruby annotations (furigana/pinyin/romanization above original script)
 *  - 'phonetic' — replace original script with pure phonetics (hiragana-only, pinyin-only, romanization-only, IPA)
 */
export type PhoneticMode = 'off' | 'standard' | 'phonetic'

export type TtsVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'

/**
 * STT provider preference:
 *  - 'auto'      — try Whisper first, fallback to Google STT, then surface error
 *  - 'whisper'   — OpenAI Whisper only (highest accuracy, requires OpenAI key)
 *  - 'google'    — Google Cloud STT only (uses Gemini API key, very reliable)
 *  - 'webSpeech' — Browser Web Speech API (free, real-time, no key needed, Chrome-based)
 */
export type SttProvider = 'auto' | 'whisper' | 'google' | 'webSpeech'

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
  /** Explicit phonetic mode — overrides showFurigana when present */
  phoneticMode?: PhoneticMode
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
  /** MIME type of the audio: 'audio/mpeg' (OpenAI / Edge / ElevenLabs) or 'audio/wav' (Gemini) */
  mimeType?: string
  /** Which provider produced the audio: 'openai' | 'gemini' | 'edge' | 'elevenlabs' */
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
  /**
   * Set when a different model was automatically used due to vision-capability fallback.
   * Only present when the effective model differs from what the user selected.
   */
  usedModel?: string
  /**
   * Set when a different provider was automatically used due to vision-capability fallback.
   * Only present when the effective provider differs from what the user selected.
   */
  usedProvider?: string
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
  /** Deep Research mode — intermediate step bubble (collapsible, gray) */
  isResearchStep?: boolean
  /** Label shown in the research step header, e.g. "🔍 Phân tích câu hỏi" */
  researchStepLabel?: string
  /** Deep Research mode — final synthesis bubble (highlighted, indigo) */
  isResearchFinal?: boolean
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
  /** Speaker-labeled transcript produced by AI diarization analysis */
  speakerAnalysis?: string
  /** Action items extracted from the meeting by AI */
  actionItems?: string
  /** Key decisions extracted from the meeting by AI */
  decisions?: string
  wordCount: number
  /** Timestamped segments for SRT/TXT export and history playback */
  segments?: Array<{
    id: string
    rawText: string
    translation: string
    speaker: string
    timestamp: number
  }>
  /** User-assigned speaker display names, e.g. { 'Speaker 1': 'Alice' } */
  speakerNameMap?: Record<string, string>
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
  /** Detect the BCP-47 language code of source text (e.g. "vi", "en", "ja"). */
  detectLanguage: (params: {
    provider: string
    model: string
    text: string
  }) => Promise<{ success: boolean; lang?: string; error?: string }>
  transcribeAudio: (params: {
    audioData: ArrayBuffer
    mimeType: string
    language?: string
    /** Last transcript text, forwarded to Whisper as prompt context. */
    previousText?: string
    /**
     * Which STT backend to use. Defaults to 'auto' (Whisper → Google fallback).
     * 'webSpeech' is handled entirely in the renderer — never sent via IPC.
     */
    sttProvider?: SttProvider
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
  /**
   * Subscribe to model/provider switch events pushed during image translation fallback.
   * Fired immediately when the system decides to try a different model (before translation completes).
   * Returns a cleanup function — call it to unsubscribe.
   */
  onImageModelSwitched: (cb: (data: { model: string; provider: string }) => void) => () => void
  /** Web search via Tavily → Brave → Jina fallback chain */
  webSearch: (params: {
    query: string
    maxResults?: number
  }) => Promise<{
    success: boolean
    results?: Array<{ title: string; url: string; content: string; score: number }>
    answer?: string
    error?: string
  }>
  /**
   * Verify a web search API key by making a real minimal request.
   * Must be called BEFORE saving to keychain so the user gets immediate feedback.
   */
  webSearchVerify: (params: {
    provider: 'tavily' | 'brave'
    apiKey: string
  }) => Promise<{ valid: boolean; error?: string }>
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
    /** Bypass the 3k char limit — only set true for AI Summarize on long transcripts */
    bypassLengthCheck?: boolean
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
    /** Segment ID — used by subtitle window to correlate streaming tokens */
    segId?: string
  }) => Promise<TranslateResult>
  /** Floating subtitle overlay — runs in a separate always-on-top OS window */
  subtitle: {
    show: () => Promise<void>
    hide: () => Promise<void>
    update: (text: string, isTranslating: boolean) => Promise<void>
    setStyle: (style: SubtitleSettings) => Promise<void>
    /** Push the latest raw (source) text to show above the translation */
    setSourceText: (text: string, segId?: string) => Promise<void>
    /** Push current session state to subtitle window */
    pushState: (state: {
      selectedProvider: string
      selectedModel: string
      isActive: boolean
      isTranscribing: boolean
      isTranslating: boolean
      availableModels: { id: string; name: string }[]
      audioMode: string
      targetLang: string
    }) => Promise<void>
    /** Returns a cleanup function that removes the listener */
    onClosed: (callback: () => void) => () => void
    /** Listen for Start action from subtitle window. Returns cleanup fn. */
    onStart: (callback: () => void) => () => void
    /** Listen for Stop action from subtitle window. Returns cleanup fn. */
    onStop: (callback: () => void) => () => void
    /** Listen for provider change from subtitle window. Returns cleanup fn. */
    onSetProvider: (callback: (provider: string) => void) => () => void
    /** Listen for model change from subtitle window. Returns cleanup fn. */
    onSetModel: (callback: (model: string) => void) => () => void
    /** Listen for audio mode change from subtitle window. Returns cleanup fn. */
    onSetAudioMode: (callback: (mode: string) => void) => () => void
    /** Listen for target language change from subtitle window. Returns cleanup fn. */
    onSetTargetLang: (callback: (lang: string) => void) => () => void
    /** Listen for style changes from subtitle window. Returns cleanup fn. */
    onStyleUpdate: (callback: (style: SubtitleSettings) => void) => () => void
    /** Listen for "new session / clear" action from subtitle window. Returns cleanup fn. */
    onClear: (callback: () => void) => () => void
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

  /** Auto-updater — check and install updates from GitHub Releases */
  updater: {
    check: () => Promise<{ success: boolean; error?: string }>
    /** In-app download — Windows / Linux only (uses electron-updater / NSIS). */
    download: () => Promise<{ success: boolean; error?: string }>
    /** Quit & install — Windows / Linux only. */
    install: () => Promise<{ success: boolean; error?: string }>
    getVersion: () => Promise<{ version: string }>
    /**
     * Open the download URL in the system browser.
     * Used on macOS (unsigned build) — falls back to GitHub Releases page.
     */
    openDownload: (url?: string) => Promise<{ success: boolean }>
    onStatus: (cb: (status: {
      type: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
      version?: string
      percent?: number
      bytesPerSecond?: number
      transferred?: number
      total?: number
      error?: string
      /** macOS only: direct asset URL (DMG) or release page URL. */
      downloadUrl?: string
    }) => void) => () => void
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
    /** Sync the currently selected provider/model so /api/config reflects the app's state. */
    syncConfig: (p: { provider: string; model: string }) => Promise<{ success: boolean }>
  }
}

declare global {
  interface Window {
    api: WindowApi
  }
}
