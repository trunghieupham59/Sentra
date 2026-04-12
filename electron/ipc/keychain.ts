import { IpcMain } from 'electron'

const KEYCHAIN_SERVICE = 'TranslateApp'

// Lazy load keytar to handle cases where native module isn't built yet
let keytar: typeof import('keytar') | null = null

async function getKeytar() {
  if (!keytar) {
    try {
      keytar = await import('keytar')
    } catch (error) {
      console.error('Failed to load keytar:', error)
      throw new Error('Keychain not available. Please rebuild native modules.')
    }
  }
  return keytar
}

export function registerKeychainHandlers(ipcMain: IpcMain) {
  // Save API key to OS Keychain
  ipcMain.handle('keychain:save', async (_event, provider: string, apiKey: string) => {
    try {
      const kt = await getKeytar()
      await kt.setPassword(KEYCHAIN_SERVICE, provider, apiKey)
      return { success: true }
    } catch (error) {
      console.error(`keychain:save error for ${provider}:`, error)
      return { success: false, error: String(error) }
    }
  })

  // Get API key status (masked) - does NOT return raw key
  ipcMain.handle('keychain:get', async (_event, provider: string) => {
    try {
      const kt = await getKeytar()
      const key = await kt.getPassword(KEYCHAIN_SERVICE, provider)
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
      const kt = await getKeytar()
      const deleted = await kt.deletePassword(KEYCHAIN_SERVICE, provider)
      return { success: deleted }
    } catch (error) {
      console.error(`keychain:delete error for ${provider}:`, error)
      return { success: false, error: String(error) }
    }
  })

  // Check if key exists (boolean only)
  ipcMain.handle('keychain:hasKey', async (_event, provider: string) => {
    try {
      const kt = await getKeytar()
      const key = await kt.getPassword(KEYCHAIN_SERVICE, provider)
      return { exists: !!key }
    } catch (error) {
      return { exists: false, error: String(error) }
    }
  })
}
