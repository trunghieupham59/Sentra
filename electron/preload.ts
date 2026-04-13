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

  // Audio transcription via OpenAI Whisper (avoids Google Speech API dependency)
  transcribeAudio: (params: {
    audioData: ArrayBuffer
    mimeType: string
    language?: string
  }) => ipcRenderer.invoke('audio:transcribe', params),

  // AI Text-to-Speech — tries OpenAI TTS first, then Gemini TTS, falls back to NO_API_KEY
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
  }) => ipcRenderer.invoke('chat:send', params),

  // Check macOS Screen Recording permission status
  // Returns: 'granted' | 'denied' | 'restricted' | 'unknown' | 'not-determined'
  checkScreenPermission: () => ipcRenderer.invoke('app:checkScreenPermission') as Promise<string>,

  // Open a URL in the system browser or a macOS Settings deep link
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),

  // App info
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0',
})
