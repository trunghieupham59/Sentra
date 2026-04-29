/**
 * AIChatPopup — floating quick-ask popup triggered by the AI Chat hotkey.
 *
 * Features:
 *  - Opens via global hotkey (configured in Settings → Hotkeys)
 *  - Auto-focuses the textarea when opened
 *  - Sends the question to the active AI provider/model
 *  - Displays the AI response inline with Markdown rendering
 *  - "Open in Chat" button navigates to the full ChatPage with the conversation
 *  - Closes on Escape or click outside the popup card
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { chatService } from '../services/chatService'
import { useAppStore, useT } from '../store/useAppStore'
import { MarkdownText } from './MarkdownText'
import { BotIcon, SendIcon, SpinnerIcon, XIcon } from './ui/icons'

/** Max height for the textarea before it scrolls */
const POPUP_TEXTAREA_MAX_HEIGHT_PX = 120
/** Max height for the response area before it scrolls */
const POPUP_RESPONSE_MAX_HEIGHT_PX = 360

interface Props {
  open: boolean
  onClose: () => void
}

export function AIChatPopup({ open, onClose }: Props) {
  const { selectedProvider, selectedModels, keyStatus, setActivePage, addChatMessage, createChatSession, setActiveChatSession } = useAppStore()
  const t = useT()

  const [question, setQuestion] = useState('')
  const [response, setResponse] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cardRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const hasKey = keyStatus[selectedProvider]

  // Auto-focus textarea when popup opens; reset state
  useEffect(() => {
    if (open) {
      setQuestion('')
      setResponse(null)
      setError(null)
      setIsSending(false)
      // Slight delay so the DOM is fully rendered before focusing
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [open])

  // Auto-resize textarea
  // biome-ignore lint/correctness/useExhaustiveDependencies: question is the trigger
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, POPUP_TEXTAREA_MAX_HEIGHT_PX)}px`
  }, [question])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  const handleSend = useCallback(async () => {
    const text = question.trim()
    if (!text || isSending || !hasKey) return

    setIsSending(true)
    setError(null)
    setResponse(null)

    try {
      const result = await chatService.send({
        provider: selectedProvider,
        model: selectedModels[selectedProvider],
        messages: [{ role: 'user', content: [{ type: 'text', text }] }],
      })

      if (result.success && result.reply) {
        setResponse(result.reply)
      } else {
        setError(result.error ?? t.chat_error_failed_response)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.chat_error_unexpected)
    } finally {
      setIsSending(false)
    }
  }, [question, isSending, hasKey, selectedProvider, selectedModels, t])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  /** Open the full Chat page, pre-seeded with the current conversation */
  const handleOpenInChat = useCallback(() => {
    const text = question.trim()
    if (!text) {
      setActivePage('chat')
      onClose()
      return
    }

    // Create a new chat session and populate it with the Q&A
    const sessionId = createChatSession(selectedProvider, selectedModels[selectedProvider])
    setActiveChatSession(sessionId)

    addChatMessage(sessionId, {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: [{ type: 'text', text }],
      timestamp: Date.now(),
    })

    if (response) {
      addChatMessage(sessionId, {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: [{ type: 'text', text: response }],
        timestamp: Date.now(),
      })
    }

    setActivePage('chat')
    onClose()
  }, [question, response, selectedProvider, selectedModels, createChatSession, setActiveChatSession, addChatMessage, setActivePage, onClose])

  if (!open) return null

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/30 backdrop-blur-[2px]">
      {/* Popup card */}
      <div
        ref={cardRef}
        className="modal-surface w-full max-w-lg flex flex-col overflow-hidden
                   animate-[fadeSlideIn_0.15s_ease-out]"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <BotIcon className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {t.ai_chat_popup_title}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-600">
              {selectedModels[selectedProvider]}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                       hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            aria-label={t.settings_close}
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* ── Input area ── */}
        <div className="px-4 py-3 flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.ai_chat_popup_placeholder}
            rows={1}
            disabled={isSending}
            className={`flex-1 resize-none rounded-lg px-3 py-2 text-sm leading-relaxed
                        bg-gray-100 dark:bg-gray-800 border border-transparent
                        focus:outline-none focus:border-blue-400 dark:focus:border-blue-600
                        placeholder-gray-400 dark:placeholder-gray-600
                        text-gray-900 dark:text-gray-100
                        disabled:opacity-60 transition-colors duration-150`}
            style={{ maxHeight: `${POPUP_TEXTAREA_MAX_HEIGHT_PX}px`, overflowY: 'auto' }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!question.trim() || isSending || !hasKey}
            title={t.chat_send}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full
                       bg-blue-500 hover:bg-blue-600 text-white shadow-sm
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all duration-200 cursor-pointer"
          >
            {isSending
              ? <SpinnerIcon className="w-4 h-4 animate-spin" />
              : <SendIcon />}
          </button>
        </div>

        {/* ── No API key warning ── */}
        {!hasKey && (
          <div className="px-4 pb-3">
            <p className="text-xs text-orange-500 dark:text-orange-400">{t.chat_error_no_key}</p>
          </div>
        )}

        {/* ── Response area ── */}
        {(response || error) && (
          <div className="border-t border-gray-100 dark:border-gray-800">
            <div
              className="px-4 py-3 overflow-y-auto"
              style={{ maxHeight: `${POPUP_RESPONSE_MAX_HEIGHT_PX}px` }}
            >
              {error ? (
                <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
              ) : response ? (
                <MarkdownText
                  text={response}
                  className="text-gray-800 dark:text-gray-200 text-sm"
                />
              ) : null}
            </div>

            {/* ── Open in Chat footer ── */}
            {response && (
              <div className="px-4 pb-3 flex justify-end border-t border-gray-100 dark:border-gray-800 pt-2">
                <button
                  type="button"
                  onClick={handleOpenInChat}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                             bg-blue-50 dark:bg-blue-950/40
                             text-blue-600 dark:text-blue-400
                             border border-blue-200 dark:border-blue-700
                             hover:bg-blue-100 dark:hover:bg-blue-900/40
                             transition-all duration-150 cursor-pointer"
                >
                  {t.ai_chat_popup_open_in_chat}
                  <span className="text-base leading-none">↗</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
