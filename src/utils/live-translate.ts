/**
 * Pure utility functions for the Live Translate pipeline.
 *
 * Extracted from LiveTranslatePage.tsx — pure functions are here so they can
 * be unit-tested without mounting the full React component.
 */

// ── Whisper hallucination filter ──────────────────────────────────────────────
/**
 * Whisper hallucinates stock phrases from its training data (YouTube/podcast
 * transcripts) when given silent or near-silent audio.  This filter rejects
 * those known patterns as a second line of defence after VAD.
 *
 * Covers: English, Japanese, Korean, Vietnamese common hallucination phrases,
 * as well as structural indicators (bracketed sounds, lone punctuation, repetitions).
 */
const HALLUCINATION_PATTERNS: RegExp[] = [
  // ── English ──────────────────────────────────────────────────────────────
  /thank(s)? (you )?for watching/i,
  /thank(s)? for (your|the)/i,
  /please (like|subscribe|share|follow)/i,
  /don'?t forget to (like|subscribe|hit|click)/i,
  /subtitles? by/i,
  /transcribed by/i,
  /auto-?generated (caption|subtitle)/i,
  /^[\s.…,\-–—]+$/,                    // lone punctuation / whitespace

  // ── Bracketed / parenthesized sound effects ───────────────────────────────
  /^\s*[\[(（【].*[\]）】]\s*$/,          // e.g. [Music], (拍手), 【BGM】
  /\(music\)/i,
  /\[music\]/i,
  /\[applause\]/i,
  /\[laughter\]/i,
  /\[silence\]/i,
  /\[noise\]/i,
  /\[inaudible\]/i,
  /\[crosstalk\]/i,

  // ── Japanese ─────────────────────────────────────────────────────────────
  /ご視聴ありがとうございました/,
  /ご視聴ありがとう/,
  /チャンネル登録/,
  /高評価.*お願い/,
  /字幕.*提供/,
  /字幕.*作成/,
  /^ありがとうございます[。！]*$/,       // standalone "thank you" (no content)
  /^ありがとう[。！]*$/,
  /^どうもありがとう[。！]*$/,
  /^\(拍手\)$/,
  /^\[拍手\]$/,
  /^\(笑\)$/,
  /^\[笑\]$/,
  /^\(音楽\)$/,
  /^\[音楽\]$/,

  // ── Korean ───────────────────────────────────────────────────────────────
  /시청해\s*주셔서\s*감사합니다/,
  /시청해\s*주신\s*여러분/,
  /구독.*좋아요/,
  /좋아요.*구독/,
  /^감사합니다[.]?$/,                   // standalone "thank you"
  /자막.*제공/,
  /자막.*제작/,

  // ── Vietnamese ───────────────────────────────────────────────────────────
  /cảm\s*ơn\s*(các\s*bạn|bạn|quý\s*vị).*xem/i,   // "cảm ơn các bạn đã xem"
  /cảm\s*ơn.*theo\s*dõi/i,
  /đăng\s*ký\s*(kênh|channel)/i,
  /nhấn\s*(like|nút|chuông)/i,
  /bấm\s*(like|đăng\s*ký|theo\s*dõi)/i,
  /like\s*(và|&)\s*đăng\s*ký/i,
  /subscribe.*channel/i,
  /phụ\s*đề.*cung\s*cấp/i,
  /phụ\s*đề.*bởi/i,
  /^xin\s*chào[.!]*$/i,                           // standalone "hello" with nothing else
  /^cảm\s*ơn[.!]*$/i,                             // standalone "thank you"
  /^vâng[,.]?\s*$/i,                              // lone filler "vâng"
  /^ừ[,.]?\s*$/i,                                 // lone filler "ừ"
  /^\(tiếng\s*(nhạc|vỗ\s*tay|cười)\)$/i,          // bracketed sound effects in Vietnamese
  /^\[tiếng\s*(nhạc|vỗ\s*tay|cười)\]$/i,
]

/**
 * Returns `true` when the text is a known Whisper hallucination OR structurally invalid.
 *
 * Checks (in order):
 *   1. Too short (< 4 chars after trimming)
 *   2. Matches a known hallucination pattern
 *   3. Single-character repetition ≥ 4 times covering > 60% of text
 *   4. Word-level n-gram repetition: any bigram or trigram repeating ≥ 3 times
 *      (catches "hello hello hello" or "xin chào xin chào xin chào" style loops)
 */
export function isHallucination(text: string): boolean {
  const t = text.trim()
  if (t.length < 4) return true

  if (HALLUCINATION_PATTERNS.some(p => p.test(t))) return true

  // ── Check 3: single-character flooding ───────────────────────────────────
  const charFreq = new Map<string, number>()
  for (const ch of t) charFreq.set(ch, (charFreq.get(ch) ?? 0) + 1)
  const maxCharFreq = Math.max(...charFreq.values())
  if (maxCharFreq >= 4 && maxCharFreq / t.length > 0.6) return true

  // ── Check 4: n-gram word repetition ──────────────────────────────────────
  // Tokenise on whitespace; CJK chars treated as single-char tokens
  const tokens = t
    .replace(/[\u3000-\u9fff\uac00-\ud7ff\u3040-\u30ff]/g, c => ` ${c} `)
    .split(/\s+/)
    .filter(Boolean)

  if (tokens.length >= 6) {
    // Check bigrams and trigrams for repetition (≥ 3 occurrences = hallucination)
    for (const n of [2, 3]) {
      const ngFreq = new Map<string, number>()
      for (let i = 0; i <= tokens.length - n; i++) {
        const gram = tokens.slice(i, i + n).join(' ')
        ngFreq.set(gram, (ngFreq.get(gram) ?? 0) + 1)
      }
      for (const count of ngFreq.values()) {
        if (count >= 3) return true
      }
    }
  }

  return false
}

/**
 * Jaccard similarity on word-bag: ratio of shared words to total unique words.
 *
 * Used to detect near-duplicate Whisper outputs between consecutive chunks.
 * Returns 0.0 (no overlap) … 1.0 (identical word bags).
 */
export function jaccardSimilarity(a: string, b: string): number {
  const words = (s: string) => new Set(s.toLowerCase().split(/\s+/).filter(Boolean))
  const setA = words(a)
  const setB = words(b)
  if (setA.size === 0 && setB.size === 0) return 1
  let intersection = 0
  for (const w of setA) if (setB.has(w)) intersection++
  const union = setA.size + setB.size - intersection
  return union === 0 ? 1 : intersection / union
}

/**
 * Split accumulated transcript text at sentence boundaries.
 *
 * Sentence boundaries: `.  !  ?  。  ！  ？  ‼  ⁉  …` optionally followed by whitespace.
 * Returns:
 *   - `complete`: everything up to and including the last boundary (ready to translate)
 *   - `pending`:  the remainder after the last boundary (still accumulating)
 */
export function extractCompleteSentences(text: string): { complete: string; pending: string } {
  // ASCII punctuation (.!?) requires trailing whitespace or EOL (Latin scripts).
  // CJK full-width punctuation (。！？‼⁉…) matches standalone — no space needed.
  const re = /[.!?]+(?:\s|$)|[。！？‼⁉…]+/g
  const matches = [...text.matchAll(re)]
  if (matches.length === 0) return { complete: '', pending: text.trim() }
  const last = matches[matches.length - 1]
  const split = (last.index ?? 0) + last[0].length
  return {
    complete: text.slice(0, split).trim(),
    pending:  text.slice(split).trim(),
  }
}
