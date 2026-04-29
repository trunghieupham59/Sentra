import { useCallback, useEffect, useState } from 'react'
import { AIChatPopup } from './components/AIChatPopup'
import { SettingsModal } from './components/SettingsModal'
import { Sidebar } from './components/Sidebar'
import { PROVIDERS } from './constants/providers'
import { ChatPage } from './pages/ChatPage'
import { HistoryPage } from './pages/HistoryPage'
import { LiveTranslatePage } from './pages/LiveTranslatePage'
import { TranslatePage } from './pages/TranslatePage'
import { useAppStore } from './store/useAppStore'
import type { Provider } from './types'
import { detectSystemLocale } from './utils/locale'

const FONT_SIZE_MAP = {
  small:  '13px',
  medium: '15px',
  large:  '17px',
}

/** Height (px) of the macOS traffic-light drag region at the top of the window. */
const MACOS_TITLEBAR_HEIGHT_PX = 40

function App() {
  const { activePage, localeAuto, setKeyStatus, setLocaleFromSystem, fontSize, selectedProvider, selectedModels } = useAppStore()
  const [aiChatPopupOpen, setAiChatPopupOpen] = useState(false)

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
    window.api.localServer.syncConfig({ provider: selectedProvider, model })
  }, [selectedProvider, selectedModels])

  // Listen for the AI Chat hotkey event from main process
  useEffect(() => {
    if (!window.api?.hotkey?.chat) return
    const unsub = window.api.hotkey.chat.onOpen(() => {
      setAiChatPopupOpen(true)
    })
    return unsub
  }, [])

  const handleCloseAiChatPopup = useCallback(() => setAiChatPopupOpen(false), [])

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
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Full-width macOS traffic light drag region — only on macOS */}
      {isMac && (
        <>
          <div className="titlebar-drag flex-shrink-0 w-full bg-white dark:bg-gray-900" style={{ height: `${MACOS_TITLEBAR_HEIGHT_PX}px` }} />
          {/* Divider below traffic light buttons */}
          <div className="flex-shrink-0 w-full border-b border-gray-200 dark:border-gray-700" />
        </>
      )}

      {/* Body: sidebar + main content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        {/* Main content */}
        <main className="flex-1 overflow-hidden">
          {activePage === 'translate' ? (
            <TranslatePage />
          ) : activePage === 'live' ? (
            <LiveTranslatePage />
          ) : activePage === 'chat' ? (
            <ChatPage />
          ) : (
            <HistoryPage />
          )}
        </main>
      </div>

      {/* Settings popup modal */}
      <SettingsModal />

      {/* AI Chat quick-ask popup — triggered by global hotkey */}
      <AIChatPopup open={aiChatPopupOpen} onClose={handleCloseAiChatPopup} />
    </div>
  )
}

export default App
