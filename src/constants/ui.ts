/**
 * UI timing constants — shared across pages and components.
 *
 * HC-03: The value 1500 (copy feedback duration) was previously hardcoded
 * independently in both TranslatePage.tsx and ChatPage.tsx.
 */

/** How long (ms) the "Copied!" feedback label is shown after a copy action.
 *  Used in TranslatePage and ChatPage to ensure consistent UX. */
export const COPY_FEEDBACK_DURATION_MS = 1_500

/** Debounce delay (ms) before auto-translating an image attachment.
 *  Images don't have typed text to debounce on, so a short fixed delay is used. */
export const IMAGE_AUTO_TRANSLATE_DELAY_MS = 300

// ─── Status / feedback reset delays ───────────────────────────────────────────

/** How long (ms) before resetting a verify status indicator back to 'idle'.
 *  Used in ApiKeyInput after showing success/rate-limited result. */
export const VERIFY_STATUS_RESET_DELAY_MS = 5_000

/** How long (ms) before resetting a short-lived UI status (e.g. hotkey "done"). */
export const STATUS_RESET_DELAY_MS = 3_000

/** How long (ms) before resetting a long-lived UI status (e.g. hotkey "error"). */
export const STATUS_RESET_LONG_MS = 5_000

/** How long (ms) before a toast / inline message auto-dismisses. */
export const TOAST_DISMISS_DELAY_MS = 4_000

// ─── Live Translate ────────────────────────────────────────────────────────────

/** Minimum audio blob size (bytes) to consider worth processing.
 *  Blobs smaller than this are likely silence or encoding artefacts. */
export const MIN_AUDIO_BLOB_BYTES = 1_000

/** Default subtitle segment duration (ms) when the next segment timestamp is unknown. */
export const DEFAULT_SEGMENT_DURATION_MS = 3_000

/** Minimum subtitle segment display duration (ms) to avoid flash-of-content. */
export const MIN_SEGMENT_DURATION_MS = 500
