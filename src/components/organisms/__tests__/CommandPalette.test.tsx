import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../../../store/useAppStore'
import { CommandPalette } from '../CommandPalette'

function CommandPaletteHarness() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open palette</button>
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </>
  )
}

describe('CommandPalette', () => {
  beforeEach(() => {
    act(() => {
      useAppStore.setState({
        activePage: 'history',
        locale: 'en',
        settingsOpen: false,
        sourceText: 'Text to clear',
        translatedText: 'Translated text to clear',
      })
    })
  })

  it('renders as an accessible modal, filters commands, and shows an empty state', async () => {
    render(<CommandPalette open onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog', { name: 'Command palette' })
    const search = within(dialog).getByRole('combobox', { name: 'Search commands…' })
    await waitFor(() => expect(search).toHaveFocus())

    expect(within(dialog).getAllByRole('option')).toHaveLength(6)
    expect(search).toHaveAttribute('aria-activedescendant')

    fireEvent.change(search, { target: { value: 'dictionary' } })
    expect(within(dialog).getAllByRole('option')).toHaveLength(1)
    expect(within(dialog).getByRole('option', { name: /Dictionary/ })).toHaveAttribute(
      'data-command-id',
      'dictionary',
    )

    fireEvent.change(search, { target: { value: 'command that does not exist' } })
    expect(within(dialog).queryByRole('option')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('status')).toHaveTextContent('No matching commands')
  })

  it('navigates with the keyboard and ignores Enter while an IME composition is active', () => {
    const onClose = vi.fn()
    render(<CommandPalette open onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Enter', isComposing: true })
    expect(onClose).not.toHaveBeenCalled()
    expect(useAppStore.getState().activePage).toBe('history')

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: /AI Translate/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    fireEvent.keyDown(window, { key: 'Enter' })
    expect(useAppStore.getState().activePage).toBe('translate')
    expect(useAppStore.getState().sourceText).toBe('')
    expect(useAppStore.getState().translatedText).toBe('')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('matches Vietnamese commands without diacritics', () => {
    act(() => useAppStore.setState({ locale: 'vi' }))
    render(<CommandPalette open onClose={vi.fn()} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Tìm lệnh…' }), {
      target: { value: 'cai dat' },
    })

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveAttribute('data-command-id', 'settings')
  })

  it('traps focus and restores it to the opener after Escape', async () => {
    render(<CommandPaletteHarness />)

    const opener = screen.getByRole('button', { name: 'Open palette' })
    opener.focus()
    fireEvent.click(opener)

    const search = await screen.findByRole('combobox', { name: 'Search commands…' })
    await waitFor(() => expect(search).toHaveFocus())

    fireEvent.keyDown(window, { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Tab' })
    expect(search).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(opener).toHaveFocus()
  })
})
