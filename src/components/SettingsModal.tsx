import { useEffect } from 'react'
import { SettingsPage } from '../pages/SettingsPage'
import { useAppStore, useT } from '../store/useAppStore'
import { XIcon } from './ui/icons'

export function SettingsModal() {
  const { settingsOpen, closeSettings } = useAppStore()
  const t = useT()

  // Close on Escape key (window-level — works for all keyboard users)
  useEffect(() => {
    if (!settingsOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [settingsOpen, closeSettings])

  if (!settingsOpen) return null

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: modal backdrop — Escape handled via window useEffect above
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={closeSettings}
    >
      <div
        className="relative w-full max-w-xl mx-4 max-h-[90vh] flex flex-col
                   bg-white dark:bg-gray-950 rounded-2xl shadow-2xl overflow-hidden
                   border border-gray-200 dark:border-gray-800"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-50">{t.nav_settings}</span>
          <button
            type="button"
            onClick={closeSettings}
            aria-label={t.settings_close}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400
                       hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800
                       transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto">
          <SettingsPage />
        </div>
      </div>
    </div>
  )
}
