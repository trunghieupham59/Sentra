// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  MAX_CHAT_REQUEST_CHARS,
  DETECT_LANG_MAX_CHARS as MAIN_DETECT_LANG_MAX_CHARS,
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
