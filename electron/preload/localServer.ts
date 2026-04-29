/**
 * Local Server preload API — Chrome Extension bridge via bearer-token authenticated HTTP server.
 */
import { ipcRenderer } from 'electron'

export const localServerSection = {
  localServer: {
    /** Create a new named token — token value returned ONCE only. */
    createToken: (params: { name: string; ttlDays: number }) =>
      ipcRenderer.invoke('localServer:createToken', params) as Promise<{
        success: boolean; token?: string; id?: string; name?: string
        createdAt?: number; expiresAt?: number; error?: string
      }>,

    /** List all active tokens — token values are NEVER returned. */
    listTokens: () =>
      ipcRenderer.invoke('localServer:listTokens') as Promise<{
        success: boolean; port: number
        tokens: Array<{ id: string; name: string; createdAt: number; expiresAt: number }>
      }>,

    /** Delete a token — it stops working immediately. */
    deleteToken: (params: { id: string }) =>
      ipcRenderer.invoke('localServer:deleteToken', params) as Promise<{
        success: boolean; error?: string
      }>,

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
    syncConfig: (params: {
      provider: string
      model: string
      ttsMode?: 'free' | 'auto' | 'premium'
      ttsVoice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
    }) =>
      ipcRenderer.invoke('localServer:syncConfig', params) as Promise<{ success: boolean }>,
  },
}
