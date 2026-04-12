import { useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { PROVIDERS } from './constants/providers'
import type { AppLocale } from './i18n'
import { HistoryPage } from './pages/HistoryPage'
import { SettingsPage } from './pages/SettingsPage'
import { TranslatePage } from './pages/TranslatePage'
import { useAppStore } from './store/useAppStore'
import type { Provider } from './types'

const SUPPORTED_LOCALES: AppLocale[] = ['en', 'vi', 'ja']

function detectSystemLocale(): AppLocale {
  const lang = (navigator.language || 'en').split('-')[0]
  return SUPPORTED_LOCALES.includes(lang as AppLocale) ? (lang as AppLocale) : 'en'
}

const FONT_SIZE_MAP = {
  small:  '13px',
  medium: '15px',
  large:  '17px',
}

function App() {
  const { activePage, localeAuto, setKeyStatus, setLocaleFromSystem, fontSize } = useAppStore()

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

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* macOS title bar drag region */}
      <div
        className="titlebar-drag flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800"
        style={{ height: '28px' }}
      />

      {/* Main layout: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          {activePage === 'translate' ? (
            <TranslatePage />
          ) : activePage === 'history' ? (
            <HistoryPage />
          ) : (
            <SettingsPage />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
