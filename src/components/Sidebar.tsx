import type { ReactNode } from 'react'
import { PROVIDERS } from '../constants/providers'
import { useAppStore, useT } from '../store/useAppStore'
import type { Provider } from '../types'
import { AppLogoIcon } from './AppLogo'
import { BookIcon, ChatBubbleIcon, ChevronLeftIcon, ClockIcon, GearIcon, MicrophoneIcon, TranslateIcon } from './ui/icons'

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
    <div className="relative w-full">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? label : undefined}
        className={[
          'btn-secondary btn-nav-item relative transition-all duration-200',
          collapsed ? 'btn-nav-item-collapsed' : '',
          active ? 'btn-active' : 'border-transparent bg-transparent shadow-none',
        ].join(' ')}
        style={active ? undefined : { background: 'transparent', boxShadow: 'none' }}
      >
        <span className={`flex items-center justify-center rounded-xl ${collapsed ? 'h-8 w-8' : ''}`}>
          {icon}
        </span>
        {!collapsed && (
          <span className="min-w-0 truncate text-sm font-semibold">{label}</span>
        )}
        {badge && (
          <span
            className={`absolute top-1.5 ${collapsed ? 'right-1.5' : 'right-2.5'} w-2 h-2 rounded-full border-2`}
            style={{
              background: 'var(--vzn-danger)',
              borderColor: 'var(--vzn-surface-raised)',
            }}
          />
        )}
      </button>
    </div>
  )
}

export function Sidebar() {
  const { activePage, setActivePage, clearTranslation, keyStatus, openSettings, sidebarCollapsed, toggleSidebar } = useAppStore()
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
        'app-sidebar relative flex flex-col flex-shrink-0',
        'pt-3 pb-3 px-3 gap-1.5',
        collapsed ? 'items-center w-[76px]' : 'items-stretch w-[188px]',
        'border-r transition-[width] duration-200 ease-out',
      ].join(' ')}
      style={{
        background: 'var(--vzn-surface-raised)',
        borderColor: 'var(--vzn-border)',
        WebkitBackdropFilter: 'var(--vzn-blur)',
        backdropFilter: 'var(--vzn-blur)',
        boxShadow: '1px 0 0 var(--vzn-divider)',
      }}
    >
      {/* Logo + collapse toggle */}
      <div className={`mb-2 flex h-11 items-center ${collapsed ? 'justify-center px-0' : 'justify-between pl-2 pr-1'} gap-2`}>
        {collapsed ? (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={t.nav_expand_sidebar}
            title={t.nav_expand_sidebar}
            className="btn-icon btn-icon-lg border-transparent bg-transparent shadow-none"
          >
            <AppLogoIcon size={34} />
          </button>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <AppLogoIcon size={34} />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold" style={{ color: 'var(--vzn-text-strong)' }}>
                Viezan
              </div>
            </div>
          </div>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={t.nav_collapse_sidebar}
            title={t.nav_collapse_sidebar}
            className="btn-icon btn-icon-sm border-transparent bg-transparent shadow-none"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Divider */}
      <div
        className={`app-sidebar-divider ${collapsed ? 'mx-auto w-8' : 'mx-0 w-full'} h-px mb-1`}
        style={{ background: 'var(--vzn-divider)' }}
      />

      <SidebarItem
        label={t.nav_chat}
        active={activePage === 'chat'}
        collapsed={collapsed}
        onClick={() => setActivePage('chat')}
        icon={<ChatBubbleIcon className="w-5 h-5" />}
      />

      <SidebarItem
        label={t.nav_translate}
        active={activePage === 'translate'}
        collapsed={collapsed}
        onClick={handleNewTranslate}
        icon={<TranslateIcon className="w-5 h-5" />}
      />

      <SidebarItem
        label={t.nav_dictionary}
        active={activePage === 'dictionary'}
        collapsed={collapsed}
        onClick={() => setActivePage('dictionary')}
        icon={<BookIcon className="w-5 h-5" />}
      />

      <SidebarItem
        label={t.nav_live_translate}
        active={activePage === 'live'}
        collapsed={collapsed}
        onClick={() => setActivePage('live')}
        icon={<MicrophoneIcon className="w-5 h-5" />}
      />

      <SidebarItem
        label={t.nav_history}
        active={activePage === 'history'}
        collapsed={collapsed}
        onClick={() => setActivePage('history')}
        icon={<ClockIcon className="w-5 h-5" />}
      />

      <div className="flex-1" />

      {/* Divider */}
      <div
        className={`app-sidebar-divider ${collapsed ? 'mx-auto w-8' : 'mx-0 w-full'} h-px mb-1`}
        style={{ background: 'var(--vzn-divider)' }}
      />

      <SidebarItem
        label={t.nav_settings}
        badge={!hasAnyKey}
        collapsed={collapsed}
        onClick={openSettings}
        icon={<GearIcon className="w-5 h-5" />}
      />
    </aside>
  )
}
