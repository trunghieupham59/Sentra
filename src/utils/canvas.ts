/**
 * Canvas rendering utilities for image translation overlays.
 *
 * Extracted from TranslatePage.tsx — keeping them here makes them
 * independently testable and avoids a 90-line block inside a page component.
 */
import type { ImageTextRegion } from '../types'

/**
 * Split `text` into lines that fit within `maxWidth` pixels on the given canvas context.
 *
 * CJK characters (Chinese, Japanese, Korean) have no word boundaries — each character
 * is treated as its own token. All other scripts are split on whitespace.
 *
 * @param ctx    - A CanvasRenderingContext2D with `font` already set to the desired size.
 * @param text   - The text to wrap.
 * @param maxWidth - Maximum width in pixels for each line.
 * @returns An array of line strings. Always returns at least one element (the original text)
 *          if the input is non-empty.
 */
export function canvasWrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  if (!text) return []
  // CJK characters have no word boundaries — split per character
  const isCJK = /[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff]/.test(text)
  const tokens = isCJK ? [...text] : text.split(/\s+/)
  const sep = isCJK ? '' : ' '
  const lines: string[] = []
  let cur = ''
  for (const tok of tokens) {
    const candidate = cur ? cur + sep + tok : tok
    if (ctx.measureText(candidate).width <= maxWidth) {
      cur = candidate
    } else {
      if (cur) lines.push(cur)
      cur = tok // even if single token is wider, start a new line
    }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : [text]
}

/**
 * Draw translated-text overlays onto a canvas that already has the source image drawn.
 *
 * For each region:
 *  1. A fully-opaque background rectangle is painted, completely hiding the original text.
 *  2. The translated text is rendered with automatic multi-line wrapping.
 *  3. Font size starts at 50% of the region height and shrinks until all lines fit vertically.
 *
 * @param ctx     - 2D rendering context of the target canvas.
 * @param regions - Array of text regions returned by the AI image-translation endpoint.
 * @param cw      - Canvas width in pixels.
 * @param ch      - Canvas height in pixels.
 */
export function renderTranslatedRegions(
  ctx: CanvasRenderingContext2D,
  regions: ImageTextRegion[],
  cw: number,
  ch: number,
): void {
  for (const r of regions) {
    const rx = r.x * cw
    const ry = r.y * ch
    const rw = r.width * cw
    const rh = r.height * ch

    // Fully-opaque background so original text is completely hidden
    ctx.globalAlpha = 1.0
    ctx.fillStyle = r.bgColor ?? '#1a1a1a'
    ctx.fillRect(rx, ry, rw, rh)

    if (!r.translatedText) continue

    const maxTextW = rw * 0.92
    ctx.globalAlpha = 1.0
    ctx.fillStyle = r.textColor ?? '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Start with a font size proportional to region height; shrink until lines fit
    let fs = Math.max(10, rh * 0.5)
    ctx.font = `${fs}px sans-serif`
    let lines = canvasWrapText(ctx, r.translatedText, maxTextW)

    // Reduce font size until all lines fit vertically inside the region
    while (fs > 8 && lines.length * fs * 1.3 > rh * 0.92) {
      fs -= 1
      ctx.font = `${fs}px sans-serif`
      lines = canvasWrapText(ctx, r.translatedText, maxTextW)
    }

    const lineH = fs * 1.3
    const totalH = lines.length * lineH
    const startY = ry + rh / 2 - totalH / 2 + lineH / 2

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], rx + rw / 2, startY + i * lineH)
    }
  }
}
