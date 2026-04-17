import { AppLogoIcon } from '../AppLogo'
import { MarkdownText } from '../MarkdownText'
import { ClipboardIcon, RefreshIcon, UserIcon } from '../ui/icons'
import type { ChatMessage } from '../../types'

// HC-11: Named constant for loading dot animation stagger
const DOT_ANIM_DELAY_STEP_S = 0.15  // s between each loading dot's bounce start

interface MessageBubbleProps {
  message: ChatMessage
  onCopy: (text: string) => void
  onRegenerate?: () => void
  isLastAssistant?: boolean
  isSending?: boolean
  regenerateLabel?: string
}

export function MessageBubble({
  message,
  onCopy,
  onRegenerate,
  isLastAssistant,
  isSending,
  regenerateLabel,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const textContent = message.content.find((c) => c.type === 'text')?.text ?? ''
  const imageContents = message.content.filter((c) => c.type === 'image')

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
              title="Copy"
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
              {regenerateLabel ?? 'Regenerate'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
