/**
 * Shared mock helper for IPC handler unit tests.
 *
 * Extracted from 4 duplicate `buildMockIpcMain()` functions in:
 *   - chat.test.ts, translate.test.ts, tts.test.ts, imageTranslate.test.ts
 *
 * DUP-FIX: consolidates the exact duplicate into a single source of truth.
 */

type IpcHandler = (...args: unknown[]) => unknown

/**
 * Builds a minimal IpcMain mock that records registered handlers
 * and exposes an `invoke` helper to call them with a fake event.
 */
export function buildMockIpcMain() {
  const handlers: Record<string, IpcHandler> = {}

  const ipcMain = {
    handle: (channel: string, handler: IpcHandler) => {
      handlers[channel] = handler
    },
  }

  /** Invoke a registered handler with a fake Electron event + any extra args. */
  const invoke = (channel: string, ...args: unknown[]) =>
    handlers[channel]?.({} /* fake _event */, ...args)

  return { ipcMain, invoke }
}
