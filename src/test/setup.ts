/**
 * Vitest global test setup.
 *
 * - Provides a minimal mock of `window.api` (the Electron IPC bridge)
 *   so component/store tests can run in jsdom without Electron.
 * - Runs before every test file automatically (configured in vite.config.ts).
 */
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock localStorage — required for Zustand persist middleware in jsdom environment
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
})

// Mock window.api — the Electron context bridge is not available in jsdom.
// Tests that need specific return values should override individual mocks per test.
Object.defineProperty(window, 'api', {
  value: {
    translate: vi.fn().mockResolvedValue({ success: false }),
    rewriteText: vi.fn().mockResolvedValue({ success: false }),
    transcribeAudio: vi.fn().mockResolvedValue({ success: false }),
    speakText: vi.fn().mockResolvedValue({ success: false }),
    translateImage: vi.fn().mockResolvedValue({ success: false }),
    translateStream: vi.fn().mockResolvedValue({ success: false }),
    chat: vi.fn().mockResolvedValue({ success: false }),
    fetchModels: vi.fn().mockResolvedValue({ success: false, models: [] }),
    verifyKey: vi.fn().mockResolvedValue({ success: false }),
    checkScreenPermission: vi.fn().mockResolvedValue('denied'),
    openExternal: vi.fn().mockResolvedValue(undefined),
    keychain: {
      save: vi.fn().mockResolvedValue({ success: true }),
      get: vi.fn().mockResolvedValue({ exists: false, masked: null }),
      delete: vi.fn().mockResolvedValue({ success: true }),
      hasKey: vi.fn().mockResolvedValue({ exists: false }),
    },
    subtitle: {
      show: vi.fn().mockResolvedValue(undefined),
      hide: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      setStyle: vi.fn().mockResolvedValue(undefined),
      onClosed: vi.fn().mockReturnValue(() => {}),
    },
    hotkey: {
      update: vi.fn().mockResolvedValue({ success: true }),
      get: vi.fn().mockResolvedValue({ success: true, settings: {} }),
      disable: vi.fn().mockResolvedValue({ success: true }),
      onTranslating: vi.fn().mockReturnValue(() => {}),
      onTranslated: vi.fn().mockReturnValue(() => {}),
      onError: vi.fn().mockReturnValue(() => {}),
    },
    legacyAssistant: {
      get: vi.fn().mockResolvedValue({ success: true, settings: {} }),
      update: vi.fn().mockResolvedValue({ success: true }),
      getBookmarklet: vi.fn().mockResolvedValue({ success: true, bookmarklet: '' }),
      injectNow: vi.fn().mockResolvedValue({ success: true }),
    },
    updater: {
      check: vi.fn().mockResolvedValue({ success: true }),
      download: vi.fn().mockResolvedValue({ success: true }),
      install: vi.fn().mockResolvedValue({ success: true }),
      getVersion: vi.fn().mockResolvedValue({ version: '1.0.0' }),
      onStatus: vi.fn().mockReturnValue(() => {}),
    },
    localServer: {
      createToken: vi.fn().mockResolvedValue({ success: true }),
      listTokens: vi.fn().mockResolvedValue({ success: true, port: 39875, tokens: [] }),
      deleteToken: vi.fn().mockResolvedValue({ success: true }),
      regenerateToken: vi.fn().mockResolvedValue({ success: true }),
    },
    platform: 'darwin',
    version: '1.0.0',
  },
  writable: true,
  configurable: true,
})
