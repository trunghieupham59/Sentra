import { useEffect, useState } from 'react'
import type { ChatMessage } from '../../types'
import { AppLogoIcon } from '../AppLogo'
import { MarkdownText } from '../MarkdownText'
import { ClipboardIcon, RefreshIcon, SpinnerIcon, UserIcon } from '../ui/icons'

// HC-11: Named constant for loading dot animation stagger
const DOT_ANIM_DELAY_STEP_S = 0.15  // s between each loading dot's bounce start

/** Animated "Thinking..." label — dots cycle 1 → 2 → 3 → 1 every 400 ms */
function ThinkingLabel() {
  const [dots, setDots] = useState(1)
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d >= 3 ? 1 : d + 1)), 400)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="text-gray-400 dark:text-gray-500 italic select-none">
      {'Thinking' + '.'.repeat(dots)}
    </span>
  )
}

interface MessageBubbleProps {
  message: ChatMessage
  onCopy: (text: string) => void
  onRegenerate?: () => void
  isLastAssistant?: boolean
  isSending?: boolean
  copyLabel?: string
  regenerateLabel?: string
}

export function MessageBubble({
  message,
  onCopy,
  onRegenerate,
  isLastAssistant,
  isSending,
  copyLabel,
  regenerateLabel,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const textContent = message.content.find((c) => c.type === 'text')?.text ?? ''
  const imageContents = message.content.filter((c) => c.type === 'image')

  // Collapse state for research step bubbles (starts collapsed)
  const [isStepCollapsed, setIsStepCollapsed] = useState(true)

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
            <div className="rounded-2xl border-2 border-indigo-200 dark:border-indigo-700
                            bg-indigo-50/30 dark:bg-indigo-950/20 px-4 py-3">
              <div className="flex items-center gap-2">
                <SpinnerIcon className="w-4 h-4 animate-spin text-indigo-400" />
                <span className="text-xs text-indigo-500 dark:text-indigo-400">Đang tổng hợp kết quả...</span>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-indigo-200 dark:border-indigo-700
                            bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
              {/* Badge header */}
              <div className="flex items-center gap-2 px-4 py-2.5
                              border-b border-indigo-100 dark:border-indigo-900/50
                              bg-indigo-50/60 dark:bg-indigo-950/20">
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest select-none">
                  💡 Deep Research
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
                title={copyLabel ?? 'Copy'}
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
        {imageContents.map((img, i) => (
          img.imagePreviewUrl && (
            <img
              // biome-ignore lint/suspicious/noArrayIndexKey: stable index for images
              key={i}
              src={img.imagePreviewUrl}
              alt={img.imageFileName ?? 'attachment'}
              className="max-w-full rounded-xl max-h-64 object-contain border border-gray-200 dark:border-gray-700"
            />
          )
        ))}

        {/* Text / status */}
        {message.isLoading ? (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
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
        ) : message.error ? (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl px-4 py-3 text-sm text-red-700 dark:text-red-300 select-text cursor-text">
            {message.error}
          </div>
        ) : textContent ? (
          <div className={`rounded-2xl px-4 py-3 break-words select-text cursor-text
                           ${isUser
                             ? 'bg-blue-500 text-white rounded-br-md'
                             : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md'}`}>
            {isUser ? (
              <span className="text-sm leading-relaxed whitespace-pre-wrap">{textContent}</span>
            ) : (
              <MarkdownText text={textContent} />
            )}
          </div>
        ) : null}

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
              title={copyLabel ?? 'Copy'}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200
                         transition-colors duration-150 cursor-pointer"
            >
              <ClipboardIcon />
            </button>
          )}

          {/* Regenerate button — only on last assistant message */}
          {!isUser && isLastAssistant && onRegenerate && !message.isLoading && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isSending}
              title={regenerateLabel ?? 'Regenerate response'}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-500 dark:hover:text-blue-400
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
            >
              <RefreshIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
