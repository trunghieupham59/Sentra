import { useCallback, useEffect, useState } from 'react'
import { AlertTriangleIcon, ImageIcon, SpinnerIcon, UploadIcon, XIcon } from '../ui/icons'
import { useT } from '../../store/useAppStore'
import { MAX_TRANSLATE_IMAGE_DIMENSION } from '../../constants/image'
import { resizeImageFile } from '../../utils/imageUtils'

// DUP-05: processImageFile replaced by shared resizeImageFile from imageUtils.ts
// HC-09: MAX_TRANSLATE_IMAGE_DIMENSION imported from constants/image.ts

// HC-11: Named constant for the ping animation duration (processing state spinner)
const PROCESSING_PING_DURATION_S = '1.5s'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ImageAttachment {
  base64: string
  mimeType: string
  width: number
  height: number
  previewDataUrl: string   // full data URL for display
  fileName: string
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
      setErrorMsg(t.image_translate_type_error)  // HC-10
      return
    }
    setIsProcessing(true)
    setErrorMsg(null)
    try {
      // DUP-05: use shared resizeImageFile with quality loop for ImageTranslator
      const result = await resizeImageFile(file, MAX_TRANSLATE_IMAGE_DIMENSION, { useQualityLoop: true })
      const attachment: ImageAttachment = {
        base64: result.base64,
        mimeType: result.mimeType,
        width: result.width,
        height: result.height,
        previewDataUrl: result.previewUrl,
        fileName: result.fileName,
      }
      onImageReady(attachment)
      onClose()
    } catch (err) {
      setIsProcessing(false)
      setErrorMsg(err instanceof Error ? err.message : 'Failed to process image')
    }
  }, [onImageReady, onClose, t])

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
                <div className="absolute inset-0 rounded-full bg-emerald-100 dark:bg-emerald-900/30 animate-ping" style={{ animationDuration: PROCESSING_PING_DURATION_S }} />
                <div className="relative w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-md">
                  <SpinnerIcon className="w-6 h-6 text-white animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t.image_translate_processing}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t.image_translate_compress_status}</p>
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
                  <UploadIcon className={`w-7 h-7 transition-colors ${isDragging ? 'text-emerald-500' : 'text-gray-400'}`} />
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
