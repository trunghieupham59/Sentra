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

// ── API key verification token limit ─────────────────────────────────────────
/**
 * HC-NEW-09: Max output tokens for API key verification calls.
 * We only need the model to say "ok" — 10 tokens is more than enough.
 * Named constant so it matches the verify model constants pattern.
 */
export const VERIFY_MAX_TOKENS = 10

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
export const GEMINI_IMAGE_EDIT_MODEL = 'gemini-2.0-flash-preview-image-generation'

// ── External API base URLs ────────────────────────────────────────────────────
/** Anthropic REST API base URL. HC: centralised so it can be updated in one place. */
export const ANTHROPIC_API_BASE = 'https://api.anthropic.com'

// ── Vision model discovery ────────────────────────────────────────────────────
/** Max models to request from Gemini models list API. */
export const GEMINI_MODELS_PAGE_SIZE = 50

/** Max models to request from Anthropic models list API. */
export const ANTHROPIC_MODELS_LIMIT = 20

/** Timeout (ms) for provider models-list API calls used during vision fallback discovery. */
export const VISION_DISCOVERY_TIMEOUT_MS = 5_000

// ── Language detection input limit ───────────────────────────────────────────
/**
 * Maximum characters of source text sent to the AI for language detection.
 * Enough to reliably identify any language; truncating saves tokens on long inputs.
 *
 * NOTE: Must stay in sync with DETECT_LANG_MAX_CHARS in src/constants/providers.ts
 * which trims the text in the renderer before the IPC call (defence-in-depth).
 */
export const DETECT_LANG_MAX_CHARS = 500

// ── Vision model scoring weights ─────────────────────────────────────────────
// Used by scoreModelForVision() to rank candidates cheapest/fastest first.
// Higher score = more preferred. Adjust when provider pricing tiers change.
export const VISION_SCORE_CHEAP   = 100  // flash / mini / haiku — fastest & cheapest
export const VISION_SCORE_MID     = 70   // 4o / sonnet — balanced
export const VISION_SCORE_CAPABLE = 60   // pro — more capable
export const VISION_SCORE_BASIC   = 50   // gpt-4 base tier
export const VISION_SCORE_SLOW    = 20   // opus — most powerful but slowest/priciest
export const VISION_SCORE_GEN_WEIGHT = 10  // bonus per generation number unit
export const VISION_SCORE_LITE_PENALTY = 30 // penalty for lite/nano variants

// ── Lightweight translation token limits & defaults ──────────────────────────
/** HC-01: Max output tokens cho lightweight translation calls (global hotkey, bookmarklet extension).
 *  Nhỏ hơn MAX_CHAT_OUTPUT_TOKENS (4096) vì các call này cần nhanh, output ngắn. */
export const MAX_LIGHTWEIGHT_TRANSLATE_TOKENS = 2_048

/** HC-09: Default Gemini model cho local server extension endpoint. */
export const EXT_DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash'

// ── Shared lightweight translation system prompt ──────────────────────────────
/** Shared system prompt cho các lightweight translation calls (bookmarklet, global hotkey).
 *  Khác với SYSTEM_PROMPT trong translate.ts — bản đó có cultural nuance rules phức tạp hơn. */
export const LIGHTWEIGHT_TRANSLATOR_PROMPT =
  'You are an expert translator. Translate accurately and naturally. ' +
  'Output ONLY the translation — no notes, no alternatives, no explanations.'

/** Tên preset voice dùng cho Gemini TTS. Xem: https://ai.google.dev/gemini-api/docs/speech */
export const GEMINI_TTS_VOICE_NAME = 'Aoede'

// ── Edge TTS (Microsoft Neural TTS — free, no API key needed) ────────────────
/** WebSocket endpoint for Microsoft Edge TTS (via browser speech service). */
export const EDGE_TTS_WS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'
/** Trusted client token required by Edge TTS DRM — public, used by open-source clients. */
export const EDGE_TTS_TRUSTED_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
/** Chromium version string used in Edge TTS DRM and User-Agent header. */
export const EDGE_TTS_CHROMIUM_FULL = '143.0.3650.75'
/** Chromium major version used in User-Agent header. */
export const EDGE_TTS_CHROMIUM_MAJOR = '143'
/** Windows epoch offset (seconds between Unix epoch and Windows file time epoch). */
export const EDGE_TTS_WIN_EPOCH = 11644473600
/** Default Edge TTS voice — Vietnamese female, natural quality. */
export const EDGE_TTS_DEFAULT_VOICE = 'vi-VN-HoaiMyNeural'
/** Default speaking rate for Edge TTS — +20% faster than neutral. */
export const EDGE_TTS_DEFAULT_RATE = '+20%'

// ── ElevenLabs TTS ────────────────────────────────────────────────────────────
/** ElevenLabs REST API base URL. */
export const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io'
/** ElevenLabs model — multilingual v2 for best cross-language quality. */
export const ELEVENLABS_TTS_MODEL = 'eleven_multilingual_v2'
/** Default ElevenLabs voice ID — Adam (neutral, works well for all languages). */
export const ELEVENLABS_DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'

// ── ElevenLabs voice quality settings ────────────────────────────────────────
/** Stability: balance between consistent delivery (1.0) and expressive variability (0.0). */
export const ELEVENLABS_STABILITY = 0.5
/** Similarity boost: how closely the output matches the original voice. Higher = more similar. */
export const ELEVENLABS_SIMILARITY_BOOST = 0.75
/** Style exaggeration: 0.0 = off (recommended for most use cases to avoid distortion). */
export const ELEVENLABS_STYLE = 0.0

// ── OpenAI TTS & STT models ───────────────────────────────────────────────────
/** OpenAI TTS model — standard quality, low latency. Upgrade to 'tts-1-hd' for higher quality. */
export const OPENAI_TTS_MODEL = 'tts-1'

/** OpenAI Whisper STT model — supports 99 languages, used for voice input and live transcription. */
export const WHISPER_MODEL = 'whisper-1'

// ── Gemini STT (audio transcription via Gemini multimodal API) ────────────────
/**
 * Gemini model used for audio transcription (STT fallback when Whisper is unavailable).
 * Uses the Gemini generateContent API with audio inline_data — same API key as translation,
 * no additional Google Cloud APIs or GCP Console setup required.
 * gemini-2.0-flash: fast, accurate, supports 100+ languages, handles all common audio formats.
 */
export const GEMINI_STT_MODEL = 'gemini-2.0-flash'

// ── Lightweight translate default models (used when no model is specified) ────
/**
 * Default OpenAI model for lightweight translation (global hotkey, bookmarklet).
 * NOTE: EXT_DEFAULT_GEMINI_MODEL is already defined above.
 */
export const EXT_DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'

/** Default Claude model for lightweight translation. */
export const EXT_DEFAULT_CLAUDE_MODEL = 'claude-3-5-haiku-20241022'

// ── Edge TTS timeout ──────────────────────────────────────────────────────────
/**
 * Safety timeout (ms) for Edge TTS WebSocket connection.
 * 8 s allows the fallback chain (OpenAI → Gemini → Edge → ElevenLabs) to
 * kick in quickly without blocking the TTS pipeline for too long.
 */
export const EDGE_TTS_TIMEOUT_MS = 8_000

// ── Chunked translation parameters ────────────────────────────────────────────
/**
 * HC-09: Maximum characters per chunk sent to the AI.
 *
 * ~12 000 chars ≈ 3 000 tokens — safely fits in context window even for smaller
 * models (8K ctx) after accounting for system prompt (~500 tok) + output (~3 000 tok).
 * For modern large-context models this just means fewer, larger chunks.
 *
 * Referenced by translate.ts chunking logic. Change here to affect all chunked operations.
 */
export const TRANSLATE_CHUNK_CHAR_LIMIT = 12_000

/**
 * HC-10: Timeout (ms) per individual chunk request.
 * 90 s is generous enough for large, complex translation chunks on slower models.
 * Prevents a single stalled chunk from blocking the entire translateChunked pipeline.
 */
export const TRANSLATE_CHUNK_TIMEOUT_MS = 90_000

/**
 * HC-11: Max concurrent chunk requests.
 * Limits parallel API calls per translateChunked call to avoid rate-limit errors.
 * 5 concurrent chunks = good throughput without hammering provider rate limits.
 */
export const TRANSLATE_CHUNK_CONCURRENCY = 5

/**
 * HC-12: Characters of previous source chunk to include as overlap context.
 * Gives the model enough prior text to maintain consistent terminology and style
 * across chunk boundaries without sending the full prior chunk (saves tokens).
 */
export const TRANSLATE_CONTEXT_TAIL_CHARS = 400
