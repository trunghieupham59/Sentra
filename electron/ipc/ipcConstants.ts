/**
 * Shared constants for Electron IPC handlers.
 *
 * Centralizes magic numbers and strings (HC-01 through HC-08) that were
 * previously scattered across translate.ts, chat.ts, imageTranslate.ts,
 * models.ts, and tts.ts.
 */

// ── Gemini REST API ───────────────────────────────────────────────────────────
/**
 * Base URL for Gemini REST API.
 * HC-06: Was repeated verbatim in imageTranslate.ts, tts.ts, and models.ts.
 * Update here if Google changes the API version path.
 */
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// ── Anthropic API ─────────────────────────────────────────────────────────────
/**
 * Anthropic API version header value.
 * HC-07: Was hardcoded in models.ts. Update when Anthropic releases a new stable version.
 */
export const ANTHROPIC_API_VERSION = '2023-06-01'

// ── Translation output token limits ───────────────────────────────────────────
/**
 * HC-01: Max output tokens for Claude translation/rewrite calls.
 * Claude supports extended output; this matches the long-context tier.
 */
export const MAX_OUTPUT_TOKENS_CLAUDE = 16_000

/**
 * HC-01: Max output tokens for OpenAI translation/rewrite calls.
 * GPT-4o supports up to 16 384 completion tokens.
 */
export const MAX_OUTPUT_TOKENS_OPENAI = 16_384

// ── Chat / image-translate output token limits ────────────────────────────────
/**
 * HC-02: Max output tokens for chat and image-translate responses.
 * Shorter than full-document translation — chat responses are typically concise.
 */
export const MAX_CHAT_OUTPUT_TOKENS = 4_096

// ── Chat input character limit (main process) ─────────────────────────────────
/**
 * HC-08: Maximum characters allowed in a single chat message — main process enforcement.
 *
 * IMPORTANT: Must stay in sync with MAX_CHAT_INPUT_CHARS in src/constants/providers.ts
 * which enforces the same limit in the renderer.  Both values exist because Electron
 * IPC separates main-process and renderer bundles; the renderer constant prevents
 * the UI from sending oversized requests, while this constant validates them server-side
 * even if the renderer check is bypassed (e.g. via direct IPC calls).
 */
export const MAX_CHAT_REQUEST_CHARS = 3_000

// ── API key verification models ───────────────────────────────────────────────
// HC-05: Lightweight models used only to verify key validity — cheapest/fastest per provider.
// These are deliberately separate from the translation models in src/constants/providers.ts
// because verification needs minimal cost, not necessarily the best translation quality.

/** Cheapest Gemini model suitable for a minimal generateContent call. */
export const VERIFY_MODEL_GEMINI = 'gemini-2.0-flash'

/** Cheapest Claude model suitable for a minimal messages.create call. */
export const VERIFY_MODEL_CLAUDE = 'claude-3-haiku-20240307'

/** Cheapest OpenAI chat model suitable for a minimal chat.completions.create call. */
export const VERIFY_MODEL_OPENAI = 'gpt-4o-mini'

// ── Gemini specialised model IDs ──────────────────────────────────────────────
/** Gemini TTS model — optimised for low-latency, low-cost speech synthesis. */
export const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts'

/** Gemini image-editing model — used for in-image text translation. */
export const GEMINI_IMAGE_EDIT_MODEL = 'gemini-2.0-flash-exp-image-generation'
