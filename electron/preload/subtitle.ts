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
    /** Push the latest raw (source) text to show above the translation */
    setSourceText: (text: string, segId?: string) =>
      ipcRenderer.invoke('subtitle:setSourceText', { text, segId }),
    /** Push current session state to subtitle window */
    pushState: (state: {
      selectedProvider: string
      selectedModel: string
      isActive: boolean
      isTranscribing: boolean
      isTranslating: boolean
      availableModels: { id: string; name: string }[]
      audioMode: string
      targetLang: string
      locale?: string
    }) => ipcRenderer.invoke('subtitle:setState', state),
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
    /** Listen for Start action from subtitle window. Returns cleanup fn. */
    onStart: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('subtitle:action:start', handler)
      return () => ipcRenderer.removeListener('subtitle:action:start', handler)
    },
    /** Listen for Stop action from subtitle window. Returns cleanup fn. */
    onStop: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('subtitle:action:stop', handler)
      return () => ipcRenderer.removeListener('subtitle:action:stop', handler)
    },
    /** Listen for provider change from subtitle window. Returns cleanup fn. */
    onSetProvider: (callback: (provider: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, provider: string) => callback(provider)
      ipcRenderer.on('subtitle:action:setProvider', handler)
      return () => ipcRenderer.removeListener('subtitle:action:setProvider', handler)
    },
    /** Listen for model change from subtitle window. Returns cleanup fn. */
    onSetModel: (callback: (model: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, model: string) => callback(model)
      ipcRenderer.on('subtitle:action:setModel', handler)
      return () => ipcRenderer.removeListener('subtitle:action:setModel', handler)
    },
    /** Listen for audio mode change from subtitle window. Returns cleanup fn. */
    onSetAudioMode: (callback: (mode: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, mode: string) => callback(mode)
      ipcRenderer.on('subtitle:action:setAudioMode', handler)
      return () => ipcRenderer.removeListener('subtitle:action:setAudioMode', handler)
    },
    /** Listen for target language change from subtitle window. Returns cleanup fn. */
    onSetTargetLang: (callback: (lang: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, lang: string) => callback(lang)
      ipcRenderer.on('subtitle:action:setTargetLang', handler)
      return () => ipcRenderer.removeListener('subtitle:action:setTargetLang', handler)
    },
    /** Listen for style changes from subtitle window. Returns cleanup fn. */
    onStyleUpdate: (callback: (style: { textColor: string; fontSize: number; bgOpacity: number }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, style: { textColor: string; fontSize: number; bgOpacity: number }) => callback(style)
      ipcRenderer.on('subtitle:action:updateStyle', handler)
      return () => ipcRenderer.removeListener('subtitle:action:updateStyle', handler)
    },
    /** Listen for "new session / clear" action from subtitle window. Returns cleanup fn. */
    onClear: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('subtitle:action:clear', handler)
      return () => ipcRenderer.removeListener('subtitle:action:clear', handler)
    },
  },
}
