import type { ReactNode } from 'react'

const MACOS_TITLEBAR_HEIGHT_PX = 40

export interface AppShellProps {
  /** Persistent app-wide navigation rail. */
  primaryNavigation: ReactNode
  /** Optional feature-specific navigation, such as AI Chat conversations. */
  contextSidebar?: ReactNode
  /** Page content selected by the application layer. */
  children: ReactNode
  /** Portals, dialogs, and command surfaces rendered above the page. */
  overlays?: ReactNode
  /** Reserves the native traffic-light area in the macOS Electron window. */
  showMacTitlebar?: boolean
  /** Reveals the native macOS material behind chrome while the system theme is active. */
  useNativeMaterial?: boolean
}

/**
 * Layout-only template for the main Electron window.
 * State and feature selection stay in the page/application layer.
 */
export function AppShell({
  primaryNavigation,
  contextSidebar,
  children,
  overlays,
  showMacTitlebar = false,
  useNativeMaterial = false,
}: AppShellProps) {
  return (
    <div className="app-shell" data-window-material={useNativeMaterial ? 'native' : 'opaque'}>
      {showMacTitlebar && (
        <>
          <div
            aria-hidden="true"
            className="titlebar-drag app-titlebar-drag flex-shrink-0 w-full"
            style={{ height: MACOS_TITLEBAR_HEIGHT_PX }}
          />
          <div
            aria-hidden="true"
            className="app-titlebar-divider flex-shrink-0 w-full border-b"
          />
        </>
      )}

      <div className="app-body">
        {primaryNavigation}
        {contextSidebar}
        <main className="app-main">{children}</main>
      </div>

      {overlays}
    </div>
  )
}
