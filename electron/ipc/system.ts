import type { IpcMain } from 'electron'
import { shell, systemPreferences } from 'electron'

export function registerSystemHandlers(ipc: IpcMain) {
  // ── Check Screen Recording permission (macOS) ───────────────────────────
  ipc.handle('app:checkScreenPermission', () => {
    if (process.platform === 'darwin') {
      return systemPreferences.getMediaAccessStatus('screen') // 'granted' | 'denied' | 'restricted' | 'unknown' | 'not-determined'
    }
    return 'granted'
  })

  // ── Open external URL (used by renderer to open System Settings deep links) ──
  ipc.handle('app:openExternal', async (_event, url: string) => {
    // Allowlist: only permit known safe URL schemes
    const allowed = url.startsWith('https://') || url.startsWith('x-apple.systempreferences:')
    if (!allowed) return
    try {
      await shell.openExternal(url)
    } catch (err) {
      console.error('[openExternal] failed:', err)
    }
  })
}
