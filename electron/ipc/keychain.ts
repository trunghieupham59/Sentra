import { IpcMain } from 'electron'
import { getStoredApiKey, setStoredApiKey, deleteStoredApiKey } from './storage'

export function registerKeychainHandlers(ipcMain: IpcMain) {
  // Save API key to OS Keychain
  ipcMain.handle('keychain:save', async (_event, provider: string, apiKey: string) => {
    try {
      setStoredApiKey(provider, apiKey)
      return { success: true }
    } catch (error) {
      console.error(`keychain:save error for ${provider}:`, error)
      return { success: false, error: String(error) }
    }
  })

  // Get API key status (masked) - does NOT return raw key
  ipcMain.handle('keychain:get', async (_event, provider: string) => {
    try {
      const key = getStoredApiKey(provider)
      if (!key) return { exists: false, masked: null }
      // Return masked version only (first 4 + last 4 chars)
      const masked =
        key.length > 8
          ? `${key.substring(0, 4)}${'•'.repeat(key.length - 8)}${key.substring(key.length - 4)}`
          : '•'.repeat(key.length)
      return { exists: true, masked }
    } catch (error) {
      console.error(`keychain:get error for ${provider}:`, error)
      return { exists: false, masked: null, error: String(error) }
    }
  })

  // Delete API key from OS Keychain
  ipcMain.handle('keychain:delete', async (_event, provider: string) => {
    try {
      const deleted = deleteStoredApiKey(provider)
      return { success: deleted }
    } catch (error) {
      console.error(`keychain:delete error for ${provider}:`, error)
      return { success: false, error: String(error) }
    }
  })

  // Check if key exists (boolean only)
  ipcMain.handle('keychain:hasKey', async (_event, provider: string) => {
    try {
      const key = getStoredApiKey(provider)
      return { exists: !!key }
    } catch (error) {
      return { exists: false, error: String(error) }
    }
  })
}
