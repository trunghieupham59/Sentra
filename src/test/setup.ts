/**
 * Vitest global test setup.
 *
 * - Provides a minimal mock of `window.api` (the Electron IPC bridge)
 *   so component/store tests can run in jsdom without Electron.
 * - Runs before every test file automatically (configured in vitest.config.ts).
 *
 * NOTE: Electron IPC tests run in Node environment where `window` is not defined.
 * All DOM-related setup is guarded so this file can be safely loaded in both
 * jsdom (src tests) and Node (electron/__tests__ tests).
 */
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Only set up DOM mocks when running in a browser-like environment (jsdom).
// Electron IPC tests use @vitest-environment node which has no `window`.
if (typeof window !== 'undefined') {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn()
  }

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
      chatStream: vi.fn().mockResolvedValue({ success: false }),
      onChatStreamEvent: vi.fn().mockReturnValue(() => {}),
      fetchModels: vi.fn().mockResolvedValue({ success: false, models: [] }),
      discoverLocalAi: vi.fn().mockResolvedValue({ success: false, available: false, models: [], suggestedModels: [], hardware: { platform: 'darwin', arch: 'arm64', cpuCount: 8, totalMemoryGb: 16, tier: 'powerful' } }),
      ensureLocalAiRuntime: vi.fn().mockResolvedValue({ success: false, available: false, models: [], suggestedModels: [], hardware: { platform: 'darwin', arch: 'arm64', cpuCount: 8, totalMemoryGb: 16, tier: 'powerful' } }),
      benchmarkLocalAi: vi.fn().mockResolvedValue({
        hardware: { platform: 'darwin', arch: 'arm64', cpuCount: 8, totalMemoryGb: 16, tier: 'powerful' },
        suggestedModels: [],
        metrics: { cpuScore: 100, memoryScore: 100, combinedScore: 100, durationMs: 300 },
      }),
      downloadLocalAiModel: vi.fn().mockResolvedValue({ success: false, model: '' }),
      uninstallLocalAiModel: vi.fn().mockResolvedValue({ success: false, model: '' }),
      onLocalAiModelDownloadProgress: vi.fn().mockReturnValue(() => {}),
      installOllama: vi.fn().mockResolvedValue({ success: false }),
      cancelOllamaInstall: vi.fn().mockResolvedValue({ success: false }),
      onLocalAiInstallProgress: vi.fn().mockReturnValue(() => {}),
      verifyKey: vi.fn().mockResolvedValue({ success: false }),
      checkScreenPermission: vi.fn().mockResolvedValue('denied'),
      openExternal: vi.fn().mockResolvedValue(undefined),
      relaunchApp: vi.fn().mockResolvedValue(undefined),
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
        chat: {
          update: vi.fn().mockResolvedValue({ success: true }),
          get: vi.fn().mockResolvedValue({ success: true, settings: {} }),
          onOpen: vi.fn().mockReturnValue(() => {}),
        },
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
        syncConfig: vi.fn().mockResolvedValue({ success: true }),
      },
      platform: 'darwin',
      version: '1.0.0',
    },
    writable: true,
    configurable: true,
  })
}
