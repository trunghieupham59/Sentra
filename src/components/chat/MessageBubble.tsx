import { useEffect, useState } from 'react'
import { useT } from '../../store/useAppStore'
import type { ChatMessage, ChatMessageContent } from '../../types'
import { AppLogoIcon } from '../AppLogo'
import { MarkdownText } from '../MarkdownText'
import { CopyIcon, DownloadIcon, RefreshIcon, SparklesIcon, SpinnerIcon, UserIcon, XIcon } from '../ui/icons'


const MESSAGE_ACTION_BUTTON_CLASS = 'flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors duration-150 cursor-pointer dark:text-gray-500'
const MESSAGE_COPY_BUTTON_CLASS = `${MESSAGE_ACTION_BUTTON_CLASS} hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300`
const MESSAGE_DOWNLOAD_BUTTON_CLASS = `${MESSAGE_ACTION_BUTTON_CLASS} hover:bg-emerald-50 hover:text-emerald-500 dark:hover:bg-emerald-950 dark:hover:text-emerald-400`
const MESSAGE_REGENERATE_BUTTON_CLASS = `${MESSAGE_ACTION_BUTTON_CLASS} hover:bg-blue-50 hover:text-blue-500 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-blue-950 dark:hover:text-blue-400`

/**
 * Strip any trailing ellipsis/dot punctuation a locale baked into its loading
 * copy. Both `chat_thinking_label` and `chat_smart_thinking_badge` are reused
 * in places that don't animate dots, so locales sometimes ship them with "…"
 * already appended ("Thinking…", "考え中…"). Without stripping, the polished
 * pill ends up with awkward double ellipses next to the bouncing dots.
 */
function stripTrailingEllipsis(label: string): string {
  return label.replace(/[…．.\s]+$/u, '')
}

/**
 * Three little bouncing dots — purely CSS-driven via .thinking-dot.
 * Each dot is staggered by 160 ms so they ripple smoothly. Replaces the old
 * cycling-string approach so the label width never reflows as the animation
 * progresses.
 */
function BouncingDots({ size = 'md', tone = 'blue' }: {
  size?: 'sm' | 'md'
  tone?: 'blue' | 'gray'
} = {}) {
  const dotSize = size === 'sm' ? 'h-[4px] w-[4px]' : 'h-[5px] w-[5px]'
  const colour = tone === 'gray'
    ? 'bg-gray-400 dark:bg-gray-500'
    : 'bg-blue-500 dark:bg-blue-400'
  return (
    <span className="inline-flex items-end gap-[3px] pb-[2px]" aria-hidden="true">
      <span className={`thinking-dot ${dotSize} rounded-full ${colour}`} style={{ animationDelay: '0ms' }} />
      <span className={`thinking-dot ${dotSize} rounded-full ${colour}`} style={{ animationDelay: '160ms' }} />
      <span className={`thinking-dot ${dotSize} rounded-full ${colour}`} style={{ animationDelay: '320ms' }} />
    </span>
  )
}

/**
 * Polished "Thinking…" pill — soft blue gradient with a sparkle icon, label,
 * and three bouncing dots. The `muted` variant is used inside the collapsed
 * research-step header where the label has to sit on a neutral surface.
 */
function ThinkingLabel({ muted = false }: { muted?: boolean } = {}) {
  const t = useT()
  const baseLabel = stripTrailingEllipsis(t.chat_thinking_label)
  if (muted) {
    return (
      <span className="inline-flex items-center gap-2 text-[12px] font-medium text-gray-500 dark:text-gray-400 select-none">
        <BouncingDots size="sm" tone="gray" />
        <span>{baseLabel}</span>
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-blue-100/80 bg-gradient-to-r from-blue-50 via-sky-50 to-blue-50
                 px-3 py-1 text-[12.5px] font-semibold text-blue-700 shadow-sm shadow-blue-900/[0.04] select-none
                 dark:border-blue-800/40 dark:from-blue-950/40 dark:via-sky-950/30 dark:to-blue-950/40 dark:text-blue-200
                 dark:shadow-black/30"
      role="status"
      aria-live="polite"
    >
      <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
        <span className="thinking-glow absolute inset-0 rounded-full bg-blue-400/30 blur-[3px] dark:bg-blue-300/30" aria-hidden />
        <SparklesIcon className="relative h-3.5 w-3.5 text-blue-500 dark:text-blue-300" />
      </span>
      <span className="tracking-[0.01em]">{baseLabel}</span>
      <BouncingDots tone="blue" />
    </span>
  )
}

/**
 * Polished Smart Thinking pill — same shape as ThinkingLabel but with an
 * indigo→sky gradient and a slow shimmer wash to signal the AI is browsing
 * the web on the user's behalf.
 */
function SmartThinkingLabel({ label }: { label: string }) {
  const baseLabel = stripTrailingEllipsis(label)
  return (
    <span
      className="relative inline-flex items-center gap-2 overflow-hidden rounded-full
                 border border-indigo-200/70 bg-gradient-to-r from-indigo-50 via-sky-50 to-violet-50
                 px-3 py-1 text-[12.5px] font-semibold text-indigo-700 shadow-sm shadow-indigo-900/[0.05] select-none
                 dark:border-indigo-800/40 dark:from-indigo-950/40 dark:via-sky-950/30 dark:to-violet-950/40
                 dark:text-indigo-200 dark:shadow-black/30"
      title={label}
      role="status"
      aria-live="polite"
    >
      <span
        className="thinking-shimmer pointer-events-none absolute inset-0 bg-gradient-to-r
                   from-transparent via-white/55 to-transparent dark:via-white/10"
        aria-hidden
      />
      <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
        <span className="thinking-glow absolute inset-0 rounded-full bg-indigo-400/35 blur-[3px] dark:bg-indigo-300/30" aria-hidden />
        <SparklesIcon className="relative h-3.5 w-3.5 text-indigo-500 dark:text-indigo-300" />
      </span>
      <span className="relative tracking-[0.01em]">{baseLabel}</span>
      <span className="relative">
        <BouncingDots tone="blue" />
      </span>
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
              {message.isLoading ? <ThinkingLabel muted /> : message.researchStepLabel}
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
            <div className="flex items-center gap-1 px-1">
              <span className="text-[10px] text-gray-400 dark:text-gray-600">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <button
                type="button"
                onClick={() => onCopy(textContent)}
                title={copyLabel ?? t.translate_copy}
                aria-label={copyLabel ?? t.translate_copy}
                className={MESSAGE_COPY_BUTTON_CLASS}
              >
                <CopyIcon className="w-4 h-4" />
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

        {/* Text / status — mirrors the Quick Chat popup phase indicator:
         *   • Smart Thinking step running → blue pill "Smart Thinking…"
         *   • otherwise                   → "Thinking…" label with spinner + cycling dots
         * Both states have a blinking/animated indicator so the user clearly
         * sees the AI is working. */}
        {message.isLoading && !textContent ? (
          <div className="px-1 py-2">
            {message.isSmartThinkingStep ? (
              <SmartThinkingLabel
                label={message.researchStepLabel ?? t.chat_smart_thinking_badge}
              />
            ) : (
              <ThinkingLabel />
            )}
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
        <div className={`flex items-center gap-1 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-[10px] text-gray-400 dark:text-gray-600">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>

          {/* Copy button */}
          {textContent && !message.isLoading && (
            <button
              type="button"
              onClick={() => onCopy(textContent)}
              title={copyLabel ?? t.translate_copy}
              aria-label={copyLabel ?? t.translate_copy}
              className={MESSAGE_COPY_BUTTON_CLASS}
            >
              <CopyIcon className="w-4 h-4" />
            </button>
          )}

          {/* Download generated assistant image */}
          {downloadableImage && onDownloadImage && !message.isLoading && (
            <button
              type="button"
              onClick={() => onDownloadImage(downloadableImage)}
              title={downloadImageLabel}
              aria-label={downloadImageLabel ?? t.chat_download_image}
              className={MESSAGE_DOWNLOAD_BUTTON_CLASS}
            >
              <DownloadIcon className="w-4 h-4" />
            </button>
          )}

          {/* Regenerate button — only on last assistant message */}
          {!isUser && isLastAssistant && onRegenerate && !message.isLoading && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isSending}
              title={regenerateLabel ?? t.chat_regenerate}
              aria-label={regenerateLabel ?? t.chat_regenerate}
              className={MESSAGE_REGENERATE_BUTTON_CLASS}
            >
              <RefreshIcon className="w-4 h-4" />
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
