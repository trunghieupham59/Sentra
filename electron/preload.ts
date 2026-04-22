import { contextBridge, ipcRenderer } from 'electron'

// Expose safe API to renderer process via contextBridge
// Raw API keys NEVER leave the main process
contextBridge.exposeInMainWorld('api', {
  // Keychain operations
  keychain: {
    save: (provider: string, key: string) =>
      ipcRenderer.invoke('keychain:save', provider, key),
    get: (provider: string) =>
      ipcRenderer.invoke('keychain:get', provider),
    delete: (provider: string) =>
      ipcRenderer.invoke('keychain:delete', provider),
    hasKey: (provider: string) =>
      ipcRenderer.invoke('keychain:hasKey', provider),
  },

  // Fetch available models from provider API
  fetchModels: (provider: string) =>
    ipcRenderer.invoke('models:fetch', provider),

  // Verify API key (test call to provider)
  verifyKey: (provider: string, apiKey: string) =>
    ipcRenderer.invoke('translate:verify', provider, apiKey),

  // Translation operation
  translate: (params: {
    provider: string
    model: string
    sourceText: string
    sourceLang: string
    targetLang: string
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

  // Audio transcription via OpenAI Whisper (avoids Google Speech API dependency)
  transcribeAudio: (params: {
    audioData: ArrayBuffer
    mimeType: string
    language?: string
  }) => ipcRenderer.invoke('audio:transcribe', params),

  // AI Text-to-Speech — priority: OpenAI → Gemini → Edge TTS (free) → ElevenLabs
  speakText: (params: {
    text: string
    voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
  }) => ipcRenderer.invoke('audio:tts', params) as Promise<{
    success: boolean
    audioBase64?: string
    /** 'audio/mpeg' (OpenAI) | 'audio/wav' (Gemini) */
    mimeType?: string
    provider?: string
    error?: string
    errorCode?: string
  }>,

  // Image translation — extracts text regions from image and returns translated regions
  translateImage: (params: {
    provider: string
    model: string
    imageBase64: string
    imageMimeType: string
    sourceLang: string
    targetLang: string
  }) => ipcRenderer.invoke('image:translate', params),

  /**
   * Subscribe to model/provider switch events pushed during image translation fallback.
   * Fired immediately when the system decides to try a different model, before translation completes.
   * Returns a cleanup function — call it to unsubscribe.
   */
  onImageModelSwitched: (cb: (data: { model: string; provider: string }) => void) => {
    const handler = (_: unknown, data: { model: string; provider: string }) => cb(data)
    ipcRenderer.on('image:model-switched', handler)
    return () => ipcRenderer.removeListener('image:model-switched', handler)
  },

  // AI Chat — supports text + image messages, multi-turn conversation
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
  }) => ipcRenderer.invoke('chat:send', params),

  // Check macOS Screen Recording permission status
  // Returns: 'granted' | 'denied' | 'restricted' | 'unknown' | 'not-determined'
  checkScreenPermission: () => ipcRenderer.invoke('app:checkScreenPermission') as Promise<string>,

  // Open a URL in the system browser or a macOS Settings deep link
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),

  // Streaming translate — sends each AI token directly to subtitle window,
  // returns the full translated text when done (same shape as `translate`).
  translateStream: (params: {
    provider: string
    model: string
    sourceText: string
    sourceLang: string
    targetLang: string
    translationStyle?: string
  }) => ipcRenderer.invoke('translate:live-stream', params),

  // Floating subtitle overlay window (shown above all OS windows)
  subtitle: {
    /** Create and show the subtitle window (bottom-center of primary display) */
    show: () => ipcRenderer.invoke('subtitle:show'),
    /** Close the subtitle window */
    hide: () => ipcRenderer.invoke('subtitle:hide'),
    /** Push a new translated sentence to the subtitle window */
    update: (text: string, isTranslating: boolean) =>
      ipcRenderer.invoke('subtitle:update', { text, isTranslating }),
    /** Apply appearance settings (text color, font size, bg opacity) */
    setStyle: (style: { textColor: string; fontSize: number; bgOpacity: number }) =>
      ipcRenderer.invoke('subtitle:setStyle', style),
    /**
     * Register a one-time listener that fires when the subtitle window is closed
     * (either by clicking ✕ or programmatically).
     * Returns a cleanup function — call it to remove the listener.
     */
    onClosed: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('subtitle:closed', handler)
      return () => ipcRenderer.removeListener('subtitle:closed', handler)
    },
  },

  // App info
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0',

  // ── Auto Updater ─────────────────────────────────────────────────────────
  updater: {
    /** Trigger a check for updates. Status is pushed via onStatus(). */
    check: () => ipcRenderer.invoke('updater:check') as Promise<{ success: boolean; error?: string }>,
    /** Start downloading an available update (Windows / Linux only). */
    download: () => ipcRenderer.invoke('updater:download') as Promise<{ success: boolean; error?: string }>,
    /** Quit the app and install the downloaded update (Windows / Linux only). */
    install: () => ipcRenderer.invoke('updater:install') as Promise<{ success: boolean; error?: string }>,
    /** Get the current app version. */
    getVersion: () => ipcRenderer.invoke('updater:getVersion') as Promise<{ version: string }>,
    /**
     * Open the download URL in the system browser.
     * Used on macOS (unsigned build) where Squirrel cannot install silently.
     * Falls back to the GitHub Releases page if no URL is provided.
     */
    openDownload: (url?: string) =>
      ipcRenderer.invoke('updater:openDownload', url) as Promise<{ success: boolean }>,
    /**
     * Subscribe to update status events pushed from the main process.
     * Returns a cleanup function — call it to unsubscribe.
     */
    onStatus: (cb: (status: {
      type: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
      version?: string
      percent?: number
      bytesPerSecond?: number
      transferred?: number
      total?: number
      error?: string
      downloadUrl?: string
    }) => void) => {
      const handler = (_: unknown, status: Parameters<typeof cb>[0]) => cb(status)
      ipcRenderer.on('updater:status', handler)
      return () => ipcRenderer.removeListener('updater:status', handler)
    },
  },

  // ── Global Hotkey ────────────────────────────────────────────────────────
  hotkey: {
    /**
     * Update (and re-register) global hotkey settings.
     * Pass `enabled: true` + `hotkey: 'CommandOrControl+Shift+T'` to activate.
     */
    update: (settings: {
      hotkey?: string
      enabled?: boolean
      provider?: string
      model?: string
      sourceLang?: string
      targetLang?: string
    }) => ipcRenderer.invoke('hotkey:update', settings),

    /** Get the currently persisted hotkey settings. */
    get: () => ipcRenderer.invoke('hotkey:get'),

    /** Disable the hotkey without clearing other settings. */
    disable: () => ipcRenderer.invoke('hotkey:disable'),

    /**
     * Listen for hotkey events pushed from the main process.
     * Returns a cleanup function — call it to unsubscribe.
     */
    onTranslating: (cb: (data: { text: string }) => void) => {
      const handler = (_: unknown, data: { text: string }) => cb(data)
      ipcRenderer.on('hotkey:translating', handler)
      return () => ipcRenderer.removeListener('hotkey:translating', handler)
    },
    onTranslated: (cb: (data: { original: string; translated: string }) => void) => {
      const handler = (_: unknown, data: { original: string; translated: string }) => cb(data)
      ipcRenderer.on('hotkey:translated', handler)
      return () => ipcRenderer.removeListener('hotkey:translated', handler)
    },
    onError: (cb: (data: { error: string }) => void) => {
      const handler = (_: unknown, data: { error: string }) => cb(data)
      ipcRenderer.on('hotkey:error', handler)
      return () => ipcRenderer.removeListener('hotkey:error', handler)
    },
  },

  // ── Legacy Assistant (no-extension browser injection) ───────────────────
  legacyAssistant: {
    /** Get current settings */
    get: () => ipcRenderer.invoke('legacyAssistant:get'),
    /** Update settings (enable auto-inject, change targetLang, etc.) */
    update: (settings: { enabled?: boolean; targetLang?: string }) =>
      ipcRenderer.invoke('legacyAssistant:update', settings),
    /**
     * Get the bookmarklet `javascript:` URL — embed the full assistant script
     * so the user can drag it to their bookmarks bar and click to inject on
     * any page without installing a browser extension.
     */
    getBookmarklet: () => ipcRenderer.invoke('legacyAssistant:getBookmarklet'),
    /** Immediately trigger one injection attempt into the frontmost browser */
    injectNow: () => ipcRenderer.invoke('legacyAssistant:injectNow'),
  },

  // ── Local Server (Chrome Extension bridge) ───────────────────────────────
  localServer: {
    /** Create a new named token — token value returned ONCE only. */
    createToken: (params: { name: string; ttlDays: number }) =>
      ipcRenderer.invoke('localServer:createToken', params) as Promise<{
        success: boolean; token?: string; id?: string; name?: string
        createdAt?: number; expiresAt?: number; error?: string
      }>,
    /** List all active tokens — token values are NEVER returned. */
    listTokens: () => ipcRenderer.invoke('localServer:listTokens') as Promise<{
      success: boolean; port: number
      tokens: Array<{ id: string; name: string; createdAt: number; expiresAt: number }>
    }>,
    /** Delete a token — it stops working immediately. */
    deleteToken: (params: { id: string }) =>
      ipcRenderer.invoke('localServer:deleteToken', params) as Promise<{ success: boolean; error?: string }>,
    /** Rotate the token value for an existing entry — new value returned ONCE, TTL resets. */
    regenerateToken: (params: { id: string; ttlDays?: number }) =>
      ipcRenderer.invoke('localServer:regenerateToken', params) as Promise<{
        success: boolean; token?: string; id?: string; name?: string
        createdAt?: number; expiresAt?: number; error?: string
      }>,
    /**
     * Sync the app's currently selected provider/model to the main process
     * so the local server can serve it via GET /api/config.
     * Call on startup and whenever selectedProvider or selectedModels changes.
     */
    syncConfig: (params: { provider: string; model: string }) =>
      ipcRenderer.invoke('localServer:syncConfig', params) as Promise<{ success: boolean }>,
  },
})
