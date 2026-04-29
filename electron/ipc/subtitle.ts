import type { BrowserWindow, IpcMain } from 'electron'
import { isLocalProvider, LOCAL_AI_PLACEHOLDER_KEY } from './localAi'
import { getStoredApiKey } from './storage'
import { streamTranslation } from './translate'

export function registerSubtitleHandlers(
  ipc: IpcMain,
  getSubtitleWindow: () => BrowserWindow | null,
  getMainWindow: () => BrowserWindow | null,
  createSubtitleWindow: () => void,
) {
  ipc.handle('subtitle:show', () => {
    const win = getSubtitleWindow()
    if (!win || win.isDestroyed()) {
      createSubtitleWindow()
    } else {
      win.show()
    }
  })

  ipc.handle('subtitle:hide', () => {
    const win = getSubtitleWindow()
    if (win && !win.isDestroyed()) {
      win.close()
    }
  })

  ipc.handle('subtitle:update', (_event, { text, isTranslating }: { text: string; isTranslating: boolean }) => {
    const win = getSubtitleWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('subtitle:text', { text, isTranslating })
    }
  })

  ipc.handle('subtitle:setStyle', (_event, style: { textColor: string; fontSize: number; bgOpacity: number }) => {
    const win = getSubtitleWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('subtitle:style', style)
    }
  })

  // ── Source text (raw STT text shown above translation) ─────────────────────
  ipc.handle('subtitle:setSourceText', (_event, { text, segId }: { text: string; segId?: string }) => {
    const win = getSubtitleWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('subtitle:sourceText', { text, segId })
    }
  })

  // ── State sync from main renderer → subtitle ─────────────────────────────
  ipc.handle('subtitle:setState', (_event, state: {
    selectedProvider: string
    selectedModel: string
    isActive: boolean
    isTranscribing: boolean
    isTranslating: boolean
    availableModels: { id: string; name: string }[]
    audioMode: string
    targetLang: string
    locale?: string
  }) => {
    const win = getSubtitleWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('subtitle:state', state)
    }
  })

  // ── Actions FROM subtitle window → forward to main renderer ────────────────
  // These are fired by subtitle.html via ipcRenderer.send (fire-and-forget).
  // The main process forwards them to the main window so the React app can react.

  ipc.on('subtitle:action:start', () => {
    getMainWindow()?.webContents.send('subtitle:action:start')
  })

  ipc.on('subtitle:action:stop', () => {
    getMainWindow()?.webContents.send('subtitle:action:stop')
  })

  ipc.on('subtitle:action:setProvider', (_event, provider: string) => {
    getMainWindow()?.webContents.send('subtitle:action:setProvider', provider)
  })

  ipc.on('subtitle:action:setModel', (_event, model: string) => {
    getMainWindow()?.webContents.send('subtitle:action:setModel', model)
  })

  ipc.on('subtitle:action:setAudioMode', (_event, mode: string) => {
    getMainWindow()?.webContents.send('subtitle:action:setAudioMode', mode)
  })

  ipc.on('subtitle:action:setTargetLang', (_event, lang: string) => {
    getMainWindow()?.webContents.send('subtitle:action:setTargetLang', lang)
  })

  ipc.on('subtitle:action:updateStyle', (_event, style: { textColor: string; fontSize: number; bgOpacity: number }) => {
    getMainWindow()?.webContents.send('subtitle:action:updateStyle', style)
  })

  ipc.on('subtitle:action:clear', () => {
    getMainWindow()?.webContents.send('subtitle:action:clear')
  })

  // Fired when the ✕ button inside subtitle.html is clicked
  ipc.on('subtitle:close', () => {
    const win = getSubtitleWindow()
    if (win && !win.isDestroyed()) {
      win.close()
    }
    getMainWindow()?.webContents.send('subtitle:closed')
  })

  // ── Streaming translation for subtitle window ─────────────────────────────
  /**
   * `translate:live-stream` — like `translate` but streams each AI token directly
   * to the subtitle window in real-time so the user sees text appear as the AI
   * generates it, rather than waiting for the full response.
   *
   * Protocol pushed to subtitleWindow:
   *   subtitle:stream:start  — clears the current subtitle text
   *   subtitle:stream:token  — appends one token string
   *   subtitle:stream:end    — signals completion (hide cursor)
   *
   * Returns the complete translated text to the renderer (same shape as `translate`).
   */
  ipc.handle('translate:live-stream', async (
    _event,
    params: {
      provider: string; model: string
      sourceText: string; sourceLang: string; targetLang: string
      translationStyle?: string; segId?: string
    }
  ) => {
    const { provider, model, sourceText, sourceLang, targetLang, translationStyle } = params

    if (!sourceText.trim()) return { success: false, error: 'Source text is empty' }

    const apiKey = isLocalProvider(provider) ? LOCAL_AI_PLACEHOLDER_KEY : await getStoredApiKey(provider)
    if (!apiKey) return { success: false, error: `No API key for ${provider}`, errorCode: 'NO_API_KEY' }

    const sendToSubtitle = (channel: string, payload?: unknown) => {
      const win = getSubtitleWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send(channel, payload)
      }
    }

    const { segId } = params

    sendToSubtitle('subtitle:stream:start', { segId })

    try {
      const fullText = await streamTranslation(
        provider, apiKey, model,
        sourceText, sourceLang, targetLang,
        (translationStyle ?? 'general') as 'general' | 'formal' | 'casual' | 'business' | 'technical' | 'natural',
        (token) => sendToSubtitle('subtitle:stream:token', token)
      )
      sendToSubtitle('subtitle:stream:end', { segId })
      return { success: true, translatedText: fullText }
    } catch (error: unknown) {
      sendToSubtitle('subtitle:stream:end', { segId })
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })
}
