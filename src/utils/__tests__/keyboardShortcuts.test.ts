import { describe, expect, it } from 'vitest'
import { eventMatchesShortcut, formatShortcutLabel, keyEventToAccelerator, shouldSendChatMessage } from '../keyboardShortcuts'

const event = (overrides: Partial<KeyboardEvent>): KeyboardEvent => ({
  key: '',
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...overrides,
}) as KeyboardEvent

describe('keyboardShortcuts', () => {
  it('formats CommandOrControl per platform', () => {
    expect(formatShortcutLabel('CommandOrControl+N', 'darwin')).toBe('Cmd+N')
    expect(formatShortcutLabel('CommandOrControl+N', 'win32')).toBe('Ctrl+N')
  })

  it('converts key events to accelerator strings', () => {
    expect(keyEventToAccelerator(event({ key: 'k', altKey: true }))).toBe('Alt+K')
    expect(keyEventToAccelerator(event({ key: 'Enter', metaKey: true }))).toBe('Command+Enter')
    expect(keyEventToAccelerator(event({ key: 'Meta', metaKey: true }))).toBe('')
  })

  it('matches platform-aware shortcuts exactly', () => {
    expect(eventMatchesShortcut(event({ key: 'n', metaKey: true }), 'CommandOrControl+N', 'darwin')).toBe(true)
    expect(eventMatchesShortcut(event({ key: 'n', ctrlKey: true }), 'CommandOrControl+N', 'win32')).toBe(true)
    expect(eventMatchesShortcut(event({ key: 'n', ctrlKey: true }), 'CommandOrControl+N', 'darwin')).toBe(false)
    expect(eventMatchesShortcut(event({ key: 'n', metaKey: true, shiftKey: true }), 'CommandOrControl+N', 'darwin')).toBe(false)
  })

  it('honors chat send shortcut modes', () => {
    expect(shouldSendChatMessage(event({ key: 'Enter' }), 'enter', 'darwin')).toBe(true)
    expect(shouldSendChatMessage(event({ key: 'Enter', shiftKey: true }), 'enter', 'darwin')).toBe(false)
    expect(shouldSendChatMessage(event({ key: 'Enter' }), 'modEnter', 'darwin')).toBe(false)
    expect(shouldSendChatMessage(event({ key: 'Enter', metaKey: true }), 'modEnter', 'darwin')).toBe(true)
  })
})
