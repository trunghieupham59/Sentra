/**
 * Unit tests for src/utils/imageUtils.ts
 *
 * Tests focus on extractImageFromClipboard — the shared clipboard helper
 * used by ChatPage and TranslatePage paste handlers.
 *
 * resizeImageFile is NOT tested here because it depends on the browser's
 * Canvas API which is not available in the jsdom test environment.
 */
import { describe, expect, it } from 'vitest'
import { extractImageFromClipboard } from '../imageUtils'

// ── Helper: build a minimal DataTransfer mock ─────────────────────────────────

function buildMockDataTransfer(
  items: Array<{ type: string; file?: File | null }>
): DataTransfer {
  const mockItems = items.map(item => ({
    type: item.type,
    getAsFile: () => item.file ?? null,
  }))
  return {
    items: {
      ...mockItems,
      length: mockItems.length,
      [Symbol.iterator]: mockItems[Symbol.iterator].bind(mockItems),
    },
  } as unknown as DataTransfer
}

// ─────────────────────────────────────────────────────────────────────────────
describe('extractImageFromClipboard', () => {
  it('returns the File when clipboard contains an image/png item', () => {
    const file = new File(['data'], 'screenshot.png', { type: 'image/png' })
    const dt = buildMockDataTransfer([{ type: 'image/png', file }])
    expect(extractImageFromClipboard(dt)).toBe(file)
  })

  it('returns the File for image/jpeg', () => {
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    const dt = buildMockDataTransfer([{ type: 'image/jpeg', file }])
    expect(extractImageFromClipboard(dt)).toBe(file)
  })

  it('returns the File for image/webp', () => {
    const file = new File(['data'], 'image.webp', { type: 'image/webp' })
    const dt = buildMockDataTransfer([{ type: 'image/webp', file }])
    expect(extractImageFromClipboard(dt)).toBe(file)
  })

  it('returns the first image when clipboard contains both text and image items', () => {
    const file = new File(['data'], 'image.png', { type: 'image/png' })
    const dt = buildMockDataTransfer([
      { type: 'text/plain', file: null },
      { type: 'image/png', file },
    ])
    expect(extractImageFromClipboard(dt)).toBe(file)
  })

  it('returns null when clipboard contains only text', () => {
    const dt = buildMockDataTransfer([{ type: 'text/plain', file: null }])
    expect(extractImageFromClipboard(dt)).toBeNull()
  })

  it('returns null when clipboard is empty', () => {
    const dt = buildMockDataTransfer([])
    expect(extractImageFromClipboard(dt)).toBeNull()
  })

  it('returns null when getAsFile() returns null for image item', () => {
    // Some browsers return null from getAsFile() even for image items
    const dt = buildMockDataTransfer([{ type: 'image/png', file: null }])
    expect(extractImageFromClipboard(dt)).toBeNull()
  })

  it('does not return non-image items (application/pdf)', () => {
    const dt = buildMockDataTransfer([{ type: 'application/pdf', file: null }])
    expect(extractImageFromClipboard(dt)).toBeNull()
  })

  it('extracts the first image when multiple image items are present', () => {
    const png = new File(['data'], 'first.png', { type: 'image/png' })
    const jpg = new File(['data'], 'second.jpg', { type: 'image/jpeg' })
    const dt = buildMockDataTransfer([
      { type: 'image/png', file: png },
      { type: 'image/jpeg', file: jpg },
    ])
    expect(extractImageFromClipboard(dt)).toBe(png)
  })
})
