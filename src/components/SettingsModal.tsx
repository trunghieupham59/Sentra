import { lazy, Suspense, useEffect } from 'react'
import { useAppStore, useT } from '../store/useAppStore'
import { XIcon } from './ui/icons'

const SettingsPage = lazy(() => import('../pages/SettingsPage').then(module => ({ default: module.SettingsPage })))

export function SettingsModal() {
  const settingsOpen = useAppStore((state) => state.settingsOpen)
  const closeSettings = useAppStore((state) => state.closeSettings)
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35"
      onClick={closeSettings}
    >
      <div
        className="relative w-full max-w-[1040px] mx-4 h-[min(90vh,860px)] flex flex-col
                   modal-surface overflow-hidden"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-gray-200 bg-white/85 dark:border-white/10 dark:bg-neutral-950/85 flex-shrink-0">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-50">{t.settings_title}</h1>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">{t.settings_subtitle}</p>
          </div>
          <button
            type="button"
            onClick={closeSettings}
            aria-label={t.settings_close}
            className="btn-icon btn-icon-sm"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0">
          <Suspense fallback={<div className="h-full bg-transparent" aria-hidden="true" />}>
            <SettingsPage />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
