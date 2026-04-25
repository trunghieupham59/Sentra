// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  DETECT_LANG_MAX_CHARS as MAIN_DETECT_LANG_MAX_CHARS,
  MAX_CHAT_REQUEST_CHARS,
  TRANSLATE_CHUNK_CHAR_LIMIT,
  TRANSLATE_CHUNK_CONCURRENCY,
  TRANSLATE_CHUNK_TIMEOUT_MS,
  TRANSLATE_CONTEXT_TAIL_CHARS,
} from '../ipcConstants'

// Không thể import từ src/ (khác tsconfig), hardcode expected values.
// Nếu test này fail → update CẢ HAI constant VÀ test này.
const EXPECTED_MAX_CHAT_INPUT_CHARS = 3000
const EXPECTED_DETECT_LANG_MAX_CHARS = 500

describe('Cross-boundary constant sync', () => {
  it('MAX_CHAT_REQUEST_CHARS (main) === MAX_CHAT_INPUT_CHARS (renderer)', () => {
    expect(MAX_CHAT_REQUEST_CHARS).toBe(EXPECTED_MAX_CHAT_INPUT_CHARS)
  })
  it('DETECT_LANG_MAX_CHARS (main) === DETECT_LANG_MAX_CHARS (renderer)', () => {
    expect(MAIN_DETECT_LANG_MAX_CHARS).toBe(EXPECTED_DETECT_LANG_MAX_CHARS)
  })
})

describe('Chunk translation parameters (HC-09 to HC-12)', () => {
  it('TRANSLATE_CHUNK_CHAR_LIMIT is 12000 chars (~3000 tokens)', () => {
    expect(TRANSLATE_CHUNK_CHAR_LIMIT).toBe(12_000)
  })

  it('TRANSLATE_CHUNK_TIMEOUT_MS is 90 seconds', () => {
    expect(TRANSLATE_CHUNK_TIMEOUT_MS).toBe(90_000)
  })

  it('TRANSLATE_CHUNK_CONCURRENCY is 5 (balances throughput vs rate limit)', () => {
    expect(TRANSLATE_CHUNK_CONCURRENCY).toBe(5)
  })

  it('TRANSLATE_CONTEXT_TAIL_CHARS is 400 chars of overlap context', () => {
    expect(TRANSLATE_CONTEXT_TAIL_CHARS).toBe(400)
  })

  it('TRANSLATE_CHUNK_CHAR_LIMIT is positive', () => {
    expect(TRANSLATE_CHUNK_CHAR_LIMIT).toBeGreaterThan(0)
  })

  it('TRANSLATE_CHUNK_TIMEOUT_MS is reasonable (between 10s and 5 min)', () => {
    expect(TRANSLATE_CHUNK_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000)
    expect(TRANSLATE_CHUNK_TIMEOUT_MS).toBeLessThanOrEqual(300_000)
  })

  it('TRANSLATE_CHUNK_CONCURRENCY is between 1 and 20', () => {
    expect(TRANSLATE_CHUNK_CONCURRENCY).toBeGreaterThanOrEqual(1)
    expect(TRANSLATE_CHUNK_CONCURRENCY).toBeLessThanOrEqual(20)
  })
})
