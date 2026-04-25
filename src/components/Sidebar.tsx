import type { ReactNode } from 'react'
import { PROVIDERS } from '../constants/providers'
import { useAppStore, useT } from '../store/useAppStore'
import type { Provider } from '../types'
import { AppLogoIcon } from './AppLogo'
import { ChatBubbleIcon, ClockIcon, GearIcon, MicrophoneIcon, TranslateIcon } from './ui/icons'

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
  const { activePage, setActivePage, clearTranslation, keyStatus, openSettings } = useAppStore()
  const t = useT()

  const hasAnyKey = PROVIDERS.some((p) => keyStatus[p.id as Provider])

  const handleNewTranslate = () => {
    clearTranslation()
    setActivePage('translate')
  }

  return (
    <aside className="flex flex-col items-center w-[60px] pt-3 pb-3 gap-1.5 flex-shrink-0
                      bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">

      {/* App icon */}
      <div className="mb-1 flex items-center justify-center w-10 h-10">
        <AppLogoIcon size={36} />
      </div>

      {/* Divider */}
      <div className="w-8 h-px bg-gray-100 dark:bg-gray-800 mb-0.5" />

      {/* Chat with AI */}
      <SidebarItem
        label={t.nav_chat}
        active={activePage === 'chat'}
        onClick={() => setActivePage('chat')}
        icon={<ChatBubbleIcon className="w-5 h-5" />}
      />

      {/* Translate */}
      <SidebarItem
        label={t.nav_translate}
        active={activePage === 'translate'}
        onClick={handleNewTranslate}
        icon={<TranslateIcon className="w-5 h-5" />}
      />

      {/* Live Translate */}
      <SidebarItem
        label={t.nav_live_translate}
        active={activePage === 'live'}
        onClick={() => setActivePage('live')}
        icon={<MicrophoneIcon className="w-5 h-5" />}
      />

      {/* History */}
      <SidebarItem
        label={t.nav_history}
        active={activePage === 'history'}
        onClick={() => setActivePage('history')}
        icon={<ClockIcon className="w-5 h-5" />}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Divider */}
      <div className="w-8 h-px bg-gray-100 dark:bg-gray-800 mb-0.5" />

      {/* Settings */}
      <SidebarItem
        label={t.nav_settings}
        badge={!hasAnyKey}
        onClick={openSettings}
        icon={<GearIcon className="w-5 h-5" />}
      />
    </aside>
  )
}
