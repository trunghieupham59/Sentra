import { useAppStore, useT } from '../store/useAppStore'
import type { AppPage } from '../types'
import { AppLogoIcon } from './AppLogo'
import { BookIcon, ChatBubbleIcon, ClockIcon, GearIcon, MicrophoneIcon, TranslateIcon } from './ui/icons'

interface NavItemProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  badge?: boolean
  onClick: () => void
}

function NavItem({ icon, label, active, badge, onClick }: NavItemProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        title={label}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={`sidebar-nav-btn${active ? ' active' : ''}`}
      >
        {icon}
        {badge && (
          <span
            aria-label="Setup required"
            style={{
              position: 'absolute',
              top: 7,
              right: 7,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--vzn-warning)',
              border: '1.5px solid var(--vzn-sidebar-bg)',
            }}
          />
        )}
      </button>
    </div>
  )
}

/** Search icon — inline to avoid extra import */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="9" r="5.5" />
      <path d="M15 15l2.5 2.5" />
    </svg>
  )
}

export function Sidebar() {
  const { activePage, setActivePage, clearTranslation, keyStatus, openSettings } = useAppStore()
  const t = useT()

  const hasAnyKey = Object.values(keyStatus).some(Boolean)

  const navigate = (page: AppPage, extra?: () => void) => {
    extra?.()
    setActivePage(page)
  }

  const openCommandPalette = () => {
    window.dispatchEvent(new CustomEvent('viezan:open-command-palette'))
  }

  return (
    <aside className="app-sidebar" aria-label="Navigation">
      {/* Logo */}
      <div className="sidebar-brand-surface" title="Viezan">
        <AppLogoIcon size={28} />
      </div>

      {/* Divider */}
      <div className="app-sidebar-divider" />

      {/* Navigation */}
      <NavItem
        label={t.nav_chat}
        active={activePage === 'chat'}
        onClick={() => navigate('chat')}
        icon={<ChatBubbleIcon className="w-[18px] h-[18px]" />}
      />
      <NavItem
        label={t.nav_translate}
        active={activePage === 'translate'}
        onClick={() => navigate('translate', clearTranslation)}
        icon={<TranslateIcon className="w-[18px] h-[18px]" />}
      />
      <NavItem
        label={t.nav_live_translate}
        active={activePage === 'live'}
        onClick={() => navigate('live')}
        icon={<MicrophoneIcon className="w-[18px] h-[18px]" />}
      />
      <NavItem
        label={t.nav_dictionary}
        active={activePage === 'dictionary'}
        onClick={() => navigate('dictionary')}
        icon={<BookIcon className="w-[18px] h-[18px]" />}
      />
      <NavItem
        label={t.nav_history}
        active={activePage === 'history'}
        onClick={() => navigate('history')}
        icon={<ClockIcon className="w-[18px] h-[18px]" />}
      />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Command palette trigger */}
      <button
        type="button"
        title="Command palette (⌘K)"
        aria-label="Open command palette"
        className="sidebar-nav-btn"
        style={{ marginBottom: 2 }}
        onClick={openCommandPalette}
      >
        <SearchIcon className="w-[18px] h-[18px]" />
      </button>

      {/* Divider */}
      <div className="app-sidebar-divider" />

      {/* Settings */}
      <NavItem
        label={t.nav_settings}
        badge={!hasAnyKey}
        onClick={openSettings}
        icon={<GearIcon className="w-[18px] h-[18px]" />}
      />
    </aside>
  )
}
