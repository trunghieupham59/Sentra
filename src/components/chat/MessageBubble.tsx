import { memo, useEffect, useState } from 'react'

import { useAppStore, useT } from '../../store/useAppStore'
import type { ChatMessage, ChatMessageContent } from '../../types'
import { AppLogoIcon } from '../AppLogo'
import { MarkdownText } from '../MarkdownText'
import { CopyIcon, DownloadIcon, LightbulbIcon, RefreshIcon, SparklesIcon, SpinnerIcon, ThumbsDownIcon, ThumbsUpIcon, UserIcon, XIcon } from '../ui/icons'
import { UsageCostBadge } from '../ui/UsageCostBadge'

/**
 * Shared button shells for the message-action toolbar (copy / download /
 * regenerate). They sit *inside* `.chat-message-actions`, which fades the
 * whole row in only on hover or focus — the visual rule "controls reveal on
 * intent" matches modern chat UIs (ChatGPT, Claude) and keeps the conversation
 * scroll clean.
 */
const MESSAGE_ACTION_BUTTON_CLASS =
  'btn-icon btn-icon-sm border-transparent bg-transparent text-gray-400 shadow-none dark:bg-transparent dark:text-gray-500'
const MESSAGE_COPY_BUTTON_CLASS = MESSAGE_ACTION_BUTTON_CLASS
const MESSAGE_DOWNLOAD_BUTTON_CLASS = MESSAGE_ACTION_BUTTON_CLASS
const MESSAGE_REGENERATE_BUTTON_CLASS = MESSAGE_ACTION_BUTTON_CLASS

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
function BouncingDots({ size = 'md', tone = 'gray' }: {
  size?: 'sm' | 'md'
  tone?: 'gray'
} = {}) {
  const dotSize = size === 'sm' ? 'h-[4px] w-[4px]' : 'h-[5px] w-[5px]'
  const colour = { gray: 'bg-gray-400 dark:bg-gray-500' }[tone]
  return (
    <span className="inline-flex items-end gap-[3px] pb-[2px]" aria-hidden="true">
      <span className={`thinking-dot ${dotSize} rounded-full ${colour}`} style={{ animationDelay: '0ms' }} />
      <span className={`thinking-dot ${dotSize} rounded-full ${colour}`} style={{ animationDelay: '160ms' }} />
      <span className={`thinking-dot ${dotSize} rounded-full ${colour}`} style={{ animationDelay: '320ms' }} />
    </span>
  )
}

/**
 * Polished "Thinking…" pill — neutral sparkle, label, and three bouncing dots.
 * The `muted` variant is used inside the collapsed
 * research-step header where the label has to sit on a neutral surface.
 */
function ThinkingLabel({ muted = false }: { muted?: boolean } = {}) {
  const t = useT()
  const baseLabel = stripTrailingEllipsis(t.chat_thinking_label)
  if (muted) {
    return (
      <span className="thinking-inline-label">
        <BouncingDots size="sm" tone="gray" />
        <span>{baseLabel}</span>
      </span>
    )
  }
  return (
    <span
      className="thinking-state-pill"
      role="status"
      aria-live="polite"
    >
      <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
        <span className="thinking-glow absolute inset-0 rounded-full bg-gray-400/25 blur-[3px] dark:bg-gray-300/20" aria-hidden />
        <SparklesIcon className="relative h-3.5 w-3.5 text-gray-500 dark:text-gray-300" />
      </span>
      <span className="tracking-[0.01em]">{baseLabel}</span>
      <BouncingDots tone="gray" />
    </span>
  )
}

/**
 * Polished Smart Thinking pill — same shape as ThinkingLabel but with a
 * quiet neutral treatment for web-grounded work.
 */
function SmartThinkingLabel({ label }: { label: string }) {
  const baseLabel = stripTrailingEllipsis(label)
  return (
    <span
      className="thinking-state-pill thinking-state-pill-shimmer"
      title={label}
      role="status"
      aria-live="polite"
    >
      <span
        className="thinking-shimmer pointer-events-none absolute inset-0 bg-white/40 dark:bg-white/5"
        aria-hidden
      />
      <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
        <span className="thinking-glow absolute inset-0 rounded-full bg-gray-400/25 blur-[3px] dark:bg-gray-300/20" aria-hidden />
        <SparklesIcon className="relative h-3.5 w-3.5 text-gray-500 dark:text-gray-300" />
      </span>
      <span className="relative tracking-[0.01em]">{baseLabel}</span>
      <span className="relative">
        <BouncingDots tone="gray" />
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

function MessageBubbleImpl({
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
  const costCurrency = useAppStore((state) => state.costCurrency)
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
        <div className="chat-research-step flex-1">
          {/* Header — always visible, click to expand/collapse */}
          <button
            type="button"
            onClick={() => !message.isLoading && setIsStepCollapsed((v) => !v)}
            className="btn-menu-item justify-between"
          >
            <span className="flex items-center gap-2 font-medium text-left">
              {!message.isLoading && (
                <LightbulbIcon className="h-3.5 w-3.5 text-gray-500 dark:text-gray-300" />
              )}
              <span>
                {message.isLoading ? <ThinkingLabel muted /> : message.researchStepLabel}
              </span>
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
            <div className="px-3 py-2.5 border-t border-gray-200/60 dark:border-neutral-800
                            text-gray-600 dark:text-gray-300 leading-relaxed bg-white/60 dark:bg-neutral-950/30">
              <MarkdownText text={textContent} className="text-xs" />
            </div>
          )}

          {/* Error state */}
          {message.error && (
            <div className="ui-error-text ui-error-divider-top px-3 py-2 text-xs">
              {message.error}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Research Final bubble ─────────────────────────────────────────────────
  if (message.isResearchFinal) {
    return (
      <div className="group flex gap-3 items-start">
        {/* Avatar */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden
                        bg-white dark:bg-neutral-900
                        border border-gray-200 dark:border-neutral-800 shadow-sm shadow-gray-900/[0.06]">
          <AppLogoIcon size={28} />
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {message.isLoading ? (
            <div className="rounded-2xl border border-gray-200/80 bg-white px-4 py-3 shadow-sm shadow-gray-900/[0.05]
                            dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center gap-2">
                <SmartThinkingLabel label={t.chat_deep_research_summarizing} />
              </div>
            </div>
          ) : (
            <div className="chat-research-final">
              {/* Badge header */}
              <div className="chat-research-final-header">
                <SparklesIcon className="h-3.5 w-3.5 text-gray-500 dark:text-gray-300" />
                <span className="ui-kicker font-bold tracking-[0.18em] text-gray-700 dark:text-gray-200">
                  {t.chat_deep_research_badge}
                </span>
              </div>
              {/* Content */}
              <div className="px-4 py-3.5 select-text cursor-text">
                <MarkdownText text={textContent} />
              </div>
            </div>
          )}

          {/* Timestamp + copy — hover-only */}
          {!message.isLoading && textContent && (
            <div className="chat-message-actions flex items-center gap-1 px-1">
              <span className="ui-micro">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <button
                type="button"
                onClick={() => onCopy(textContent)}
                title={copyLabel ?? t.translate_copy}
                aria-label={copyLabel ?? t.translate_copy}
                className={MESSAGE_COPY_BUTTON_CLASS}
              >
                <CopyIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Normal bubble ─────────────────────────────────────────────────────────
  const showPinnedActions = !isUser && (isLastAssistant || Boolean(message.error))

  return (
    <div className={`group flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden shadow-sm
                       ${isUser
                         ? 'bg-gray-950 shadow-gray-900/15 dark:bg-gray-100'
                         : 'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-gray-900/[0.05]'}`}>
        {isUser ? (
          <UserIcon className="w-4 h-4 text-white dark:text-neutral-950" />
        ) : (
          <AppLogoIcon size={28} />
        )}
      </div>

      <div className={`flex flex-col gap-1.5 min-w-0 max-w-[78%] ${isUser ? 'items-end' : 'items-start w-full'}`}>
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
                         focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-neutral-950"
            >
              <img
                src={imageSrc}
                alt={img.imageFileName ?? 'attachment'}
                className="max-w-full rounded-xl max-h-64 object-contain border border-gray-200 dark:border-neutral-800
                           transition-shadow duration-150 hover:shadow-lg shadow-sm shadow-gray-900/[0.05]"
              />
            </button>
          )
        })}

        {/* Text / status — mirrors the Quick Chat popup phase indicator:
         *   • Smart Thinking step running → neutral pill "Smart Thinking…"
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
                           ${isUser ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
            {isUser ? (
              <span className="text-sm leading-relaxed whitespace-pre-wrap">{textContent}</span>
            ) : (
              <MarkdownText text={textContent} />
            )}
          </div>
        ) : message.error ? (
          <div className="ui-error-box select-text cursor-text shadow-sm">
            {message.error}
          </div>
        ) : null}

        {message.error && textContent && (
          <div className="ui-error-box text-xs">
            {message.error}
          </div>
        )}

        {/* Timestamp + Copy + Regenerate — hover-reveal except for the
         * always-visible last assistant / error message which gets pinned so
         * the user always sees regenerate / copy without hunting for it. */}
        <div className={`chat-message-actions ${showPinnedActions ? 'chat-message-actions-pinned' : ''} flex items-center gap-1 px-1
                         ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="ui-micro tabular-nums">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {!isUser && message.cost && (
            <UsageCostBadge cost={message.cost} currency={costCurrency} />
          )}

          {/* Copy button */}
          {textContent && !message.isLoading && (
            <button
              type="button"
              onClick={() => onCopy(textContent)}
              title={copyLabel ?? t.translate_copy}
              aria-label={copyLabel ?? t.translate_copy}
              className={MESSAGE_COPY_BUTTON_CLASS}
            >
              <CopyIcon className="w-3.5 h-3.5" />
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
              <DownloadIcon className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Thumbs up / down feedback — assistant messages only, not loading */}
          {!isUser && !message.isLoading && textContent && (
            <>
              <button
                type="button"
                title={t.chat_feedback_good}
                aria-label={t.chat_feedback_good}
                className={MESSAGE_ACTION_BUTTON_CLASS}
              >
                <ThumbsUpIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title={t.chat_feedback_bad}
                aria-label={t.chat_feedback_bad}
                className={MESSAGE_ACTION_BUTTON_CLASS}
              >
                <ThumbsDownIcon className="w-3.5 h-3.5" />
              </button>
            </>
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
              <RefreshIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {previewImageSrc && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-in"
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
                  className="btn-icon btn-icon-lg border-white/10 bg-neutral-950/70 text-white/80 shadow-none hover:bg-white/10 hover:text-white"
                >
                  <CopyIcon className="w-4 h-4" />
                </button>
              )}
              {previewImage && onDownloadImage && (
                <button
                  type="button"
                  onClick={() => onDownloadImage(previewImage)}
                  title={downloadImageLabel ?? t.chat_download_image}
                  className="btn-icon btn-icon-lg border-white/10 bg-neutral-950/70 text-white/80 shadow-none hover:bg-white/10 hover:text-white"
                >
                  <DownloadIcon className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              title={t.chat_close_image_preview}
              className="btn-icon absolute -right-3 -top-3"
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

/**
 * Custom equality so MessageBubble only re-renders when something the bubble
 * actually displays has changed. Critical during streaming: ChatPage triggers
 * a re-render for every token, but only the *target* message's `content`
 * changes — every other bubble stays stable. We compare:
 *
 *   - identity-stable scalar fields (id, role, isLoading, error, …)
 *   - the textual content (cheap reference compare on the text leaf)
 *   - the number of image content parts (rarely changes)
 *
 * Callbacks are intentionally *not* compared by identity — ChatPage passes
 * fresh closures every render, but they have no observable effect on a
 * non-target bubble. We accept the tiny risk of a stale closure firing in
 * exchange for skipping ~99% of token-time re-renders.
 */
function areMessageBubblePropsEqual(prev: MessageBubbleProps, next: MessageBubbleProps): boolean {
  if (prev.message === next.message
    && prev.isLastAssistant === next.isLastAssistant
    && prev.isSending === next.isSending
    && prev.copyLabel === next.copyLabel
    && prev.downloadImageLabel === next.downloadImageLabel
    && prev.regenerateLabel === next.regenerateLabel
  ) return true

  // Different message reference — compare the fields the bubble renders.
  const a = prev.message
  const b = next.message
  if (a.id !== b.id) return false
  if (a.role !== b.role) return false
  if (a.timestamp !== b.timestamp) return false
  if (a.isLoading !== b.isLoading) return false
  if (a.error !== b.error) return false
  if (a.isResearchStep !== b.isResearchStep) return false
  if (a.isResearchFinal !== b.isResearchFinal) return false
  if (a.isSmartThinkingStep !== b.isSmartThinkingStep) return false
  if (a.researchStepLabel !== b.researchStepLabel) return false
  if (a.cost !== b.cost) return false
  if (a.content !== b.content && a.content.length !== b.content.length) return false
  // Compare each content slot — text is the only frequently-changing leaf.
  if (a.content !== b.content) {
    for (let i = 0; i < a.content.length; i++) {
      const ca = a.content[i]
      const cb = b.content[i]
      if (ca.type !== cb.type) return false
      if (ca.text !== cb.text) return false
      if (ca.imageBase64 !== cb.imageBase64) return false
      if (ca.imagePreviewUrl !== cb.imagePreviewUrl) return false
    }
  }
  if (prev.isLastAssistant !== next.isLastAssistant) return false
  if (prev.isSending !== next.isSending) return false
  if (prev.copyLabel !== next.copyLabel) return false
  if (prev.downloadImageLabel !== next.downloadImageLabel) return false
  if (prev.regenerateLabel !== next.regenerateLabel) return false
  return true
}

/**
 * Memoised export — see `areMessageBubblePropsEqual` for the equality contract.
 * This avoids re-rendering every bubble in a long conversation each time a
 * single token streams into the active assistant message.
 */
export const MessageBubble = memo(MessageBubbleImpl, areMessageBubblePropsEqual)
