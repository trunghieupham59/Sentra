// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/viezan-test',
  },
}))

import { buildBookmarklet } from '../legacyAssistant'

describe('legacyAssistant bookmarklet hardening', () => {
  it('renders translated output as text and sends a tokenized CORS preflight URL', () => {
    const bookmarklet = buildBookmarklet(`sk-vie-${'a'.repeat(64)}`, 39875, 'vi')
    const script = decodeURIComponent(bookmarklet.replace(/^javascript:/, ''))

    expect(script).toContain('corsToken=')
    expect(script).toContain('createTextNode(text)')
    expect(script).toContain('textContent=msg')
    expect(script).not.toContain('innerHTML=msg')
    expect(script).not.toContain('MSG.header+d.translatedText')
  })
})
