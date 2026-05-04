import { lazy, Suspense, useEffect } from 'react'
import { SettingsModal } from './components/SettingsModal'
import { Sidebar } from './components/Sidebar'
import { PROVIDERS } from './constants/providers'
import { flushPersistedStore, useAppStore } from './store/useAppStore'
import type { Provider, QuickChatSeedPayload } from './types'
import { detectSystemLocale } from './utils/locale'


const TranslatePage = lazy(() => import('./pages/TranslatePage').then(module => ({ default: module.TranslatePage })))
const LiveTranslatePage = lazy(() => import('./pages/LiveTranslatePage').then(module => ({ default: module.LiveTranslatePage })))
const ChatPage = lazy(() => import('./pages/ChatPage').then(module => ({ default: module.ChatPage })))
const HistoryPage = lazy(() => import('./pages/HistoryPage').then(module => ({ default: module.HistoryPage })))
const DictionaryPage = lazy(() => import('./pages/DictionaryPage').then(module => ({ default: module.DictionaryPage })))

const FONT_SIZE_MAP = {
  small:  '13px',
  medium: '15px',
  large:  '17px',
}

/** Height (px) of the macOS traffic-light drag region at the top of the window. */
const MACOS_TITLEBAR_HEIGHT_PX = 40

function PageFallback() {
  return <div className="app-page" aria-hidden="true" />
}

function App() {
  const {
    activePage,
    localeAuto,
    setKeyStatus,
    setLocaleFromSystem,
    fontSize,
    selectedProvider,
    selectedModels,
    ttsMode,
    ttsVoice,
    createChatSession,
    setActiveChatSession,
    addChatMessage,
    setActivePage,
    openSettings,
  } = useAppStore()

  // Auto-detect system language on startup (only when localeAuto is enabled)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally run only once on mount
  useEffect(() => {
    if (localeAuto) {
      setLocaleFromSystem(detectSystemLocale())
    }
  }, []) // Only run once on mount

  // Apply font size to document root
  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZE_MAP[fontSize ?? 'medium']
  }, [fontSize])

  // Sync active provider/model to main process so the local server's /api/config
  // always reflects the user's current selection in the app.
  useEffect(() => {
    if (!window.api?.localServer) return
    const model = selectedModels[selectedProvider] ?? ''
    window.api.localServer.syncConfig({ provider: selectedProvider, model, ttsMode, ttsVoice })
    // The Quick Chat popup is a separate BrowserWindow with its own Zustand store
    // hydrated from localStorage. Flush the debounced persist write immediately
    // whenever the active provider/model changes so the popup sees the latest
    // selection the next time it shows up — without waiting for the 500 ms
    // debounce window.
    flushPersistedStore()
  }, [selectedProvider, selectedModels, ttsMode, ttsVoice])

  // Also flush on tab/window hide — covers any other persisted state (system
  // prompt, locale, etc.) that the popup reads from the same store.
  useEffect(() => {
    const onHide = () => flushPersistedStore()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('blur', onHide)
    window.addEventListener('beforeunload', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('blur', onHide)
      window.removeEventListener('beforeunload', onHide)
    }
  }, [])


  // Listen for quick chat window actions forwarded from the main process.
  useEffect(() => {
    if (!window.api?.quickChat) return
    const unsubOpenSettings = window.api.quickChat.onOpenSettings(() => {
      openSettings()
    })
    const unsubOpenInChat = window.api.quickChat.onOpenInChat((payload: QuickChatSeedPayload | null) => {
      if (!payload) {
        setActivePage('chat')
        return
      }

      const provider = payload.provider as Provider
      const sessionId = createChatSession(provider, payload.model)
      setActiveChatSession(sessionId)
      addChatMessage(sessionId, {
        id: `msg-${Date.now()}-quick-u`,
        role: 'user',
        content: [{ type: 'text', text: payload.question }],
        timestamp: Date.now(),
      })
      if (payload.response) {
        addChatMessage(sessionId, {
          id: `msg-${Date.now()}-quick-a`,
          role: 'assistant',
          content: [{ type: 'text', text: payload.response }],
          timestamp: Date.now(),
        })
      }
      setActivePage('chat')
    })
    return () => {
      unsubOpenSettings()
      unsubOpenInChat()
    }
  }, [openSettings, setActivePage, createChatSession, setActiveChatSession, addChatMessage])

  // On startup, check which API keys exist in keychain
  useEffect(() => {
    const checkKeys = async () => {
      if (!window.api) return
      for (const provider of PROVIDERS) {
        try {
          const result = await window.api.keychain.hasKey(provider.id)
          setKeyStatus(provider.id as Provider, result.exists)
        } catch (error) {
          console.error(`Error checking key for ${provider.id}:`, error)
        }
      }
    }
    checkKeys()
  }, [setKeyStatus])

  const isMac = window.api?.platform === 'darwin'

  return (
    <div className="app-shell">
      {/* Full-width macOS traffic light drag region — only on macOS */}
      {isMac && (
        <>
          <div className="titlebar-drag flex-shrink-0 w-full bg-white/75 dark:bg-neutral-950/80" style={{ height: `${MACOS_TITLEBAR_HEIGHT_PX}px` }} />
          {/* Divider below traffic light buttons */}
          <div className="flex-shrink-0 w-full border-b border-white/70 dark:border-white/10" />
        </>
      )}

      {/* Body: sidebar + main content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        {/* Main content */}
        <main className="flex-1 overflow-hidden">
          <Suspense fallback={<PageFallback />}>
            {activePage === 'translate' ? (
              <TranslatePage />
            ) : activePage === 'live' ? (
              <LiveTranslatePage />
            ) : activePage === 'chat' ? (
              <ChatPage />
            ) : activePage === 'dictionary' ? (
              <DictionaryPage />
            ) : (
              <HistoryPage />
            )}
          </Suspense>
        </main>
      </div>

      {/* Settings popup modal */}
      <SettingsModal />

    </div>
  )
}

export default App
