/**
 * Subtitle overlay preload API — floating subtitle window shown above all OS windows.
 */
import { ipcRenderer } from 'electron'

export const subtitleSection = {
  subtitle: {
    /** Create and show the subtitle window (bottom-center of primary display) */
    show: () => ipcRenderer.invoke('subtitle:show'),
    /** Close the subtitle window */
    hide: () => ipcRenderer.invoke('subtitle:hide'),
    /** Push a new translated sentence to the subtitle window */
    update: (text: string, isTranslating: boolean) =>
      ipcRenderer.invoke('subtitle:update', { text, isTranslating }),
    /** Apply appearance settings (text color, font size, bg opacity) */
    setStyle: (style: { textColor: string; fontSize: number; bgOpacity: number }) =>
      ipcRenderer.invoke('subtitle:setStyle', style),
    /**
     * Register a one-time listener that fires when the subtitle window is closed
     * (either by clicking ✕ or programmatically).
     * Returns a cleanup function — call it to remove the listener.
     */
    onClosed: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('subtitle:closed', handler)
      return () => ipcRenderer.removeListener('subtitle:closed', handler)
    },
  },
}
