/**
 * Legacy Assistant preload API — no-extension browser injection via bookmarklet.
 */
import { ipcRenderer } from 'electron'

export const legacyAssistantSection = {
  legacyAssistant: {
    /** Get current settings */
    get: () => ipcRenderer.invoke('legacyAssistant:get'),
    /** Update settings (enable auto-inject, change targetLang, etc.) */
    update: (settings: { enabled?: boolean; targetLang?: string }) =>
      ipcRenderer.invoke('legacyAssistant:update', settings),
    /**
     * Get the bookmarklet `javascript:` URL — embed the full assistant script
     * so the user can drag it to their bookmarks bar and click to inject on
     * any page without installing a browser extension.
     */
    getBookmarklet: () => ipcRenderer.invoke('legacyAssistant:getBookmarklet'),
    /** Immediately trigger one injection attempt into the frontmost browser */
    injectNow: () => ipcRenderer.invoke('legacyAssistant:injectNow'),
  },
}
