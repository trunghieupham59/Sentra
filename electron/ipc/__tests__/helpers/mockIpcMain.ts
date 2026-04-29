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
  const sentEvents: Array<{ channel: string; payload: unknown }> = []

  const ipcMain = {
    handle: (channel: string, handler: IpcHandler) => {
      handlers[channel] = handler
    },
  }

  /** Invoke a registered handler with a fake Electron event + any extra args. */
  // biome-ignore lint/suspicious/noExplicitAny: test helper — callers need to access result properties without explicit casting
  const invoke = (channel: string, ...args: unknown[]): any =>
    handlers[channel]?.({
      sender: {
        send: (eventChannel: string, payload: unknown) => {
          sentEvents.push({ channel: eventChannel, payload })
        },
      },
    } /* fake _event */, ...args)

  return { ipcMain, invoke, sentEvents }
}
