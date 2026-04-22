/**
 * Keychain preload API — exposes secure API key storage to the renderer.
 * Raw key values NEVER leave the main process.
 */
import { ipcRenderer } from 'electron'

export const keychainSection = {
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
}
