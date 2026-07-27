import { lazy, Suspense, useEffect, useState } from 'react'
import { AIChatSidebar, CommandPalette, PrimaryNavigationSidebar } from './components/organisms'
import { SettingsModal } from './components/SettingsModal'
import { AppShell } from './components/templates'
import { PROVIDERS } from './constants/providers'
import { flushPersistedStore, useAppStore } from './store/useAppStore'
import type { Provider, QuickChatSeedPayload } from './types'
import { detectSystemLocale } from './utils/locale'

const TranslatePage = lazy(() => import('./pages/TranslatePage').then(m => ({ default: m.TranslatePage })))
const LiveTranslatePage = lazy(() => import('./pages/LiveTranslatePage').then(m => ({ default: m.LiveTranslatePage })))
const ChatPage = lazy(() => import('./pages/ChatPage').then(m => ({ default: m.ChatPage })))
const HistoryPage = lazy(() => import('./pages/HistoryPage').then(m => ({ default: m.HistoryPage })))
const DictionaryPage = lazy(() => import('./pages/DictionaryPage').then(m => ({ default: m.DictionaryPage })))

const FONT_SIZE_MAP = { small: '13px', medium: '15px', large: '17px' } as const

function PageFallback() {
  return <div className="app-page" aria-hidden="true" />
}

function App() {
  const {
    activePage, localeAuto, setKeyStatus, setLocaleFromSystem, fontSize, theme,
    selectedProvider, selectedModels, ttsMode, ttsVoice,
    createChatSession, setActiveChatSession, addChatMessage,
    setActivePage, openSettings,
  } = useAppStore()

  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false)

  // Apply dark class based on user preference or OS preference
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
      return
    }
    if (theme === 'light') {
      document.documentElement.classList.remove('dark')
      return
    }
    // 'system' — follow OS preference
    if (typeof window.matchMedia !== 'function') {
      document.documentElement.classList.remove('dark')
      return
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (dark: boolean) => document.documentElement.classList.toggle('dark', dark)
    apply(mq.matches)
    const handler = (e: MediaQueryListEvent) => apply(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  // Auto-detect system locale on startup
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally run only once on mount
  useEffect(() => {
    if (localeAuto) setLocaleFromSystem(detectSystemLocale())
  }, [])

  // Apply font size
  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZE_MAP[fontSize ?? 'medium']
  }, [fontSize])

  // Sync provider/model to main process
  useEffect(() => {
    if (!window.api?.localServer) return
    const model = selectedModels[selectedProvider] ?? ''
    window.api.localServer.syncConfig({ provider: selectedProvider, model, ttsMode, ttsVoice })
    flushPersistedStore()
  }, [selectedProvider, selectedModels, ttsMode, ttsVoice])

  // Flush on visibility/blur
  useEffect(() => {
    const flush = () => flushPersistedStore()
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('blur', flush)
    window.addEventListener('beforeunload', flush)
    return () => {
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('blur', flush)
      window.removeEventListener('beforeunload', flush)
    }
  }, [])

  // Cmd+K / Ctrl+K — global command palette
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdPaletteOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // Custom event from Sidebar search button
  useEffect(() => {
    const handle = () => setCmdPaletteOpen(o => !o)
    window.addEventListener('viezan:open-command-palette', handle)
    return () => window.removeEventListener('viezan:open-command-palette', handle)
  }, [])

  // Quick chat forwarding
  useEffect(() => {
    if (!window.api?.quickChat) return
    const unsubSettings = window.api.quickChat.onOpenSettings(() => openSettings())
    const unsubChat = window.api.quickChat.onOpenInChat((payload: QuickChatSeedPayload | null) => {
      if (!payload) { setActivePage('chat'); return }
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
    return () => { unsubSettings(); unsubChat() }
  }, [openSettings, setActivePage, createChatSession, setActiveChatSession, addChatMessage])

  // Check API keys in keychain on startup
  useEffect(() => {
    const checkKeys = async () => {
      if (!window.api) return
      for (const provider of PROVIDERS) {
        try {
          const result = await window.api.keychain.hasKey(provider.id)
          setKeyStatus(provider.id as Provider, result.exists)
        } catch {
          // ignore
        }
      }
    }
    checkKeys()
  }, [setKeyStatus])

  const isMac = window.api?.platform === 'darwin'

  return (
    <AppShell
      showMacTitlebar={isMac}
      primaryNavigation={<PrimaryNavigationSidebar />}
      contextSidebar={activePage === 'chat' ? <AIChatSidebar /> : undefined}
      overlays={
        <>
          <SettingsModal />
          <CommandPalette open={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} />
        </>
      }
    >
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
    </AppShell>
  )
}

export default App
