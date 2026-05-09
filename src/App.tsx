import { lazy, Suspense, useEffect } from 'react'
import { IconSpinner } from './components/icons/AppIcons'
import Sidebar from './components/Sidebar'
import { useProviderModelRefresh } from './hooks/useProviderModelRefresh'
import type { AppLocale } from './i18n'
import { useAppStore } from './store/useAppStore'
import type { AppPage, Provider } from './types'

// ── Full-width title-bar header — pure drag strip, clears macOS traffic lights ──
function AppHeader() {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const collapsed        = sidebarCollapsed
  return (
    <header className="app-header">
      {/* Sidebar-coloured traffic-light zone — no interactive content */}
      <div
        className="app-header-sidebar"
        style={{
          width: collapsed ? 64 : 240,
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
      {/* Content-area drag strip */}
      <div className="app-header-content" />
    </header>
  )
}

function detectSystemLocale(): AppLocale {
  const langs: readonly string[] = navigator.languages?.length
    ? navigator.languages
    : [navigator.language ?? 'en']
  for (const lang of langs) {
    const l = lang.toLowerCase()
    if (l.startsWith('vi')) return 'vi'
    if (l.startsWith('ja')) return 'ja'
    if (l.startsWith('en')) return 'en'
  }
  return 'en'
}

// ─── Lazy page imports ────────────────────────────────────────────────────────
// Pages are created on-demand; stubs render an empty placeholder until the real
// page components exist.
const TranslatePage  = lazy(() => import('./pages/TranslatePage').catch(() => ({ default: PlaceholderPage('Translate') })))
const ChatPage       = lazy(() => import('./pages/ChatPage').catch(() => ({ default: PlaceholderPage('Chat') })))
const LivePage       = lazy(() => import('./pages/LivePage').catch(() => ({ default: PlaceholderPage('Live') })))
const DictionaryPage = lazy(() => import('./pages/DictionaryPage').catch(() => ({ default: PlaceholderPage('Dictionary') })))
const HistoryPage    = lazy(() => import('./pages/HistoryPage').catch(() => ({ default: PlaceholderPage('History') })))
const SettingsModal  = lazy(() => import('./components/SettingsModal').catch(() => ({ default: () => <></> })))

// ─── Placeholder for missing page modules ─────────────────────────────────────
function PlaceholderPage(name: string) {
  return function Page() {
    return (
      <div className="page-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="empty-state">
          <span style={{ fontSize: 32 }}>🚧</span>
          <p style={{ fontSize: 14, fontWeight: 600 }}>{name}</p>
          <p style={{ fontSize: 12 }}>This page is coming soon.</p>
        </div>
      </div>
    )
  }
}

// ─── Loading fallback ─────────────────────────────────────────────────────────
function LoadingPage() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <span style={{
        fontSize: 26,
        fontWeight: 700,
        background: 'linear-gradient(135deg, #0A84FF 0%, #5E5CE6 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        letterSpacing: '-0.03em',
      }}>
        Viezan
      </span>
      <span style={{ color: 'var(--accent)', display: 'flex' }}><IconSpinner size={22} /></span>
    </div>
  )
}

// ─── Page router ──────────────────────────────────────────────────────────────
function ActivePage({ page }: { page: AppPage }) {
  switch (page) {
    case 'translate':  return <TranslatePage />
    case 'chat':       return <ChatPage />
    case 'live':       return <LivePage />
    case 'dictionary': return <DictionaryPage />
    case 'history':    return <HistoryPage />
    default:           return <TranslatePage />
  }
}

// ─── Font size sync ───────────────────────────────────────────────────────────
const FONT_SIZE_MAP: Record<'small' | 'medium' | 'large', string> = {
  small:  '12px',
  medium: '14px',
  large:  '16px',
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  const activePage   = useAppStore((s) => s.activePage)
  const settingsOpen = useAppStore((s) => s.settingsOpen)
  const fontSize     = useAppStore((s) => s.fontSize)
  const selectedProvider = useAppStore((s) => s.selectedProvider)
  const selectedModels   = useAppStore((s) => s.selectedModels)
  const keyStatus    = useAppStore((s) => s.keyStatus)
  const ttsMode      = useAppStore((s) => s.ttsMode)
  const ttsVoice     = useAppStore((s) => s.ttsVoice)
  const localeAuto   = useAppStore((s) => s.localeAuto)
  const theme        = useAppStore((s) => s.theme)
  const setLocaleFromSystem = useAppStore((s) => s.setLocaleFromSystem)
  const setKeyStatus    = useAppStore((s) => s.setKeyStatus)
  const setHasTavilyKey = useAppStore((s) => s.setHasTavilyKey)
  const setHasBraveKey  = useAppStore((s) => s.setHasBraveKey)

  useProviderModelRefresh(selectedProvider, {
    refreshKey: keyStatus[selectedProvider],
  })

  // Apply font size to <html> root
  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZE_MAP[fontSize] ?? '14px'
  }, [fontSize])

  // Sync OS keychain → store on startup so key status is accurate without
  // requiring the user to open Settings first.
  useEffect(() => {
    if (!window.api?.keychain?.get) return
    const PROVIDER_KEYS: Array<{ id: string; type: 'provider' | 'tavily' | 'brave' }> = [
      { id: 'gemini', type: 'provider' },
      { id: 'claude', type: 'provider' },
      { id: 'openai', type: 'provider' },
      { id: 'groq',   type: 'provider' },
      { id: 'tavily', type: 'tavily' },
      { id: 'brave',  type: 'brave' },
    ]
    PROVIDER_KEYS.forEach(({ id, type }) => {
      window.api.keychain.get(id).then((res) => {
        if (res == null) return
        const exists = res.exists ?? false
        if (type === 'tavily') { setHasTavilyKey(exists); return }
        if (type === 'brave')  { setHasBraveKey(exists); return }
        setKeyStatus(id as Provider, exists)
      }).catch(() => { /* keychain unavailable — keep persisted value */ })
    })
  }, [setKeyStatus, setHasTavilyKey, setHasBraveKey])

  // Auto locale detection — runs on mount and whenever localeAuto is turned on
  useEffect(() => {
    if (!localeAuto) return
    setLocaleFromSystem(detectSystemLocale())
  }, [localeAuto, setLocaleFromSystem])

  // Apply theme: 'system' follows prefers-color-scheme; 'dark'/'light' forces it
  useEffect(() => {
    const apply = (dark: boolean) =>
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      apply(mq.matches)
      const handler = (e: MediaQueryListEvent) => apply(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
    apply(theme === 'dark')
  }, [theme])

  // Sync provider/model to main process (local server bridge, subtitle window, etc.)
  useEffect(() => {
    const model = selectedModels[selectedProvider] ?? ''
    if (typeof window !== 'undefined' && window.api?.localServer?.syncConfig) {
      window.api.localServer.syncConfig({
        provider: selectedProvider,
        model,
        ttsMode,
        ttsVoice,
      }).catch(() => { /* non-critical */ })
    }
  }, [selectedProvider, selectedModels, ttsMode, ttsVoice])

  // Listen for quick chat open (hotkey → open chat page)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.api?.hotkey?.chat?.onOpen) return
    const cleanup = window.api.hotkey.chat.onOpen(() => {
      useAppStore.getState().setActivePage('chat')
    })
    return cleanup
  }, [])

  return (
    <div className="app-root">
      <AppHeader />

      <div className="app-body">
        <Sidebar />

        <div className="content-area">
          <Suspense fallback={<LoadingPage />}>
            <ActivePage page={activePage} />
          </Suspense>
        </div>
      </div>

      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal />
        </Suspense>
      )}
    </div>
  )
}
