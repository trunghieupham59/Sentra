import { app } from 'electron'
import type { IpcMain, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

/**
 * Returns true when the error is caused by a missing update YAML file
 * (e.g. 404 from GitHub Releases, ENOENT on local feed, or generic "not found").
 * In this case we treat the situation as "no update available" rather than
 * a hard error, so the UI can display a friendly "up to date" message instead
 * of a red error banner.
 */
function isYamlNotFoundError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    msg.includes('404') ||
    msg.includes('not found') ||
    msg.includes('enoent') ||
    msg.includes('cannot find') ||
    msg.includes('httperror')
  )
}

export type UpdaterStatus =
  | { type: 'idle' }
  | { type: 'checking' }
  | { type: 'available';     version: string }
  | { type: 'not-available'; version: string }
  | { type: 'downloading';   percent: number; bytesPerSecond: number; transferred: number; total: number }
  | { type: 'downloaded';    version: string }
  | { type: 'error';         error: string }

export function registerUpdaterHandlers(
  ipc: IpcMain,
  getMainWindow: () => BrowserWindow | null,
) {
  // Do not run auto-updater in development mode (no packaged app context)
  const isDev = !app.isPackaged

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  // Silence logger in production; you can redirect to a file logger if needed
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
    // If the YAML file is simply missing on the server, report "not available"
    // instead of surfacing a confusing error to the user.
    if (isYamlNotFoundError(err)) {
      push({ type: 'not-available', version: app.getVersion() })
    } else {
      push({ type: 'error', error: err?.message ?? String(err) })
    }
  })

  // ── IPC handlers ──────────────────────────────────────────────────────────

  /** Trigger an update check (no-op in dev) */
  ipc.handle('updater:check', async () => {
    if (isDev) {
      // In dev, simulate a "not-available" response after a short delay
      setTimeout(() => push({ type: 'not-available', version: app.getVersion() }), 800)
      return { success: true }
    }
    try {
      await autoUpdater.checkForUpdates()
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // The autoUpdater 'error' event fires before the promise rejects, so the
      // status has already been pushed by the event handler above.  We only
      // need to return the structured error here — no extra push needed.
      return { success: false, error: msg }
    }
  })

  /** Start downloading the available update */
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

  /** Quit and install the downloaded update */
  ipc.handle('updater:install', () => {
    if (isDev) return { success: false, error: 'Not available in development mode' }
    autoUpdater.quitAndInstall(false, true)
    return { success: true }
  })

  /** Return the current app version */
  ipc.handle('updater:getVersion', () => {
    return { version: app.getVersion() }
  })
}
