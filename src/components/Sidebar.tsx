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
    <div className="relative group w-full">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={`relative w-full h-10 flex items-center justify-center lg:justify-start gap-3 rounded-lg px-0 lg:px-3 transition-all duration-150 ${
          active
            ? 'bg-blue-50 text-blue-700 shadow-sm shadow-blue-900/5 dark:bg-blue-950/45 dark:text-blue-300'
            : 'text-gray-500 hover:text-gray-900 hover:bg-white/80 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-white/5'
        }`}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg lg:h-auto lg:w-auto">
          {icon}
        </span>
        <span className="hidden lg:block min-w-0 truncate text-sm font-semibold">{label}</span>
        {badge && (
          <span className="absolute top-1.5 right-1.5 lg:right-2.5 w-2 h-2 bg-orange-400 rounded-full border-2 border-white dark:border-neutral-950" />
        )}
      </button>
      {/* Tooltip */}
      <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3
                       px-2 py-1 text-xs font-medium text-white bg-gray-800 dark:bg-gray-700
                       rounded-md whitespace-nowrap z-50
                       opacity-0 group-hover:opacity-100 lg:hidden transition-opacity duration-150">
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
    <aside className="flex flex-col items-center lg:items-stretch w-[76px] lg:w-[188px] pt-3 pb-3 px-3 gap-2 flex-shrink-0
                      border-r border-white/70 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-neutral-950/55">

      {/* App icon */}
      <div className="mb-1 flex h-11 items-center justify-center lg:justify-start gap-3 px-0 lg:px-2">
        <AppLogoIcon size={34} />
        <div className="hidden lg:block min-w-0">
          <div className="truncate text-sm font-bold text-gray-950 dark:text-gray-50">Viezan</div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-auto lg:mx-0 w-8 lg:w-full h-px bg-gray-200/80 dark:bg-white/10 mb-0.5" />

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
      <div className="mx-auto lg:mx-0 w-8 lg:w-full h-px bg-gray-200/80 dark:bg-white/10 mb-0.5" />

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
