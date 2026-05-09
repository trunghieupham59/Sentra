import React from 'react'
import { useAppStore, useT } from '../store/useAppStore'
import type { AppPage } from '../types'
import {
  IconChat,
  IconChevronLeft,
  IconChevronRight,
  IconDictionary,
  IconHistory,
  IconLive,
  IconLogo,
  IconSettings,
  IconTranslate,
} from './icons/AppIcons'

interface NavEntry {
  page: AppPage
  labelKey: 'nav_chat' | 'nav_translate' | 'nav_live_translate' | 'nav_dictionary' | 'nav_history'
  icon: React.ReactNode
}

// Reference order: Chat, Translate, Dictionary, Live, History
const NAV_ITEMS: NavEntry[] = [
  { page: 'chat',       labelKey: 'nav_chat',           icon: <IconChat size={20} /> },
  { page: 'translate',  labelKey: 'nav_translate',      icon: <IconTranslate size={20} /> },
  { page: 'dictionary', labelKey: 'nav_dictionary',     icon: <IconDictionary size={20} /> },
  { page: 'live',       labelKey: 'nav_live_translate', icon: <IconLive size={20} /> },
  { page: 'history',    labelKey: 'nav_history',        icon: <IconHistory size={20} /> },
]

export default function Sidebar() {
  const t                = useT()
  const activePage       = useAppStore((s) => s.activePage)
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar    = useAppStore((s) => s.toggleSidebar)
  const setActivePage    = useAppStore((s) => s.setActivePage)
  const openSettings     = useAppStore((s) => s.openSettings)

  const collapsed = sidebarCollapsed

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
      {/* ── Sidebar header: logo + brand name + collapse toggle ── */}
      <div className="sidebar-header">
        <IconLogo size={26} style={{ flexShrink: 0 }} />

        {!collapsed && (
          <>
            <span className="sidebar-brand">{collapsed ? '' : 'Viezan'}</span>
            <button
              type="button"
              className="btn-icon"
              onClick={toggleSidebar}
              data-tooltip={t.nav_collapse_sidebar}
              aria-label={t.nav_collapse_sidebar}
              style={{ flexShrink: 0 }}
            >
              <IconChevronLeft size={14} />
            </button>
          </>
        )}

        {collapsed && (
          <button
            type="button"
            className="btn-icon"
            onClick={toggleSidebar}
            data-tooltip={t.nav_expand_sidebar}
            aria-label={t.nav_expand_sidebar}
            style={{ flexShrink: 0 }}
          >
            <IconChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Separator */}
      {!collapsed && <div className="sidebar-separator" />}

      {/* ── Nav items ── */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 10px', overflow: 'hidden' }}>
        {NAV_ITEMS.map(({ page, labelKey, icon }) => {
          const label = t[labelKey]
          return (
            <button
              key={page}
              type="button"
              className={`nav-item${activePage === page ? ' active' : ''}`}
              onClick={() => setActivePage(page)}
              data-tooltip={collapsed ? label : undefined}
              aria-label={label}
              style={{ justifyContent: collapsed ? 'center' : 'flex-start', border: 'none', width: '100%', textAlign: 'left' }}
            >
              <span style={{ flexShrink: 0, display: 'flex' }}>{icon}</span>
              {!collapsed && <span>{label}</span>}
            </button>
          )
        })}
      </nav>

      {/* ── Settings ── */}
      <div style={{ padding: '8px 10px 16px' }}>
        <button
          type="button"
          className="nav-item"
          onClick={openSettings}
          data-tooltip={collapsed ? t.nav_settings : undefined}
          aria-label={t.nav_settings}
          style={{ justifyContent: collapsed ? 'center' : 'flex-start', border: 'none', width: '100%', textAlign: 'left' }}
        >
          <span style={{ flexShrink: 0, display: 'flex' }}><IconSettings size={20} /></span>
          {!collapsed && <span>{t.nav_settings}</span>}
        </button>
      </div>
    </aside>
  )
}
