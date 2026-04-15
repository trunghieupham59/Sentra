import { useCallback, useEffect, useState } from 'react'
import { AlertTriangleIcon, ImageIcon, SpinnerIcon, XIcon } from './ui/icons'
import { useT } from '../store/useAppStore'

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_DIMENSION = 1500
const MAX_BYTES     = 900_000
const JPEG_QUALITY  = 0.85

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ImageAttachment {
  base64: string
  mimeType: string
  width: number
  height: number
  previewDataUrl: string   // full data URL for display
  fileName: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function loadImageFromSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

async function processImageFile(file: File): Promise<ImageAttachment> {
  // Read original for preview (async in parallel with resize)
  const previewDataUrl = await readFileAsDataUrl(file)
  const img = await loadImageFromSrc(previewDataUrl)

  let { width, height } = img

  // Scale down if needed
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
    width  = Math.round(width  * ratio)
    height = Math.round(height * ratio)
  }

  const canvas = document.createElement('canvas')
  canvas.width  = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, width, height)

  const mimeType = 'image/jpeg'
  let quality = JPEG_QUALITY
  let base64  = ''

  while (quality >= 0.4) {
    const dataUrl = canvas.toDataURL(mimeType, quality)
    base64 = dataUrl.split(',')[1]
    if (base64.length * 0.75 <= MAX_BYTES) break
    quality -= 0.1
  }
  if (!base64) base64 = canvas.toDataURL(mimeType, 0.4).split(',')[1]

  return { base64, mimeType, width, height, previewDataUrl, fileName: file.name }
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ImageTranslatorProps {
  onImageReady: (attachment: ImageAttachment) => void
  onClose: () => void
}

// ─── Component ───────────────────────────────────────────────────────────────
export function ImageTranslator({ onImageReady, onClose }: ImageTranslatorProps) {
  const t = useT()
  const [isDragging,   setIsDragging  ] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMsg,     setErrorMsg    ] = useState<string | null>(null)

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload an image file (JPEG, PNG, WebP, GIF)')
      return
    }
    setIsProcessing(true)
    setErrorMsg(null)
    try {
      const attachment = await processImageFile(file)
      onImageReady(attachment)
      onClose()
    } catch (err) {
      setIsProcessing(false)
      setErrorMsg(err instanceof Error ? err.message : 'Failed to process image')
    }
  }, [onImageReady, onClose])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }, [processFile])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.image_translate_title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 w-full h-full bg-black/60 backdrop-blur-sm cursor-default"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl
                      border border-gray-200 dark:border-gray-700 overflow-hidden fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5
                        border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {t.image_translate_title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full
                       text-gray-400 hover:text-gray-600 hover:bg-gray-100
                       dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {isProcessing ? (
            /* Processing state */
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full bg-emerald-100 dark:bg-emerald-900/30 animate-ping" style={{ animationDuration: '1.5s' }} />
                <div className="relative w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-md">
                  <SpinnerIcon className="w-6 h-6 text-white animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t.image_translate_processing}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Resizing & compressing…</p>
              </div>
            </div>
          ) : (
            /* Upload zone */
            <>
              <label
                htmlFor="img-upload-input"
                className={[
                  'flex flex-col items-center justify-center rounded-xl border-2 border-dashed',
                  'cursor-pointer transition-all duration-200 select-none py-12 px-6 text-center',
                  isDragging
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300 hover:bg-gray-50 dark:hover:bg-gray-800/50',
                ].join(' ')}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors
                                ${isDragging ? 'bg-emerald-100 dark:bg-emerald-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                  <svg className={`w-7 h-7 transition-colors ${isDragging ? 'text-emerald-500' : 'text-gray-400'}`}
                       viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                  {t.image_translate_upload_hint.split('\n')[0]}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {t.image_translate_upload_hint.split('\n')[1]}
                </p>
              </label>

              <input
                id="img-upload-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFileInput}
              />

              {errorMsg && (
                <div className="mt-3 flex items-start gap-2 p-3 rounded-lg
                                bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                  <AlertTriangleIcon className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-300">{errorMsg}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
