import path from 'node:path'
import { app, BrowserWindow, desktopCapturer, ipcMain, nativeImage, nativeTheme, screen, shell } from 'electron'
import { registerChatHandlers } from './ipc/chat'
import { registerWebSearchHandlers } from './ipc/webSearch'
import { initGlobalHotkey } from './ipc/globalHotkey'
import { registerImageTranslateHandlers } from './ipc/imageTranslate'
import { registerKeychainHandlers } from './ipc/keychain'
import { initLegacyAssistant, setLocalServerAccessors } from './ipc/legacyAssistant'
import { getServerToken, LOCAL_SERVER_PORT, startLocalServer, stopLocalServer } from './ipc/localServer'
import { registerModelsHandlers } from './ipc/models'
import { registerTranscribeHandlers } from './ipc/transcribe'
import { registerTranslateHandlers } from './ipc/translate'
import { registerSubtitleHandlers } from './ipc/subtitle'
import { registerSystemHandlers } from './ipc/system'
import { registerTtsHandlers } from './ipc/tts'
import { registerUpdaterHandlers } from './ipc/updater'

// Allow audio autoplay after async operations (TTS API calls lose user-gesture context)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Set app name
app.setName('Viezan')

// ── Window constants ──────────────────────────────────────────────────────────
/** HC-NEW-11: Named color constants for window background (avoids magic hex strings) */
const WIN_BG_DARK  = '#1a1a2e'
const WIN_BG_LIGHT = '#ffffff'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    minWidth: 960,
    minHeight: 580,
    title: 'Viezan',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 14 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? WIN_BG_DARK : WIN_BG_LIGHT,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
    icon: process.platform === 'win32'
      ? path.join(__dirname, '..', 'build', 'icon.ico')
      : path.join(__dirname, '..', 'build', 'icon.png'),
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.webContents.setZoomLevel(0)
    mainWindow?.show()
  })

  // Disable default Cmd+=/Cmd+- zoom shortcuts
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isMac = process.platform === 'darwin'
    const ctrlOrCmd = isMac ? input.meta : input.control
    if (ctrlOrCmd && (input.key === '+' || input.key === '=' || input.key === '-' || input.key === '_' || input.key === '0')) {
      event.preventDefault()
    }
  })

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Required for getDisplayMedia to work in Electron renderer process.
  // Without this handler, getDisplayMedia throws "Not supported".
  // 'loopback' captures system audio on macOS (requires Screen Recording permission).
  mainWindow.webContents.session.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      if (sources.length > 0) {
        callback({ video: sources[0], audio: 'loopback' })
      } else {
        callback({})
      }
    }).catch(() => {
      callback({})
    })
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ── Floating Subtitle Window ──────────────────────────────────────────────────
let subtitleWindow: BrowserWindow | null = null

/** HC-NEW-08: px gap between subtitle window bottom edge and the screen's taskbar/dock */
const SUBTITLE_BOTTOM_MARGIN = 40

function createSubtitleWindow() {
  const { workAreaSize } = screen.getPrimaryDisplay()
  const winW = 660
  const winH = 300

  subtitleWindow = new BrowserWindow({
    width:  winW,
    height: winH,
    minWidth:  400,
    minHeight: 252,
    x: Math.round(workAreaSize.width  / 2 - winW / 2),
    y: Math.round(workAreaSize.height - winH - SUBTITLE_BOTTOM_MARGIN),
    frame:     false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow:   false,
    skipTaskbar: true,
    resizable:   true,
    movable:     true,
    webPreferences: {
      preload: path.join(__dirname, 'subtitle-preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox: true,
    },
  })

  // Float above all other app windows in the current workspace.
  // We deliberately avoid setVisibleOnAllWorkspaces() because it triggers a
  // macOS activation-policy side-effect that hides the app's dock icon.
  // 'pop-up-menu' is high enough to overlay most app windows while keeping
  // the main window's dock icon visible at all times.
  subtitleWindow.setAlwaysOnTop(true, 'pop-up-menu')

  if (isDev) {
    subtitleWindow.loadURL('http://localhost:5173/subtitle.html')
  } else {
    subtitleWindow.loadFile(path.join(__dirname, '..', 'dist', 'subtitle.html'))
  }

  subtitleWindow.once('ready-to-show', () => subtitleWindow?.show())

  subtitleWindow.on('closed', () => {
    subtitleWindow = null
    // Notify the main window so the toggle button goes back to off state
    mainWindow?.webContents.send('subtitle:closed')
  })
}

app.whenReady().then(() => {
  // Set macOS dock icon using base64 (no file path dependency)
  if (process.platform === 'darwin') {
    try {
      // Try base64 first (generated by generate-icons.js)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const iconBase64: string = require(path.join(__dirname, '..', 'build', 'icon-base64.js'))
      const icon = nativeImage.createFromDataURL(iconBase64)
      if (!icon.isEmpty()) {
        app.dock?.setIcon(icon)
      }
    } catch {
      // Fallback to file path
      const iconPath = path.join(__dirname, '..', 'build', 'icon.png')
      const icon = nativeImage.createFromPath(iconPath)
      if (!icon.isEmpty()) {
        app.dock?.setIcon(icon)
      }
    }
  }

  createWindow()

  // Register IPC handlers
  registerKeychainHandlers(ipcMain)
  registerTranslateHandlers(ipcMain)
  registerModelsHandlers(ipcMain)
  registerTranscribeHandlers(ipcMain)
  registerTtsHandlers(ipcMain)
  registerImageTranslateHandlers(ipcMain)
  registerChatHandlers(ipcMain)
  registerWebSearchHandlers(ipcMain)

  // Global hotkey — translate selected text in any OS application
  initGlobalHotkey(ipcMain, () => mainWindow)

  // Local HTTP server — used by the Viezan Chrome Extension
  startLocalServer(ipcMain)

  // Legacy Assistant — floating icon injected directly into browsers via osascript
  setLocalServerAccessors(() => getServerToken(), () => LOCAL_SERVER_PORT)
  initLegacyAssistant(ipcMain)

  // Subtitle window IPC handlers
  registerSubtitleHandlers(ipcMain, () => subtitleWindow, () => mainWindow, createSubtitleWindow)

  // System handlers — screen permission & openExternal
  registerSystemHandlers(ipcMain)

  // Auto-updater — check & install updates from GitHub Releases
  registerUpdaterHandlers(ipcMain, () => mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('will-quit', () => {
  // Unregister all global shortcuts before quitting
  const { globalShortcut } = require('electron')
  globalShortcut.unregisterAll()
  stopLocalServer()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Security: Prevent new window creation
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl)
    if (parsedUrl.protocol !== 'file:' && navigationUrl !== 'http://localhost:5173/') {
      event.preventDefault()
    }
  })
})
