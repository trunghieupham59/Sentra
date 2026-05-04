export type Provider = 'gemini' | 'claude' | 'openai' | 'local'
export type LocalAiEngine = 'ollama' | 'lmstudio' | 'llamacpp'
export type LocalAiHardwareTier = 'low' | 'balanced' | 'powerful' | 'max'

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
 * TTS routing preference:
 *  - 'free'    — free Edge TTS only; never uses local system voices or paid API keys
 *  - 'auto'    — Edge TTS first, then paid providers only if free TTS fails
 *  - 'premium' — paid providers first for quality, then free fallback
 */
export type TtsMode = 'free' | 'auto' | 'premium'

/**
 * STT provider user-facing preference (stored in settings):
 *  - 'auto'      — smart routing: Whisper → Gemini STT → Groq (free) → surface error
 *  - 'whisper'   — OpenAI Whisper only (highest accuracy, requires OpenAI key)
 *  - 'google'    — Gemini STT only (uses Gemini API key, no extra GCP setup)
 *  - 'groq'      — Groq Whisper (free, 28,800 sec/day, requires Groq key)
 *  - 'webSpeech' — Browser Web Speech API (free, real-time, no key needed, Chrome-based;
 *                  kept for backward compat — not shown in UI; only used in VoiceRecorder
 *                  for real-time streaming where IPC audio upload is not possible)
 */
export type SttProvider = 'auto' | 'whisper' | 'google' | 'groq' | 'webSpeech'

export type AppPage = 'translate' | 'history' | 'chat' | 'live' | 'dictionary'

/**
 * Which STT backend actually produced a transcription result.
 * Groq is only used internally as a 3rd fallback in 'auto' mode — not user-selectable.
 */
export type SttBackend = 'whisper' | 'gemini' | 'groq'

/**
 * Pre-flight STT availability check result.
 * Returned by `checkSttProviders()` before starting a live session so the
 * pipeline can skip unavailable providers from the very first audio chunk.
 */
export interface SttProviderCheckResult {
  /** The best available backend (used as default for this session). */
  primary: SttBackend | 'none'
  /** All backends that have a configured key, in priority order. */
  available: SttBackend[]
}

export interface ProviderConfig {
  id: Provider
  name: string
  color: string
  keyPrefix: string
  docsUrl: string
  models: ModelConfig[]
  requiresApiKey?: boolean
  localEngines?: LocalAiEngine[]
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
  downloadModel?: string
  recommendedTier?: LocalAiHardwareTier
  installed?: boolean
  supportsVision?: boolean
  estimatedSizeGb?: number
}

export interface LocalAiHardwareProfile {
  platform: string
  arch: string
  cpuCount: number
  totalMemoryGb: number
  tier: LocalAiHardwareTier
}

export interface LocalAiDiscoveryResult {
  success: boolean
  available: boolean
  engine?: LocalAiEngine
  endpoint?: string
  models: FetchedModel[]
  suggestedModels: FetchedModel[]
  recommendedModel?: string
  hardware: LocalAiHardwareProfile
  error?: string
}

export interface LocalAiBenchmarkResult {
  hardware: LocalAiHardwareProfile
  suggestedModels: FetchedModel[]
  recommendedModel?: string
  metrics?: {
    cpuScore: number
    memoryScore: number
    combinedScore: number
    durationMs: number
    runtimeModel?: string
    runtimeLatencyMs?: number
    runtimeTokensPerSecond?: number
  }
}

export interface LocalAiDownloadResult {
  success: boolean
  model: string
  error?: string
}

export interface LocalAiModelActionResult {
  success: boolean
  model: string
  error?: string
}

export interface LocalAiModelDownloadProgress {
  model: string
  status: 'running' | 'success' | 'error'
  percent: number
  message: string
  completedBytes?: number
  totalBytes?: number
}

export interface LocalAiInstallResult {
  success: boolean
  error?: string
  message?: string
  output?: string
  cancelled?: boolean
  manual?: boolean
}

export interface LocalAiInstallProgress {
  status: 'running' | 'success' | 'error' | 'cancelled'
  percent: number
  message: string
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
  /**
   * Per-segment text from Whisper verbose_json — each entry is one natural
   * phrase boundary as detected by the model itself.  When 2+ segments are
   * present, processChunk iterates them independently for language-agnostic
   * sentence splitting (no regex heuristics needed).
   */
  segmentTexts?: string[]
  /** Which STT backend actually produced this result (for telemetry / UI badge). */
  usedProvider?: SttBackend
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

export type ChatSendShortcut = 'enter' | 'modEnter'

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
  /** Label shown in the research step header, e.g. "Phân tích câu hỏi" */
  researchStepLabel?: string
  /** Deep Research mode — final synthesis bubble (highlighted, indigo) */
  isResearchFinal?: boolean
  /**
   * Smart Thinking — lightweight indicator bubble shown while AI decides
   * whether to web-search. Renders as a minimal "Smart Thinking..." pill
   * (no inner content, no sources list, no expand/collapse).
   */
  isSmartThinkingStep?: boolean
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
  errorCode?: 'NO_API_KEY' | 'INVALID_KEY' | 'RATE_LIMIT' | 'NETWORK' | 'TIMEOUT' | 'EMPTY_RESPONSE' | 'BLOCKED_RECITATION' | 'BLOCKED_SAFETY' | string
}

export interface ChatImageEditResult {
  success: boolean
  imageBase64?: string
  imageMimeType?: string
  usedProvider?: string
  usedModel?: string
  error?: string
  errorCode?: 'NO_API_KEY' | 'INVALID_KEY' | 'RATE_LIMIT' | 'NETWORK' | 'TIMEOUT' | 'EMPTY_RESPONSE' | 'BLOCKED_RECITATION' | 'BLOCKED_SAFETY' | 'NO_IMAGE_EDIT' | string
}

export interface ChatStreamEvent {
  requestId: string
  type: 'start' | 'token' | 'end' | 'error'
  token?: string
  reply?: string
  error?: string
  errorCode?: 'NO_API_KEY' | 'INVALID_KEY' | 'RATE_LIMIT' | 'NETWORK' | 'TIMEOUT' | 'EMPTY_RESPONSE' | 'BLOCKED_RECITATION' | 'BLOCKED_SAFETY' | string
}

export interface QuickChatSeedPayload {
  question: string
  response?: string
  provider: string
  model: string
}

// ─── Dictionary types ────────────────────────────────────────────────────────

export interface DictionaryLookupParams {
  term: string
  context?: string
  sourceLang: string
  targetLang: string
  provider: Provider
  model: string
}

export interface DictionaryResult {
  headword: string
  pronunciation: string
  partOfSpeech: string[]
  meaning: string
  translations: DictionaryTranslation[]
  examples: string[]
  notes: string[]
}

export interface DictionaryTranslation {
  text: string
  pronunciation: string
  partOfSpeech?: string
  meaning?: string
  usage?: string
  nuance?: string
  example?: string
  examples?: string[]
  collocations?: string[]
  notes?: string[]
}

export interface DictionaryEntry {
  id: string
  term: string
  normalizedTerm: string
  context?: string
  sourceLang: string
  targetLang: string
  provider: Provider
  model: string
  createdAt: number
  favorite: boolean
  result: DictionaryResult
}

export interface DictionaryLookupResult {
  success: boolean
  result?: DictionaryResult
  error?: string
  errorCode?: 'INVALID_INPUT' | 'INVALID_RESPONSE' | 'NO_API_KEY' | 'INVALID_KEY' | 'RATE_LIMIT' | 'NETWORK' | string
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
  translationStyle?: TranslationStyle
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
  discoverLocalAi: (force?: boolean) => Promise<LocalAiDiscoveryResult>
  ensureLocalAiRuntime: () => Promise<LocalAiDiscoveryResult>
  benchmarkLocalAi: () => Promise<LocalAiBenchmarkResult>
  downloadLocalAiModel: (modelId: string) => Promise<LocalAiDownloadResult>
  uninstallLocalAiModel: (modelId: string) => Promise<LocalAiModelActionResult>
  onLocalAiModelDownloadProgress: (cb: (progress: LocalAiModelDownloadProgress) => void) => () => void
  installOllama: () => Promise<LocalAiInstallResult>
  cancelOllamaInstall: () => Promise<{ success: boolean }>
  onLocalAiInstallProgress: (cb: (progress: LocalAiInstallProgress) => void) => () => void
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
    mode?: TtsMode
    lang?: string
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
    provider?: 'tavily' | 'brave' | 'jina'
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
    /** Optional larger output budget for long-form synthesis calls */
    maxOutputTokens?: number | 'model-max'
  }) => Promise<ChatResult>
  editChatImage?: (params: {
    provider: string
    model: string
    prompt: string
    imageBase64: string
    imageMimeType: string
  }) => Promise<ChatImageEditResult>
  chatStream: (params: {
    requestId: string
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
    /** Optional larger output budget for long-form synthesis calls */
    maxOutputTokens?: number | 'model-max'
  }) => Promise<ChatResult>
  onChatStreamEvent: (requestId: string, cb: (event: ChatStreamEvent) => void) => () => void
  checkScreenPermission: () => Promise<string>
  openExternal: (url: string) => Promise<void>
  relaunchApp: () => Promise<void>
  /**
   * Pre-flight STT availability check — call before starting a Live Translate session.
   * Checks which STT keys are configured (instant, no API call, no decryption) and
   * pre-warms the session cache so the very first audio chunk goes to the right backend.
   *
   * Returns the best available provider and the full ordered list of available backends.
   */
  checkSttProviders: () => Promise<SttProviderCheckResult>
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
      locale?: string
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
    /** AI Chat quick-ask hotkey — opens a popup in the renderer */
    chat: {
      update: (settings: { hotkey?: string; enabled?: boolean }) =>
        Promise<{ success: boolean; settings?: Record<string, unknown>; error?: string }>
      get: () => Promise<{ success: boolean; settings?: Record<string, unknown> }>
      /** Listen for the chat-open event. Returns a cleanup function. */
      onOpen: (cb: () => void) => () => void
    }
  }

  /** Standalone Raycast-style AI Chat quick window */
  quickChat: {
    hide: () => Promise<{ success: boolean; error?: string }>
    openSettings: () => Promise<{ success: boolean; error?: string }>
    openInChat: (payload?: QuickChatSeedPayload) => Promise<{ success: boolean; error?: string }>
    onShow: (cb: () => void) => () => void
    onOpenSettings: (cb: () => void) => () => void
    onOpenInChat: (cb: (payload: QuickChatSeedPayload | null) => void) => () => void
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
    /** In-app download. macOS downloads the unsigned DMG without opening Finder. */
    download: () => Promise<{ success: boolean; error?: string; filePath?: string }>
    /** Quit and install, or delegate to the platform updater. */
    install: () => Promise<{ success: boolean; error?: string }>
    /** Manual fallback for macOS: open the downloaded DMG in Finder. */
    openInstaller: () => Promise<{ success: boolean; error?: string }>
    getVersion: () => Promise<{ version: string }>
    /**
     * Open the download URL in the system browser.
     * Fallback only — falls back to GitHub Releases page.
     */
    openDownload: (url?: string) => Promise<{ success: boolean }>
    onStatus: (cb: (status: {
      type: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error-codesign' | 'error'
      version?: string
      percent?: number
      bytesPerSecond?: number
      transferred?: number
      total?: number
      installMode?: 'restart' | 'open-installer'
      error?: string
      /** macOS only: direct asset URL (DMG) or release page URL. */
      downloadUrl?: string
    }) => void) => () => void
  }

  /** Local HTTP server — Chrome Extension bridge (multi-API-key) */
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
    /** Sync the currently selected provider/model and TTS prefs so local extension APIs reflect the app's state. */
    syncConfig: (p: {
      provider: string
      model: string
      ttsMode?: TtsMode
      ttsVoice?: TtsVoice
    }) => Promise<{ success: boolean }>
  }
}

declare global {
  interface Window {
    api: WindowApi
  }
}
