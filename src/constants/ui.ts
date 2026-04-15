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
