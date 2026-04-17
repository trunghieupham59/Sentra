import type { IpcMain, BrowserWindow } from 'electron'
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
      // Resize window height to comfortably fit text at the chosen font size
      const winH = Math.max(90, Math.round(style.fontSize * 3.8 + 48))
      const [w] = win.getSize()
      win.setSize(w, winH)
    }
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
      translationStyle?: string
    }
  ) => {
    const { provider, model, sourceText, sourceLang, targetLang, translationStyle } = params

    if (!sourceText.trim()) return { success: false, error: 'Source text is empty' }

    const apiKey = await getStoredApiKey(provider)
    if (!apiKey) return { success: false, error: `No API key for ${provider}`, errorCode: 'NO_API_KEY' }

    const sendToSubtitle = (channel: string, payload?: unknown) => {
      const win = getSubtitleWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send(channel, payload)
      }
    }

    sendToSubtitle('subtitle:stream:start')

    try {
      const fullText = await streamTranslation(
        provider, apiKey, model,
        sourceText, sourceLang, targetLang,
        (translationStyle ?? 'neutral') as 'friendly' | 'neutral' | 'professional' | 'business' | 'slack' | 'polite' | 'technical',
        (token) => sendToSubtitle('subtitle:stream:token', token)
      )
      sendToSubtitle('subtitle:stream:end')
      return { success: true, translatedText: fullText }
    } catch (error: unknown) {
      sendToSubtitle('subtitle:stream:end')
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })
}
