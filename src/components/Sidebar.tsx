import type { ReactNode } from 'react'
import { PROVIDERS } from '../constants/providers'
import { useAppStore, useT } from '../store/useAppStore'
import type { Provider } from '../types'
import { AppLogoIcon } from './AppLogo'
import {
  BookIcon,
  ChatBubbleIcon,
  ChevronLeftIcon,
  ClockIcon,
  GearIcon,
  MicrophoneIcon,
  TranslateIcon,
} from './ui/icons'

interface SidebarItemProps {
  icon: ReactNode
  label: string
  active?: boolean
  badge?: boolean
  collapsed?: boolean
  onClick: () => void
}

function SidebarItem({ icon, label, active, badge, collapsed, onClick }: SidebarItemProps) {
  return (
    <div className="relative w-full px-1">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? label : undefined}
        className={[
          'relative flex items-center w-full rounded-lg',
          'transition-colors duration-150 ease-out select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:ring-offset-1',
          collapsed ? 'h-8 w-8 mx-auto justify-center' : 'h-8 gap-2 px-2',
          active
            ? 'bg-[#007AFF] dark:bg-[#0A84FF] text-white shadow-sm'
            : 'text-[var(--apple-label-secondary)] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:text-[var(--apple-label-primary)]',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* Icon */}
        <span
          className={[
            'flex-shrink-0 flex items-center justify-center',
            collapsed ? '' : '',
          ].join(' ')}
        >
          {icon}
        </span>

        {/* Label */}
        {!collapsed && (
          <span className="min-w-0 truncate text-[13px] font-medium">{label}</span>
        )}

        {/* Badge indicator */}
        {badge && (
          <span
            className={[
              'absolute w-2 h-2 rounded-full border-2',
              'bg-[#FF9500] dark:bg-[#FF9F0A]',
              active ? 'border-[#007AFF]' : 'border-[var(--apple-vibrancy-sidebar)]',
              collapsed ? 'top-1 right-1' : 'top-1.5 right-2',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        )}
      </button>
    </div>
  )
}

export function Sidebar() {
  const {
    activePage,
    setActivePage,
    clearTranslation,
    keyStatus,
    openSettings,
    sidebarCollapsed,
    toggleSidebar,
  } = useAppStore()
  const t = useT()

  const hasAnyKey = PROVIDERS.some((p) => keyStatus[p.id as Provider])
  const collapsed = sidebarCollapsed

  const handleNewTranslate = () => {
    clearTranslation()
    setActivePage('translate')
  }

  return (
    <aside
      className={[
        'apple-sidebar relative flex flex-col flex-shrink-0',
        'transition-[width] duration-200 ease-out',
        'pt-2 pb-3',
        collapsed ? 'items-center w-[60px] px-0' : 'items-stretch w-[200px] px-1',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Header: App logo + collapse toggle */}
      <div
        className={[
          'mb-2 flex h-10 items-center',
          collapsed ? 'justify-center px-1' : 'justify-between pl-3 pr-2',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={t.nav_expand_sidebar}
            title={t.nav_expand_sidebar}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors duration-150"
          >
            <AppLogoIcon size={28} />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <AppLogoIcon size={28} />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-bold text-[var(--apple-label-primary)]">
                  Viezan
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={t.nav_collapse_sidebar}
              title={t.nav_collapse_sidebar}
              className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors duration-150 text-[var(--apple-label-tertiary)] hover:text-[var(--apple-label-secondary)]"
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Separator */}
      <div className="h-px bg-[var(--apple-separator)] mx-2 mb-2" />

      {/* Navigation items */}
      <div className="flex flex-col gap-0.5">
        {/* Chat */}
        <SidebarItem
          label={t.nav_chat}
          active={activePage === 'chat'}
          collapsed={collapsed}
          onClick={() => setActivePage('chat')}
          icon={<ChatBubbleIcon className="w-4 h-4" />}
        />

        {/* Translate */}
        <SidebarItem
          label={t.nav_translate}
          active={activePage === 'translate'}
          collapsed={collapsed}
          onClick={handleNewTranslate}
          icon={<TranslateIcon className="w-4 h-4" />}
        />

        {/* Dictionary */}
        <SidebarItem
          label={t.nav_dictionary}
          active={activePage === 'dictionary'}
          collapsed={collapsed}
          onClick={() => setActivePage('dictionary')}
          icon={<BookIcon className="w-4 h-4" />}
        />

        {/* Live Translate */}
        <SidebarItem
          label={t.nav_live_translate}
          active={activePage === 'live'}
          collapsed={collapsed}
          onClick={() => setActivePage('live')}
          icon={<MicrophoneIcon className="w-4 h-4" />}
        />

        {/* History */}
        <SidebarItem
          label={t.nav_history}
          active={activePage === 'history'}
          collapsed={collapsed}
          onClick={() => setActivePage('history')}
          icon={<ClockIcon className="w-4 h-4" />}
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom separator + Settings */}
      <div className="h-px bg-[var(--apple-separator)] mx-2 mb-2" />

      <SidebarItem
        label={t.nav_settings}
        badge={!hasAnyKey}
        collapsed={collapsed}
        onClick={openSettings}
        icon={<GearIcon className="w-4 h-4" />}
      />
    </aside>
  )
}
