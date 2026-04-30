import type { ChatSendShortcut } from '../types'

export const DEFAULT_CHAT_NEW_SESSION_SHORTCUT = 'CommandOrControl+N'
export const DEFAULT_CHAT_SEND_SHORTCUT: ChatSendShortcut = 'enter'

type KeyboardLikeEvent = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>

const KEY_MAP: Record<string, string> = {
  ' ': 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Escape: 'Escape',
  Enter: 'Enter',
  Return: 'Enter',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Tab: 'Tab',
  Space: 'Space',
  Up: 'Up',
  Down: 'Down',
  Left: 'Left',
  Right: 'Right',
  F1: 'F1',
  F2: 'F2',
  F3: 'F3',
  F4: 'F4',
  F5: 'F5',
  F6: 'F6',
  F7: 'F7',
  F8: 'F8',
  F9: 'F9',
  F10: 'F10',
  F11: 'F11',
  F12: 'F12',
}

const MODIFIER_KEYS = new Set(['Meta', 'Command', 'Control', 'Ctrl', 'Alt', 'Option', 'Shift'])

function isMacPlatform(platform?: string) {
  return platform === 'darwin'
}

function normalizeShortcutKey(key: string): string {
  const mapped = KEY_MAP[key]
  if (mapped) return mapped
  return key.length === 1 ? key.toUpperCase() : key
}

function normalizeShortcutPart(part: string): string {
  const trimmed = part.trim()
  const lower = trimmed.toLowerCase()
  if (lower === 'cmd' || lower === 'command' || lower === 'meta') return 'Command'
  if (lower === 'control' || lower === 'ctrl') return 'Ctrl'
  if (lower === 'option' || lower === 'alt') return 'Alt'
  if (lower === 'shift') return 'Shift'
  if (lower === 'commandorcontrol' || lower === 'cmdorctrl') return 'CommandOrControl'
  return normalizeShortcutKey(trimmed)
}

export function keyEventToAccelerator(e: KeyboardLikeEvent): string {
  const parts: string[] = []
  if (e.metaKey) parts.push('Command')
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (MODIFIER_KEYS.has(e.key)) return ''
  parts.push(normalizeShortcutKey(e.key))
  return parts.join('+')
}

export function formatShortcutLabel(shortcut: string, platform?: string): string {
  if (!shortcut) return ''
  const isMac = isMacPlatform(platform)
  return shortcut
    .split('+')
    .map((part) => {
      const normalized = normalizeShortcutPart(part)
      if (normalized === 'CommandOrControl') return isMac ? 'Cmd' : 'Ctrl'
      if (normalized === 'Command') return 'Cmd'
      if (normalized === 'Enter') return 'Enter'
      return normalized
    })
    .join('+')
}

export function eventMatchesShortcut(e: KeyboardLikeEvent, shortcut: string, platform?: string): boolean {
  if (!shortcut) return false

  const parts = shortcut.split('+').map(normalizeShortcutPart).filter(Boolean)
  const key = parts.find((part) => !['Command', 'Ctrl', 'Alt', 'Shift', 'CommandOrControl'].includes(part))
  if (!key) return false

  const wantsCommandOrControl = parts.includes('CommandOrControl')
  const wantsCommand = parts.includes('Command')
  const wantsCtrl = parts.includes('Ctrl')
  const wantsAlt = parts.includes('Alt')
  const wantsShift = parts.includes('Shift')
  const isMac = isMacPlatform(platform)

  const expectedMeta = wantsCommand || (wantsCommandOrControl && isMac)
  const expectedCtrl = wantsCtrl || (wantsCommandOrControl && !isMac)

  return (
    e.metaKey === expectedMeta &&
    e.ctrlKey === expectedCtrl &&
    e.altKey === wantsAlt &&
    e.shiftKey === wantsShift &&
    normalizeShortcutKey(e.key) === key
  )
}

export function shouldSendChatMessage(e: KeyboardLikeEvent, shortcut: ChatSendShortcut, platform?: string): boolean {
  if (shortcut === 'modEnter') {
    return eventMatchesShortcut(e, 'CommandOrControl+Enter', platform)
  }

  return e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey
}
