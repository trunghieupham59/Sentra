import type { ReactNode } from 'react'
import { PROVIDERS } from '../constants/providers'
import { useAppStore, useT } from '../store/useAppStore'
import type { Provider } from '../types'
import { AppLogoIcon } from './AppLogo'
import { BookIcon, ChatBubbleIcon, ClockIcon, GearIcon, MicrophoneIcon, TranslateIcon } from './ui/icons'

interface NavItemProps {
  icon: ReactNode
  label: string
  active?: boolean
  badge?: boolean
  onClick: () => void
}

function NavItem({ icon, label, active, badge, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      title={label}
      className={`nav-item relative${active ? ' active' : ''}`}
    >
      {icon}
      {badge && <span className="nav-badge" />}
    </button>
  )
}

export function Sidebar() {
  const { activePage, setActivePage, clearTranslation, keyStatus, openSettings } = useAppStore()
  const t = useT()

  const hasAnyKey = PROVIDERS.some((p) => keyStatus[p.id as Provider])

  return (
    <aside className="app-sidebar">
      {/* Logo */}
      <button
        type="button"
        onClick={() => { clearTranslation(); setActivePage('translate') }}
        aria-label="Viezan"
        title="Viezan"
        className="nav-item mb-1"
        style={{ borderRadius: 12 }}
      >
        <AppLogoIcon size={26} />
      </button>

      <div className="app-sidebar-divider" />

      <NavItem
        label={t.nav_chat}
        active={activePage === 'chat'}
        onClick={() => setActivePage('chat')}
        icon={<ChatBubbleIcon className="w-[18px] h-[18px]" />}
      />

      <NavItem
        label={t.nav_translate}
        active={activePage === 'translate'}
        onClick={() => { clearTranslation(); setActivePage('translate') }}
        icon={<TranslateIcon className="w-[18px] h-[18px]" />}
      />

      <NavItem
        label={t.nav_dictionary}
        active={activePage === 'dictionary'}
        onClick={() => setActivePage('dictionary')}
        icon={<BookIcon className="w-[18px] h-[18px]" />}
      />

      <NavItem
        label={t.nav_live_translate}
        active={activePage === 'live'}
        onClick={() => setActivePage('live')}
        icon={<MicrophoneIcon className="w-[18px] h-[18px]" />}
      />

      <NavItem
        label={t.nav_history}
        active={activePage === 'history'}
        onClick={() => setActivePage('history')}
        icon={<ClockIcon className="w-[18px] h-[18px]" />}
      />

      <div className="flex-1" />
      <div className="app-sidebar-divider" />

      <NavItem
        label={t.nav_settings}
        badge={!hasAnyKey}
        onClick={openSettings}
        icon={<GearIcon className="w-[18px] h-[18px]" />}
      />
    </aside>
  )
}
