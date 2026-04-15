/**
 * Image processing utilities shared across ImageTranslator and ChatPage.
 *
 * DUP-05: Consolidates the duplicate canvas-resize + base64 conversion logic
 * that previously existed in two separate files with different variable names
 * and slightly different behavior.
 */
import { IMAGE_JPEG_QUALITY, MAX_IMAGE_BYTES } from '../constants/image'

export interface ResizedImage {
  base64: string
  mimeType: string
  /** Full data URL (base64-encoded) — safe to use as <img src> */
  previewUrl: string
  width: number
  height: number
  fileName: string
}

/**
 * Load an HTMLImageElement from a src string (data URL or object URL).
 * @internal
 */
function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

/**
 * Scale width/height down proportionally to fit within maxDimension.
 * Returns original dimensions unchanged if already within limit.
 * @internal
 */
function scaleDimensions(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) return { width, height }
  const ratio = Math.min(maxDimension / width, maxDimension / height)
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  }
}

/**
 * Resize an image File to fit within `maxDimension` and convert to base64.
 *
 * Supports two compression strategies:
 *
 * - **Fixed quality** (default, used by ChatPage):
 *   Encodes once at `options.quality`. Fast, predictable size.
 *
 * - **Quality loop** (`options.useQualityLoop: true`, used by ImageTranslator):
 *   Reduces JPEG quality in steps of 0.1 until the compressed size fits within
 *   `options.maxBytes`. Ensures the payload stays within API size limits even
 *   for very large/complex images.
 *
 * @param file - Image file to process
 * @param maxDimension - Maximum allowed width or height in pixels
 * @param options.useQualityLoop - Reduce quality until compressed ≤ maxBytes (default: false)
 * @param options.maxBytes - Byte ceiling for quality-loop mode (default: MAX_IMAGE_BYTES)
 * @param options.quality - Starting JPEG quality 0.0–1.0 (default: IMAGE_JPEG_QUALITY)
 */
export async function resizeImageFile(
  file: File,
  maxDimension: number,
  options: {
    useQualityLoop?: boolean
    maxBytes?: number
    quality?: number
  } = {}
): Promise<ResizedImage> {
  const {
    useQualityLoop = false,
    maxBytes = MAX_IMAGE_BYTES,
    quality: startQuality = IMAGE_JPEG_QUALITY,
  } = options

  // Read as data URL — serves as both the preview and the source for the canvas
  const previewUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })

  const img = await loadImageElement(previewUrl)
  const { width, height } = scaleDimensions(img.width, img.height, maxDimension)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  // Non-null assertion: getContext('2d') always succeeds on a freshly created canvas
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, width, height)

  // PNG stays PNG (lossless), everything else becomes JPEG
  const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'

  let base64: string

  if (useQualityLoop) {
    // Quality loop — keep reducing quality until payload fits within maxBytes
    let quality = startQuality
    base64 = ''
    while (quality >= 0.4) {
      const dataUrl = canvas.toDataURL(mimeType, quality)
      base64 = dataUrl.split(',')[1]
      // base64 length × 0.75 ≈ actual byte size
      if (base64.length * 0.75 <= maxBytes) break
      quality -= 0.1
    }
    // Final safety net: encode at minimum quality if still unset
    if (!base64) base64 = canvas.toDataURL(mimeType, 0.4).split(',')[1]
  } else {
    // Fixed quality — single encode pass
    const dataUrl = canvas.toDataURL(mimeType, startQuality)
    base64 = dataUrl.split(',')[1]
  }

  return { base64, mimeType, previewUrl, width, height, fileName: file.name }
}
