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

  // App info
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0',
})
