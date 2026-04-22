/**
 * Auto-updater preload API — check, download, and install app updates.
 */
import { ipcRenderer } from 'electron'

export const updaterSection = {
  updater: {
    /** Trigger a check for updates. Status is pushed via onStatus(). */
    check: () =>
      ipcRenderer.invoke('updater:check') as Promise<{ success: boolean; error?: string }>,
    /** Start downloading an available update (Windows / Linux only). */
    download: () =>
      ipcRenderer.invoke('updater:download') as Promise<{ success: boolean; error?: string }>,
    /** Quit the app and install the downloaded update (Windows / Linux only). */
    install: () =>
      ipcRenderer.invoke('updater:install') as Promise<{ success: boolean; error?: string }>,
    /** Get the current app version. */
    getVersion: () =>
      ipcRenderer.invoke('updater:getVersion') as Promise<{ version: string }>,
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
}
