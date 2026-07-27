import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../../store/useAppStore'
import { Sidebar } from '../Sidebar'

describe('Sidebar', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1440,
    })
    act(() => {
      useAppStore.setState({
        activePage: 'chat',
        locale: 'en',
        sidebarCollapsed: false,
        keyStatus: { gemini: true, claude: false, openai: false, local: false },
      })
    })
  })

  it('renders persistent desktop navigation and changes app pages', () => {
    render(<Sidebar />)

    const sidebar = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(sidebar).toHaveAttribute('data-sidebar-scope', 'primary')
    expect(sidebar).toHaveAttribute('data-collapsed', 'false')
    expect(screen.getByRole('button', { name: 'AI Chat' })).toHaveAttribute('aria-current', 'page')

    fireEvent.click(screen.getByRole('button', { name: 'AI Translate' }))

    expect(useAppStore.getState().activePage).toBe('translate')
    expect(screen.queryByRole('complementary', { name: 'AI Chat conversations' })).not.toBeInTheDocument()
  })

  it('opens a compact overlay without overwriting the desktop preference', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
    render(<Sidebar />)

    const sidebar = screen.getByRole('navigation', { name: 'Main navigation' })
    const toggle = screen.getByRole('button', { name: 'Expand sidebar' })
    vi.spyOn(sidebar, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 41,
      top: 41,
      right: 60,
      bottom: 841,
      left: 0,
      width: 60,
      height: 800,
      toJSON: () => ({}),
    })
    expect(sidebar).toHaveAttribute('data-overlay-open', 'false')
    expect(sidebar).toHaveAttribute('data-user-collapsed', 'false')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggle)
    expect(sidebar).toHaveAttribute('data-overlay-open', 'true')
    const collapseButton = screen.getByRole('button', { name: 'Collapse sidebar' })
    const panel = document.getElementById(collapseButton.getAttribute('aria-controls') ?? '')
    expect(collapseButton).toHaveAttribute('aria-expanded', 'true')
    expect(sidebar).not.toContainElement(panel)
    expect(panel).toHaveAttribute('data-overlay-open', 'true')
    expect(panel).toHaveStyle({ top: '41px', left: '0px', height: '800px' })

    fireEvent.pointerDown(document.body)
    await waitFor(() => expect(sidebar).toHaveAttribute('data-overlay-open', 'false'))
    expect(useAppStore.getState().sidebarCollapsed).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveFocus())
  })

  it('keeps desktop expansion across navigation and separates toggle from logo', () => {
    render(<Sidebar />)
    const sidebar = screen.getByRole('navigation', { name: 'Main navigation' })
    const logo = sidebar.querySelector('.sidebar-brand-surface')
    const collapseButton = screen.getByRole('button', { name: 'Collapse sidebar' })

    expect(logo).toBeInTheDocument()
    expect(logo).not.toContainElement(collapseButton)
    expect(sidebar).toHaveAttribute('data-collapsed', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'AI Translate' }))

    expect(sidebar).toHaveAttribute('data-overlay-open', 'false')
    expect(sidebar).toHaveAttribute('data-collapsed', 'false')
    expect(useAppStore.getState().activePage).toBe('translate')
    expect(useAppStore.getState().sidebarCollapsed).toBe(false)
  })

  it('persists a manual desktop collapse and keeps logo and toggle in separate rows', () => {
    render(<Sidebar />)
    const sidebar = screen.getByRole('navigation', { name: 'Main navigation' })

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))

    const expandButton = screen.getByRole('button', { name: 'Expand sidebar' })
    const logo = sidebar.querySelector('.sidebar-brand-surface')
    expect(sidebar).toHaveAttribute('data-collapsed', 'true')
    expect(useAppStore.getState().sidebarCollapsed).toBe(true)
    expect(logo).toBeInTheDocument()
    expect(logo).not.toContainElement(expandButton)
    expect(expandButton.closest('.primary-navigation-collapsed-toggle-row')).toBeInTheDocument()
  })

  it('preserves desktop expansion when navigating from another feature back to AI Chat', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 })
    act(() => useAppStore.setState({ activePage: 'translate' }))
    render(<Sidebar />)

    const sidebar = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(sidebar).toHaveAttribute('data-responsive-compact', 'false')
    expect(sidebar).toHaveAttribute('data-collapsed', 'false')
    expect(sidebar).toHaveAttribute('data-user-collapsed', 'false')
    expect(useAppStore.getState().sidebarCollapsed).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'AI Chat' }))

    expect(sidebar).toHaveAttribute('data-responsive-compact', 'false')
    expect(sidebar).toHaveAttribute('data-collapsed', 'false')
    expect(useAppStore.getState().activePage).toBe('chat')
    expect(useAppStore.getState().sidebarCollapsed).toBe(false)
  })

  it('keeps the primary rail compact on non-chat features below the narrow threshold', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
    act(() => useAppStore.setState({ activePage: 'translate' }))
    render(<Sidebar />)

    const sidebar = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(sidebar).toHaveAttribute('data-responsive-compact', 'true')
    expect(sidebar).toHaveAttribute('data-collapsed', 'true')
    expect(useAppStore.getState().sidebarCollapsed).toBe(false)
  })
})
