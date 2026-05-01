import { useEffect, useState } from 'react'
import { useT } from '../../store/useAppStore'
import type { ChatMessage, ChatMessageContent } from '../../types'
import { AppLogoIcon } from '../AppLogo'
import { MarkdownText } from '../MarkdownText'
import { ClipboardIcon, CopyIcon, DownloadIcon, RefreshIcon, SpinnerIcon, UserIcon, XIcon } from '../ui/icons'

// HC-11: Named constant for loading dot animation stagger
const DOT_ANIM_DELAY_STEP_S = 0.15   // s between each loading dot's bounce start
const DOT_BOUNCE_INTERVAL_MS = 400   // ms interval for dots 1→2→3→1 cycle

/** Animated "Thinking..." label — dots cycle 1 → 2 → 3 → 1 every 400 ms */
function ThinkingLabel() {
  const [dots, setDots] = useState(1)
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d >= 3 ? 1 : d + 1)), DOT_BOUNCE_INTERVAL_MS)
    return () => clearInterval(t)
  }, [])
  const t = useT()
  return (
    <span className="text-gray-400 dark:text-gray-500 italic select-none">
      {`${t.chat_thinking_label}${'.'.repeat(dots)}`}
    </span>
  )
}

function getImageSource(content: ChatMessageContent): string | null {
  if (content.imagePreviewUrl) return content.imagePreviewUrl
  if (content.imageBase64 && content.imageMimeType) {
    return `data:${content.imageMimeType};base64,${content.imageBase64}`
  }
  return null
}

interface MessageBubbleProps {
  message: ChatMessage
  onCopy: (text: string) => void
  onCopyImage?: (content: ChatMessageContent) => void
  onDownloadImage?: (content: ChatMessageContent) => void
  onRegenerate?: () => void
  isLastAssistant?: boolean
  isSending?: boolean
  copyLabel?: string
  downloadImageLabel?: string
  regenerateLabel?: string
}

export function MessageBubble({
  message,
  onCopy,
  onCopyImage,
  onDownloadImage,
  onRegenerate,
  isLastAssistant,
  isSending,
  copyLabel,
  downloadImageLabel,
  regenerateLabel,
}: MessageBubbleProps) {
  const t = useT()
  const isUser = message.role === 'user'
  const textContent = message.content.find((c) => c.type === 'text')?.text ?? ''
  const imageContents = message.content.filter((c) => c.type === 'image')
  const downloadableImage = !isUser
    ? imageContents.find((img) => img.imagePreviewUrl || (img.imageBase64 && img.imageMimeType))
    : null

  // Collapse state for research step bubbles (starts collapsed)
  const [isStepCollapsed, setIsStepCollapsed] = useState(true)
  const [previewImage, setPreviewImage] = useState<ChatMessageContent | null>(null)
  const previewImageSrc = previewImage ? getImageSource(previewImage) : null

  useEffect(() => {
    if (!previewImage) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewImage(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewImage])

  // ── Research Step bubble (collapsible, gray) ──────────────────────────────
  if (message.isResearchStep) {
    return (
      <div className="flex gap-2 items-start pl-11">
        <div className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700
                        bg-white dark:bg-gray-900 overflow-hidden text-xs shadow-sm">
          {/* Header — always visible, click to expand/collapse */}
          <button
            type="button"
            onClick={() => !message.isLoading && setIsStepCollapsed((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2
                       text-gray-500 dark:text-gray-400
                       hover:bg-gray-50 dark:hover:bg-gray-800/50
                       transition-colors duration-150 cursor-pointer"
          >
            <span className="font-medium text-left">
              {message.isLoading ? <ThinkingLabel /> : message.researchStepLabel}
            </span>
            {message.isLoading ? (
              <SpinnerIcon className="w-3 h-3 animate-spin text-gray-400 flex-shrink-0" />
            ) : (
              <span
                className={`text-gray-400 text-base leading-none flex-shrink-0 transition-transform duration-200
                            ${isStepCollapsed ? '' : 'rotate-90'}`}
              >
                ›
              </span>
            )}
          </button>

          {/* Content — hidden when collapsed or loading */}
          {!isStepCollapsed && !message.isLoading && textContent && (
            <div className="px-3 py-2.5 border-t border-gray-100 dark:border-gray-800
                            text-gray-600 dark:text-gray-300 leading-relaxed">
              <MarkdownText text={textContent} className="text-xs" />
            </div>
          )}

          {/* Error state */}
          {message.error && (
            <div className="px-3 py-2 border-t border-red-100 dark:border-red-900/30
                            text-red-500 dark:text-red-400 text-xs">
              {message.error}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Research Final bubble (highlighted, indigo) ───────────────────────────
  if (message.isResearchFinal) {
    return (
      <div className="flex gap-3 items-start">
        {/* Avatar */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden
                        bg-white dark:bg-gray-800
                        border border-indigo-200 dark:border-indigo-700">
          <AppLogoIcon size={28} />
        </div>

        <div className="flex-1 flex flex-col gap-1.5">
          {message.isLoading ? (
            <div className="rounded-lg border-2 border-indigo-200 dark:border-indigo-700
                            bg-indigo-50/30 dark:bg-indigo-950/20 px-4 py-3">
              <div className="flex items-center gap-2">
                <SpinnerIcon className="w-4 h-4 animate-spin text-indigo-400" />
                <span className="text-xs text-indigo-500 dark:text-indigo-400">{t.chat_deep_research_summarizing}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border-2 border-indigo-200 dark:border-indigo-700
                            bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
              {/* Badge header */}
              <div className="flex items-center gap-2 px-4 py-2.5
                              border-b border-indigo-100 dark:border-indigo-900/50
                              bg-indigo-50/60 dark:bg-indigo-950/20">
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest select-none">
                  {t.chat_deep_research_badge}
                </span>
              </div>
              {/* Content */}
              <div className="px-4 py-3 select-text cursor-text">
                <MarkdownText text={textContent} />
              </div>
            </div>
          )}

          {/* Timestamp + copy */}
          {!message.isLoading && textContent && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] text-gray-400 dark:text-gray-600">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <button
                type="button"
                onClick={() => onCopy(textContent)}
                title={copyLabel ?? t.translate_copy}
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200
                           transition-colors duration-150 cursor-pointer"
              >
                <ClipboardIcon />
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Normal bubble ─────────────────────────────────────────────────────────
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden
                       ${isUser ? 'bg-blue-500' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'}`}>
        {isUser ? (
          <UserIcon className="w-4 h-4 text-white" />
        ) : (
          <AppLogoIcon size={28} />
        )}
      </div>

      <div className={`flex flex-col gap-1.5 max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Image attachments */}
        {imageContents.map((img, i) => {
          const imageSrc = getImageSource(img)
          return imageSrc && (
            <button
              type="button"
              // biome-ignore lint/suspicious/noArrayIndexKey: stable index for images
              key={i}
              onClick={() => setPreviewImage(img)}
              title={t.chat_open_image}
              className="block max-w-full rounded-xl cursor-pointer
                         focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-neutral-950"
            >
              <img
                src={imageSrc}
                alt={img.imageFileName ?? 'attachment'}
                className="max-w-full rounded-xl max-h-64 object-contain border border-gray-200 dark:border-gray-700
                           transition-shadow duration-150 hover:shadow-lg"
              />
            </button>
          )
        })}

        {/* Text / status */}
        {message.isLoading && !textContent ? (
          <div className="px-1 py-2">
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * DOT_ANIM_DELAY_STEP_S}s` }}
                />
              ))}
            </div>
          </div>
        ) : textContent ? (
          <div className={`break-words select-text cursor-text
                           ${isUser
                             ? 'rounded-lg rounded-br-sm bg-blue-500 px-4 py-3 text-white'
                             : 'px-0 py-1 text-gray-900 dark:text-gray-100'}`}>
            {isUser ? (
              <span className="text-sm leading-relaxed whitespace-pre-wrap">{textContent}</span>
            ) : (
              <MarkdownText text={textContent} />
            )}
          </div>
        ) : message.error ? (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300 select-text cursor-text">
            {message.error}
          </div>
        ) : null}

        {message.error && textContent && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {message.error}
          </div>
        )}

        {/* Timestamp + Copy + Regenerate */}
        <div className={`flex items-center gap-2 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-[10px] text-gray-400 dark:text-gray-600">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>

          {/* Copy button */}
          {textContent && !message.isLoading && (
            <button
              type="button"
              onClick={() => onCopy(textContent)}
              title={copyLabel ?? t.translate_copy}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200
                         transition-colors duration-150 cursor-pointer"
            >
              <ClipboardIcon />
            </button>
          )}

          {/* Download generated assistant image */}
          {downloadableImage && onDownloadImage && !message.isLoading && (
            <button
              type="button"
              onClick={() => onDownloadImage(downloadableImage)}
              title={downloadImageLabel}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400
                         transition-colors duration-150 cursor-pointer"
            >
              <DownloadIcon className="w-3 h-3" />
            </button>
          )}

          {/* Regenerate button — only on last assistant message */}
          {!isUser && isLastAssistant && onRegenerate && !message.isLoading && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isSending}
              title={regenerateLabel ?? t.chat_regenerate}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-500 dark:hover:text-blue-400
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
            >
              <RefreshIcon />
            </button>
          )}
        </div>
      </div>

      {previewImageSrc && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t.chat_image_preview}
        >
          <button
            type="button"
            className="absolute inset-0 cursor-pointer"
            onClick={() => setPreviewImage(null)}
            aria-label={t.chat_close_image_preview}
          />
          <div className="relative z-10 max-w-[96vw] max-h-[92vh]">
            <div
              className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-full
                         bg-neutral-950/70 p-1 text-white shadow-xl backdrop-blur
                         dark:bg-neutral-900/80"
            >
              {previewImage && onCopyImage && (
                <button
                  type="button"
                  onClick={() => onCopyImage(previewImage)}
                  title={copyLabel ?? t.chat_copy}
                  className="flex h-9 w-9 items-center justify-center rounded-full
                             text-white/80 hover:bg-white/10 hover:text-white
                             focus:outline-none focus:ring-2 focus:ring-white/70
                             transition-colors duration-150 cursor-pointer"
                >
                  <CopyIcon className="w-4 h-4" />
                </button>
              )}
              {previewImage && onDownloadImage && (
                <button
                  type="button"
                  onClick={() => onDownloadImage(previewImage)}
                  title={downloadImageLabel ?? t.chat_download_image}
                  className="flex h-9 w-9 items-center justify-center rounded-full
                             text-white/80 hover:bg-white/10 hover:text-white
                             focus:outline-none focus:ring-2 focus:ring-white/70
                             transition-colors duration-150 cursor-pointer"
                >
                  <DownloadIcon className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              title={t.chat_close_image_preview}
              className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center rounded-full
                         bg-white text-gray-600 shadow-lg hover:bg-gray-100 hover:text-gray-900
                         dark:bg-neutral-900 dark:text-gray-300 dark:hover:bg-neutral-800 dark:hover:text-white
                         transition-colors duration-150 cursor-pointer"
            >
              <XIcon className="w-4 h-4" />
            </button>
            <img
              src={previewImageSrc}
              alt={previewImage?.imageFileName ?? t.chat_image_preview}
              className="max-w-[92vw] max-h-[88vh] object-contain rounded-lg bg-white shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}
