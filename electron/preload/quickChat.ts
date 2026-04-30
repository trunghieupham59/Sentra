/**
 * Quick chat preload API — bridges the Raycast-style quick chat window and
 * the main renderer without exposing Node primitives.
 */
import { ipcRenderer } from 'electron'

export interface QuickChatSeedPayload {
  question: string
  response?: string
  provider: string
  model: string
}

export const quickChatSection = {
  quickChat: {
    hide: () => ipcRenderer.invoke('quick-chat:hide'),
    openSettings: () => ipcRenderer.invoke('quick-chat:open-settings'),
    openInChat: (payload?: QuickChatSeedPayload) => ipcRenderer.invoke('quick-chat:open-in-chat', payload),
    onShow: (cb: () => void) => {
      const handler = () => cb()
      ipcRenderer.on('quick-chat:show', handler)
      return () => ipcRenderer.removeListener('quick-chat:show', handler)
    },
    onOpenSettings: (cb: () => void) => {
      const handler = () => cb()
      ipcRenderer.on('quick-chat:open-settings', handler)
      return () => ipcRenderer.removeListener('quick-chat:open-settings', handler)
    },
    onOpenInChat: (cb: (payload: QuickChatSeedPayload | null) => void) => {
      const handler = (_: unknown, payload: QuickChatSeedPayload | null) => cb(payload)
      ipcRenderer.on('quick-chat:open-in-main-chat', handler)
      return () => ipcRenderer.removeListener('quick-chat:open-in-main-chat', handler)
    },
  },
}
