import { ReactNode } from 'react'
import { useAppStore, useT } from '../store/useAppStore'
import { AppLogoIcon } from './AppLogo'
import { PROVIDERS } from '../constants/providers'
import { Provider } from '../types'

interface SidebarItemProps {
  icon: ReactNode
  label: string
  active?: boolean
  badge?: boolean
  onClick: () => void
}

function SidebarItem({ icon, label, active, badge, onClick }: SidebarItemProps) {
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-150 ${
          active
            ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800'
        }`}
      >
        {icon}
        {badge && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-400 rounded-full border-2 border-white dark:border-gray-900" />
        )}
      </button>
      {/* Tooltip */}
      <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3
                       px-2 py-1 text-xs font-medium text-white bg-gray-800 dark:bg-gray-700
                       rounded-md whitespace-nowrap z-50
                       opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        {label}
      </span>
    </div>
  )
}

export function Sidebar() {
  const { activePage, setActivePage, clearTranslation, keyStatus } = useAppStore()
  const t = useT()

  const hasAnyKey = PROVIDERS.some((p) => keyStatus[p.id as Provider])

  const handleNewTranslate = () => {
    clearTranslation()
    setActivePage('translate')
  }

  return (
    <aside className="flex flex-col items-center w-[60px] pt-2 pb-3 gap-1.5 flex-shrink-0
                      bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">

      {/* App icon */}
      <div className="mb-1 flex items-center justify-center w-10 h-10">
        <AppLogoIcon size={36} />
      </div>

      {/* Divider */}
      <div className="w-8 h-px bg-gray-100 dark:bg-gray-800 mb-0.5" />

      {/* Translate */}
      <SidebarItem
        label={t.nav_translate}
        active={activePage === 'translate'}
        onClick={handleNewTranslate}
        icon={
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
        }
      />

      {/* Chat with AI */}
      <SidebarItem
        label={t.nav_chat}
        active={activePage === 'chat'}
        onClick={() => setActivePage('chat')}
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        }
      />

      {/* History */}
      <SidebarItem
        label={t.nav_history}
        active={activePage === 'history'}
        onClick={() => setActivePage('history')}
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Divider */}
      <div className="w-8 h-px bg-gray-100 dark:bg-gray-800 mb-0.5" />

      {/* Settings */}
      <SidebarItem
        label={t.nav_settings}
        active={activePage === 'settings'}
        badge={!hasAnyKey}
        onClick={() => setActivePage('settings')}
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
      />
    </aside>
  )
}
