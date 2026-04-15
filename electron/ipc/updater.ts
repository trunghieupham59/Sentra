import { app } from 'electron'
import type { IpcMain, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

// ─── Error-detection patterns ──────────────────────────────────────────────
// Patterns that indicate the update YAML / metadata file is simply absent on
// the server (e.g. first release, 404 on GitHub, local ENOENT).  We treat
// this as "no update" rather than a hard error.
const YAML_NOT_FOUND_PATTERNS = [
  '404',
  'not found',
  'enoent',
  'cannot find',
  'httperror',
] as const

// Patterns that indicate a macOS code-signature validation failure.
// Squirrel (used by electron-updater on macOS) rejects unsigned or
// differently-signed app bundles before installation.
const CODE_SIGNATURE_PATTERNS = [
  'code signature',
  'did not pass validation',
  'code object is not signed',
  'a sealed resource is missing',
  'shipit',
  'codesign',
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────
function errMsg(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).toLowerCase()
}

function matchesPatterns(err: unknown, patterns: readonly string[]): boolean {
  const msg = errMsg(err)
  return patterns.some((p) => msg.includes(p))
}

// ─── Types ─────────────────────────────────────────────────────────────────
export type UpdaterStatus =
  | { type: 'idle' }
  | { type: 'checking' }
  | { type: 'available';     version: string }
  | { type: 'not-available'; version: string }
  | { type: 'downloading';   percent: number; bytesPerSecond: number; transferred: number; total: number }
  | { type: 'downloaded';    version: string }
  | { type: 'error-codesign' }
  | { type: 'error';         error: string }

// ─── Registration ──────────────────────────────────────────────────────────
export function registerUpdaterHandlers(
  ipc: IpcMain,
  getMainWindow: () => BrowserWindow | null,
) {
  const isDev = !app.isPackaged

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null

  const push = (payload: UpdaterStatus) => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('updater:status', payload)
    }
  }

  autoUpdater.on('checking-for-update', () => {
    push({ type: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    push({ type: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', (info) => {
    push({ type: 'not-available', version: info.version })
  })

  autoUpdater.on('download-progress', (progress) => {
    push({
      type: 'downloading',
      percent: Math.round(progress.percent),
      bytesPerSecond: Math.round(progress.bytesPerSecond),
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    push({ type: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (err) => {
    if (matchesPatterns(err, YAML_NOT_FOUND_PATTERNS)) {
      // Metadata file not found → treat as "up to date"
      push({ type: 'not-available', version: app.getVersion() })
    } else if (matchesPatterns(err, CODE_SIGNATURE_PATTERNS)) {
      // macOS Gatekeeper / Squirrel rejected the unsigned bundle
      push({ type: 'error-codesign' })
    } else {
      push({ type: 'error', error: err?.message ?? String(err) })
    }
  })

  // ── IPC handlers ───────────────────────────────────────────────────────

  ipc.handle('updater:check', async () => {
    if (isDev) {
      setTimeout(() => push({ type: 'not-available', version: app.getVersion() }), 800)
      return { success: true }
    }
    try {
      await autoUpdater.checkForUpdates()
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  ipc.handle('updater:download', async () => {
    if (isDev) return { success: false, error: 'Not available in development mode' }
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      push({ type: 'error', error: msg })
      return { success: false, error: msg }
    }
  })

  ipc.handle('updater:install', () => {
    if (isDev) return { success: false, error: 'Not available in development mode' }
    autoUpdater.quitAndInstall(false, true)
    return { success: true }
  })

  ipc.handle('updater:getVersion', () => {
    return { version: app.getVersion() }
  })
}
