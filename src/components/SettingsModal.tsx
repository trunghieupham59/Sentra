import { lazy, Suspense, useEffect } from 'react'
import { useAppStore, useT } from '../store/useAppStore'
import { XIcon } from './ui/icons'

const SettingsPage = lazy(() => import('../pages/SettingsPage').then(module => ({ default: module.SettingsPage })))

function SettingsLoading() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--apple-accent)', borderTopColor: 'transparent' }}
        />
        <span className="text-[13px]" style={{ color: 'var(--apple-label-secondary)' }}>
          Đang tải...
        </span>
      </div>
    </div>
  )
}

export function SettingsModal() {
  const settingsOpen = useAppStore((state) => state.settingsOpen)
  const closeSettings = useAppStore((state) => state.closeSettings)
  const t = useT()

  // Close on Escape key
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
    // Backdrop
    // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: modal backdrop — Escape handled via window useEffect above
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSettings()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t.settings_title}
    >
      {/* Modal container — macOS Settings style */}
      <div
        className="relative flex flex-col overflow-hidden w-[860px] max-w-[95vw]"
        style={{
          height: 'min(660px, 90vh)',
          borderRadius: '12px',
          background: 'var(--apple-bg-secondary)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.12)',
          animation: 'fadeSlideIn 200ms cubic-bezier(0.34, 1.20, 0.64, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header — macOS titlebar style */}
        <div
          className="flex items-center justify-between flex-shrink-0 px-5 h-12"
          style={{
            borderBottom: '1px solid var(--apple-separator)',
            background: 'var(--apple-vibrancy-bg)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <h1 className="text-[15px] font-semibold" style={{ color: 'var(--apple-label-primary)' }}>
            {t.settings_title}
          </h1>

          {/* Close button — Apple style */}
          <button
            type="button"
            onClick={closeSettings}
            aria-label={t.settings_close ?? 'Đóng'}
            className={[
              'flex items-center justify-center w-6 h-6 rounded-full',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]',
              'hover:bg-black/10 dark:hover:bg-white/15',
            ].join(' ')}
            style={{ color: 'var(--apple-label-secondary)' }}
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Settings content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <Suspense fallback={<SettingsLoading />}>
            <SettingsPage />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
