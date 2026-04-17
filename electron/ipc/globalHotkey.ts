/**
 * Global Hotkey — translate selected text in ANY app by pressing a custom shortcut.
 *
 * Flow when hotkey fires:
 *   1. Simulate Cmd+C / Ctrl+C to copy selected text from the foreground app
 *   2. Wait briefly for clipboard to update
 *   3. Read selected text from clipboard
 *   4. Translate using stored provider/model/language settings
 *   5. Write translated text to clipboard
 *   6. Simulate Cmd+V / Ctrl+V to paste (replacing original selection)
 *   7. Restore original clipboard content after 1.5 s
 */
import { exec } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app, type BrowserWindow, clipboard, globalShortcut } from 'electron'
import { lightweightTranslate } from './lightweightTranslate'


/** Thời gian chờ sau khi gửi Cmd+C để OS cập nhật clipboard (ms) */
const CLIPBOARD_COPY_WAIT_MS  = 220
/** Thời gian chờ sau khi gửi Cmd+V để paste hoàn thành (ms) */
const CLIPBOARD_PASTE_WAIT_MS = 100
/** Thời gian trước khi restore clipboard sau khi paste (ms) */
const CLIPBOARD_RESTORE_WAIT_MS = 1_500
// ── Types ────────────────────────────────────────────────────────────────────

export interface HotkeySettings {
  hotkey: string       // Electron accelerator, e.g. "CommandOrControl+Shift+T"
  enabled: boolean
  provider: string     // 'gemini' | 'claude' | 'openai'
  model: string
  sourceLang: string   // 'auto' or BCP-47 code
  targetLang: string   // BCP-47 code
}

// ── Persistence ───────────────────────────────────────────────────────────────

const SETTINGS_FILE = 'hotkey-settings.json'

const DEFAULT_SETTINGS: HotkeySettings = {
  hotkey: '',
  enabled: false,
  provider: 'gemini',
  model: 'gemini-2.0-flash',
  sourceLang: 'auto',
  targetLang: 'en',
}

let currentSettings: HotkeySettings = { ...DEFAULT_SETTINGS }

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), SETTINGS_FILE)
}

function loadSettings(): HotkeySettings {
  try {
    const filePath = getSettingsPath()
    if (!fs.existsSync(filePath)) return { ...DEFAULT_SETTINGS }
    const raw = fs.readFileSync(filePath, 'utf-8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function saveSettings(settings: HotkeySettings): void {
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
  } catch (e) {
    console.error('[GlobalHotkey] Failed to save settings:', e)
  }
}

// ── OS-level clipboard actions ────────────────────────────────────────────────

/** Simulate Cmd+C (macOS) / Ctrl+C (Windows/Linux) then wait for clipboard. */
function simulateCopyAndWait(): Promise<void> {
  return new Promise((resolve) => {
    if (process.platform === 'darwin') {
      exec(
        `osascript -e 'tell application "System Events" to keystroke "c" using command down'`,
        () => setTimeout(resolve, CLIPBOARD_COPY_WAIT_MS)
      )
    } else if (process.platform === 'win32') {
      exec(
        `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^c')"`,
        () => setTimeout(resolve, CLIPBOARD_COPY_WAIT_MS)
      )
    } else {
      // Linux — requires xdotool
      exec('xdotool key ctrl+c', () => setTimeout(resolve, CLIPBOARD_COPY_WAIT_MS))
    }
  })
}

/** Simulate Cmd+V (macOS) / Ctrl+V (Windows/Linux). */
function simulatePaste(): Promise<void> {
  return new Promise((resolve) => {
    if (process.platform === 'darwin') {
      exec(
        `osascript -e 'tell application "System Events" to keystroke "v" using command down'`,
        () => setTimeout(resolve, CLIPBOARD_PASTE_WAIT_MS)
      )
    } else if (process.platform === 'win32') {
      exec(
        `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`,
        () => setTimeout(resolve, CLIPBOARD_PASTE_WAIT_MS)
      )
    } else {
      exec('xdotool key ctrl+v', () => setTimeout(resolve, CLIPBOARD_PASTE_WAIT_MS))
    }
  })
}

// ── Hotkey registration ───────────────────────────────────────────────────────

let isTranslating = false

function registerHotkey(
  settings: HotkeySettings,
  getMainWindow: () => BrowserWindow | null
): boolean {
  if (!settings.hotkey || !settings.enabled) return true

  try {
    const ok = globalShortcut.register(settings.hotkey, async () => {
      if (isTranslating) return
      isTranslating = true

      const backupClipboard = clipboard.readText()

      try {
        await simulateCopyAndWait()
        const selectedText = clipboard.readText()

        if (!selectedText || selectedText.trim() === '' || selectedText === backupClipboard) {
          isTranslating = false
          return
        }

        // Notify renderer: translation starting
        getMainWindow()?.webContents.send('hotkey:translating', { text: selectedText })

        const result = await lightweightTranslate({
          text: selectedText,
          targetLang: currentSettings.targetLang,
          provider: currentSettings.provider,
          model: currentSettings.model,
        })
        if (!result.success || !result.translatedText) throw new Error(result.error ?? 'Translation failed')
        const translated = result.translatedText

        // Paste translated text
        clipboard.writeText(translated)
        await simulatePaste()

        // Notify renderer: done
        getMainWindow()?.webContents.send('hotkey:translated', {
          original: selectedText,
          translated,
        })

        // Restore clipboard after a short delay so paste completes first
        setTimeout(() => clipboard.writeText(backupClipboard), CLIPBOARD_RESTORE_WAIT_MS)
      } catch (err) {
        clipboard.writeText(backupClipboard)
        console.error('[GlobalHotkey] Translation error:', err)
        getMainWindow()?.webContents.send('hotkey:error', {
          error: err instanceof Error ? err.message : String(err),
        })
      } finally {
        isTranslating = false
      }
    })
    return ok
  } catch (e) {
    console.error('[GlobalHotkey] Registration error:', e)
    return false
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function initGlobalHotkey(
  ipcMain: Electron.IpcMain,
  getMainWindow: () => BrowserWindow | null
): void {
  // Load persisted settings and register hotkey if enabled
  currentSettings = loadSettings()
  if (currentSettings.enabled && currentSettings.hotkey) {
    const ok = registerHotkey(currentSettings, getMainWindow)
    if (!ok) {
      console.warn('[GlobalHotkey] Could not register saved hotkey (already in use?)')
    }
  }

  /** Update (and optionally re-register) hotkey settings */
  ipcMain.handle('hotkey:update', (_event, settings: Partial<HotkeySettings>) => {
    try {
      // Unregister current hotkey first
      if (currentSettings.hotkey) {
        try { globalShortcut.unregister(currentSettings.hotkey) } catch { /* ignore */ }
      }

      currentSettings = { ...currentSettings, ...settings }
      saveSettings(currentSettings)

      if (currentSettings.enabled && currentSettings.hotkey) {
        const ok = registerHotkey(currentSettings, getMainWindow)
        if (!ok) {
          // Mark as disabled if registration failed
          currentSettings.enabled = false
          saveSettings(currentSettings)
          return { success: false, error: 'Hotkey is already in use by another application.' }
        }
      }

      return { success: true, settings: currentSettings }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  /** Return current hotkey settings */
  ipcMain.handle('hotkey:get', () => ({
    success: true,
    settings: currentSettings,
  }))

  /** Unregister hotkey and disable */
  ipcMain.handle('hotkey:disable', () => {
    try {
      if (currentSettings.hotkey) {
        globalShortcut.unregister(currentSettings.hotkey)
      }
      currentSettings.enabled = false
      saveSettings(currentSettings)
      return { success: true }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })
}
