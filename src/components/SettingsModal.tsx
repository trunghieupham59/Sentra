import { lazy, Suspense, useEffect, useRef } from 'react'
import { useAppStore, useT } from '../store/useAppStore'
import { XIcon } from './ui/icons'

const SettingsPage = lazy(() => import('../pages/SettingsPage').then(module => ({ default: module.SettingsPage })))

export function SettingsModal() {
  const settingsOpen = useAppStore((state) => state.settingsOpen)
  const closeSettings = useAppStore((state) => state.closeSettings)
  const t = useT()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Close on Escape key (window-level — works for all keyboard users)
  useEffect(() => {
    if (!settingsOpen) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus())
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', handleKeyDown)
      const previousFocus = previousFocusRef.current
      previousFocusRef.current = null
      previousFocus?.focus()
    }
  }, [settingsOpen, closeSettings])

  if (!settingsOpen) return null

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: modal backdrop — Escape handled via window useEffect above
    <div
      className="modal-backdrop fixed inset-0 flex items-center justify-center"
      onClick={closeSettings}
    >
      <div
        className="relative w-full max-w-[1040px] mx-4 h-[min(90vh,860px)] flex flex-col
                   modal-surface overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return
          e.preventDefault()
          e.stopPropagation()
          closeSettings()
        }}
      >
        {/* Modal header */}
        <div className="modal-header flex items-center justify-between gap-4 px-5 py-3 border-b flex-shrink-0">
          <div className="min-w-0">
            <h1 id="settings-modal-title" className="text-sm font-bold" style={{ color: 'var(--vzn-text-strong)' }}>{t.settings_title}</h1>
            <p className="mt-0.5 text-xs truncate" style={{ color: 'var(--vzn-text-soft)' }}>{t.settings_subtitle}</p>
          </div>
          <button
            ref={closeButtonRef}
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
