import { useCallback, useEffect, useRef, useState } from 'react'
import { DragOverlay } from '../components/ui/DragOverlay'
import { AppLogoIcon } from '../components/AppLogo'
import { MessageBubble } from '../components/chat/MessageBubble'
import { SystemPromptDropdown } from '../components/chat/SystemPromptDropdown'
import { ModelSelector } from '../components/ModelSelector'
import { ImagePreviewThumbnail } from '../components/ui/ImagePreviewThumbnail'
import {
  ImageIcon,
  PlusIcon, SendIcon,
  SpinnerIcon, TrashIcon, XIcon,
} from '../components/ui/icons'
import { chatService } from '../services/chatService'
import { VoiceRecorder } from '../components/VoiceRecorder'
import { MAX_CHAT_INPUT_CHARS } from '../constants/providers'
import { MAX_CHAT_IMAGE_DIMENSION } from '../constants/image'
import { COPY_FEEDBACK_DURATION_MS } from '../constants/ui'
import { resizeImageFile, extractImageFromClipboard } from '../utils/imageUtils'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { useAppStore, useT } from '../store/useAppStore'
import type { ChatMessage, ChatMessageContent } from '../types'

/** Max height (px) của textarea input — giới hạn scroll khi text dài */
const CHAT_TEXTAREA_MAX_HEIGHT_PX = 160


// DUP-05: resizeImageToBase64 replaced by shared resizeImageFile from imageUtils.ts
// HC-09: MAX_CHAT_IMAGE_DIMENSION imported from constants/image.ts
// MAX_CHAT_SESSIONS is enforced in useAppStore.createChatSession — defined there as the single source of truth

/**
 * DUP-02: Convert a store ChatMessage to the IPC-format expected by chatService.send().
 * Strips UI-only fields (id, timestamp, isLoading, error, imagePreviewUrl, imageFileName)
 * that should not be sent to the main process.
 * Centralised here so handleSend and handleRegenerate share a single implementation.
 */
function toIpcMessage(msg: ChatMessage) {
  return {
    role: msg.role,
    content: msg.content.map((c) => ({
      type: c.type,
      text: c.text,
      imageBase64: c.imageBase64,
      imageMimeType: c.imageMimeType,
    })),
  }
}

// HC-11: Named animation constants for voice bars
// (dynamic inline styles are necessary for staggered animation — these names add intent)
const VOICE_BAR_HEIGHT_BASE_PX = 6     // px base height for voice bars
const VOICE_BAR_HEIGHT_STEP_PX = 4     // px added per (i % 3) pattern unit
const VOICE_BAR_DURATION_BASE_S = 0.5  // s base animation duration for voice bars
const VOICE_BAR_DURATION_STEP_S = 0.1  // s added per bar index
const VOICE_BAR_DELAY_STEP_S    = 0.05 // s between each bar's animation start

// ─── Main ChatPage ────────────────────────────────────────────────────────────
export function ChatPage() {
  const {
    selectedProvider, selectedModels, keyStatus,
    chatSessions, activeChatSessionId, chatSystemPrompt, systemPromptPresets,
    createChatSession, setActiveChatSession, addChatMessage, updateChatMessage,
    clearChatSession, setChatSystemPrompt, setActivePage, addSystemPromptPreset,
  } = useAppStore()
  const t = useT()

  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [attachedImage, setAttachedImage] = useState<{
    base64: string; mimeType: string; previewUrl: string; fileName: string
  } | null>(null)
  /** User-visible error shown in the input area when image processing fails. */
  const [attachImageError, setAttachImageError] = useState<string | null>(null)
  /** Visual feedback state when user drags a file over the chat area */
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  // Active preset = the preset whose content matches chatSystemPrompt
  const activePreset = systemPromptPresets.find((p) => p.content === chatSystemPrompt) ?? null

  // ── Voice input — shared hook (same logic as TranslatePage) ──
  const {
    isVoiceActive,
    isVoiceInterim,
    voicePrefixRef,
    handleVoiceRecordingChange,
    handleVoiceTranscript,
    resetVoicePrefix,
  } = useVoiceInput({ currentText: inputText, onTextChange: setInputText })

  const hasKey = keyStatus[selectedProvider]
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Active session
  const activeSession = chatSessions.find((s) => s.id === activeChatSessionId) ?? null

  // Auto-scroll to bottom on new messages
  const msgCount = activeSession?.messages.length ?? 0
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages count
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgCount])

  // ── Auto-resize textarea ──
  // biome-ignore lint/correctness/useExhaustiveDependencies: inputText is the trigger for resize
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, CHAT_TEXTAREA_MAX_HEIGHT_PX)}px`
  }, [inputText])

  // ── Ensure active session exists for current provider/model ──
  const ensureSession = useCallback(() => {
    if (activeChatSessionId && chatSessions.find((s) => s.id === activeChatSessionId)) {
      return activeChatSessionId
    }
    return createChatSession(selectedProvider, selectedModels[selectedProvider])
  }, [activeChatSessionId, chatSessions, createChatSession, selectedProvider, selectedModels])

  // ── Image attachment ──
  const handleImageSelect = useCallback(async (file: File) => {
    setAttachImageError(null)
    try {
      // DUP-05: use shared resizeImageFile (fixed quality, no compression loop needed for chat)
      const result = await resizeImageFile(file, MAX_CHAT_IMAGE_DIMENSION)
      setAttachedImage(result)
    } catch (err) {
      // Show error in the UI so the user knows the attachment failed
      const msg = err instanceof Error ? err.message : 'Failed to process image'
      setAttachImageError(msg)
    }
  }, [])

  const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAttachImageError(t.image_translate_type_error)
      return
    }
    handleImageSelect(file)
  }, [handleImageSelect, t])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only clear when leaving the container itself, not a child element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false)
    }
  }, [])

  // ── Send message ──
  // ── Regenerate last assistant response ──
  const handleRegenerate = useCallback(async () => {
    if (isSending || !activeChatSessionId) return
    const session = useAppStore.getState().chatSessions.find((s) => s.id === activeChatSessionId)
    if (!session) return

    // Find last assistant message
    const msgs = session.messages
    const lastAssistantIdx = [...msgs].map((m, i) => ({ m, i })).reverse().find(({ m }) => m.role === 'assistant')
    if (!lastAssistantIdx) return
    const assistantMsgId = lastAssistantIdx.m.id

    // History = all messages up to (not including) the last assistant message
    const historyMessages = msgs.slice(0, lastAssistantIdx.i).filter((m) => !m.isLoading && !m.error)

    if (historyMessages.length === 0) return

    setIsSending(true)

    // Reset assistant message to loading
    updateChatMessage(activeChatSessionId, assistantMsgId, {
      content: [{ type: 'text', text: '' }],
      isLoading: true,
      error: undefined,
      timestamp: Date.now(),
    })

    try {
      const result = await chatService.send({
        provider: selectedProvider,
        model: selectedModels[selectedProvider],
        messages: historyMessages.map(toIpcMessage),
        systemPrompt: chatSystemPrompt || undefined,
      })

      if (result.success && result.reply) {
        updateChatMessage(activeChatSessionId, assistantMsgId, {
          content: [{ type: 'text', text: result.reply }],
          isLoading: false,
        })
      } else {
        updateChatMessage(activeChatSessionId, assistantMsgId, {
          isLoading: false,
          error: result.error || 'Failed to regenerate response',
        })
      }
    } catch (err) {
      updateChatMessage(activeChatSessionId, assistantMsgId, {
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unexpected error',
      })
    } finally {
      setIsSending(false)
    }
  }, [isSending, activeChatSessionId, updateChatMessage, selectedProvider, selectedModels, chatSystemPrompt])

  const handleSend = useCallback(async () => {
    const text = inputText.trim()
    if ((!text && !attachedImage) || isSending) return
    if (!hasKey) return

    const sessionId = ensureSession()

    // Build content
    const userContent: ChatMessageContent[] = []
    if (attachedImage) {
      userContent.push({
        type: 'image',
        imageBase64: attachedImage.base64,
        imageMimeType: attachedImage.mimeType,
        imagePreviewUrl: attachedImage.previewUrl,
        imageFileName: attachedImage.fileName,
      })
    }
    if (text) {
      userContent.push({ type: 'text', text })
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: userContent,
      timestamp: Date.now(),
    }

    addChatMessage(sessionId, userMsg)
    setInputText('')
    setAttachedImage(null)
    setIsSending(true)

    // Placeholder assistant message
    const assistantMsgId = `msg-${Date.now()}-a`
    const assistantPlaceholder: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: [{ type: 'text', text: '' }],
      timestamp: Date.now(),
      isLoading: true,
    }
    addChatMessage(sessionId, assistantPlaceholder)

    try {
      // Get fresh session to build history
      const session = useAppStore.getState().chatSessions.find((s) => s.id === sessionId)
      const messages = (session?.messages ?? [])
        .filter((m) => !m.isLoading && !m.error)
        .map(toIpcMessage)

      const result = await chatService.send({
        provider: selectedProvider,
        model: selectedModels[selectedProvider],
        messages,
        systemPrompt: chatSystemPrompt || undefined,
      })

      if (result.success && result.reply) {
        updateChatMessage(sessionId, assistantMsgId, {
          content: [{ type: 'text', text: result.reply }],
          isLoading: false,
        })
      } else {
        updateChatMessage(sessionId, assistantMsgId, {
          isLoading: false,
          error: result.error || 'Failed to get response',
        })
      }
    } catch (err) {
      updateChatMessage(sessionId, assistantMsgId, {
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unexpected error',
      })
    } finally {
      setIsSending(false)
    }
  }, [inputText, attachedImage, isSending, hasKey, ensureSession, addChatMessage, updateChatMessage,
      selectedProvider, selectedModels, chatSystemPrompt])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Paste image from clipboard ──
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const file = extractImageFromClipboard(e.clipboardData)
    if (!file) return
    e.preventDefault()
    handleImageSelect(file)
  }, [handleImageSelect])

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    // Use timestamp as unique copy ID — avoids collision when 2 messages share the same opening chars
    setCopiedId(String(Date.now()))
    setTimeout(() => setCopiedId(null), COPY_FEEDBACK_DURATION_MS)  // HC-03
  }

  const handleNewChat = () => {
    const id = createChatSession(selectedProvider, selectedModels[selectedProvider])
    setActiveChatSession(id)
  }

  const handleClear = () => {
    if (activeChatSessionId) clearChatSession(activeChatSessionId)
  }

  const messages = activeSession?.messages ?? []

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop zone for image upload
    <div
      role="application"
      aria-label="Chat drop zone"
      className={`flex flex-col h-full bg-gray-50 dark:bg-gray-950 relative transition-colors duration-150
                  ${isDraggingOver ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true) }}
      onDragLeave={handleDragLeave}
      onDrop={handleFileDrop}
    >
      {/* Drop indicator overlay */}
      {isDraggingOver && (
        <DragOverlay label={t.chat_attach_image} zIndex="z-50" showRing />
      )}
      {/* ── Toolbar ── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5
                      bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="flex-1 min-w-0 overflow-hidden">
          <ModelSelector />
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* System Prompt Dropdown — state is managed inside the component */}
          <SystemPromptDropdown
            chatSystemPrompt={chatSystemPrompt}
            systemPromptPresets={systemPromptPresets}
            activePreset={activePreset}
            onSetChatSystemPrompt={setChatSystemPrompt}
            onNavigateSettings={() => setActivePage('settings')}
            onAddPreset={addSystemPromptPreset}
            t={t}
          />

          {/* New chat */}
          <button
            type="button"
            onClick={handleNewChat}
            title={t.chat_new_session}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border
                       bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200
                       dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700
                       transition-all duration-200 cursor-pointer whitespace-nowrap"
          >
            <PlusIcon />
            <span>{t.chat_new_session}</span>
          </button>

          {/* Clear */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              title={t.chat_clear}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border
                         bg-gray-100 border-gray-200 text-gray-500 hover:bg-red-50 hover:border-red-200 hover:text-red-500
                         dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-red-950 dark:hover:text-red-400
                         transition-all duration-200 cursor-pointer whitespace-nowrap"
            >
              <TrashIcon />
              <span>{t.chat_clear}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          /* Empty state — full-height centered, no siblings to cause overflow */
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 select-none px-4 py-4">
            <AppLogoIcon size={72} />
            <div>
              <h2 className="text-base font-semibold text-gray-700 dark:text-gray-200">{t.chat_empty_title}</h2>
              <p className="text-sm text-gray-400 dark:text-gray-600 mt-1 max-w-[260px]">{t.chat_empty_desc}</p>
            </div>
            {!hasKey && (
              <div className="mt-2 flex flex-col items-center gap-2">
                <p className="text-xs text-orange-500 dark:text-orange-400">{t.chat_error_no_key}</p>
                <button
                  type="button"
                  onClick={() => setActivePage('settings')}
                  className="btn-primary text-xs py-1.5 px-3"
                >
                  {t.chat_error_open_settings}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Messages list — scrollable with proper spacing */
          <div className="px-4 py-4 space-y-4">
            {/* Calculate lastAssistantIdx once — avoid O(n²) per-render .map().lastIndexOf() */}
            {(() => {
              const lastAssistantIdx = messages.reduce(
                (acc, m, i) => (m.role === 'assistant' ? i : acc), -1
              )
              return messages.map((msg, idx) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onCopy={handleCopy}
                  onRegenerate={idx === lastAssistantIdx ? handleRegenerate : undefined}
                  isLastAssistant={idx === lastAssistantIdx}
                  isSending={isSending}
                  copyLabel={t.translate_copy}
              regenerateLabel={t.chat_regenerate}
                />
              ))
            })()}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Copied toast ── */}
      {copiedId && (
        <div className="pointer-events-none fixed bottom-20 left-1/2 -translate-x-1/2
                        bg-gray-800 text-white text-xs px-3 py-1.5 rounded-full shadow-lg fade-in z-50">
          {t.chat_copied}
        </div>
      )}

      {/* ── Input area ── */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">

        {/* Image attach error — shown when resizing/loading the image fails */}
        {attachImageError && (
          <div className="px-4 pt-2 flex items-center gap-2">
            <p className="text-xs text-red-500 dark:text-red-400">{attachImageError}</p>
            <button
              type="button"
              onClick={() => setAttachImageError(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
              aria-label="Dismiss"
            >
              <XIcon className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Image preview — Gemini-style large thumbnail */}
        {/* SPLIT-DUP-01: Using shared ImagePreviewThumbnail instead of inline JSX */}
        {attachedImage && (
          <ImagePreviewThumbnail
            src={attachedImage.previewUrl}
            alt={attachedImage.fileName}
            removeTitle={t.chat_remove_image}
            onRemove={() => setAttachedImage(null)}
          />
        )}

        {/* Voice overlay */}
        {isVoiceActive && (
          <div className="flex items-center gap-3 px-4 py-2 bg-red-50 dark:bg-red-950/20 border-t border-red-100 dark:border-red-900/50">
            <div className="flex items-end gap-[3px] h-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-red-400 dark:bg-red-500 animate-bounce"
                  style={{ height: `${VOICE_BAR_HEIGHT_BASE_PX + (i % 3) * VOICE_BAR_HEIGHT_STEP_PX}px`, animationDuration: `${VOICE_BAR_DURATION_BASE_S + i * VOICE_BAR_DURATION_STEP_S}s`, animationDelay: `${i * VOICE_BAR_DELAY_STEP_S}s` }}
                />
              ))}
            </div>
            <span className={`text-xs font-medium ${isVoiceInterim ? 'text-gray-400 italic' : 'text-red-500 dark:text-red-400'}`}>
              {inputText || '…'}
            </span>
          </div>
        )}

        {/* Textarea + buttons */}
        <div className="flex items-end gap-2 px-3 py-3">
          {/* Left controls */}
          <div className="flex items-center gap-1 flex-shrink-0 pb-1">
            {/* Voice recorder */}
            <VoiceRecorder
              sourceLang="auto"
              onTranscript={handleVoiceTranscript}
              onRecordingChange={handleVoiceRecordingChange}
              titleRecord={t.chat_voice_record}
              titleStop={t.chat_voice_stop}
              labelTranscribing="…"
              labelRecording="…"
              useWhisper={keyStatus.openai}
            />

            {/* Image attach — uses ImageIcon from icons/actions instead of inline SVG */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title={t.chat_attach_image}
              className="flex items-center justify-center w-8 h-8 rounded-full
                         text-gray-400 hover:text-emerald-500 hover:bg-emerald-50
                         dark:hover:bg-emerald-950 dark:hover:text-emerald-400 transition-all duration-200 cursor-pointer"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImageSelect(file)
                e.target.value = ''
              }}
            />
          </div>

          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value)
                // User edited manually while voice is active — reset prefix so next
                // transcript chunk replaces the field content, not appends to stale prefix
                if (isVoiceActive) resetVoicePrefix()
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={t.chat_placeholder}
              rows={1}
              disabled={isSending}
              className={`w-full resize-none rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                          bg-gray-100 dark:bg-gray-800 border border-transparent
                          focus:outline-none focus:border-blue-400 dark:focus:border-blue-600
                          placeholder-gray-400 dark:placeholder-gray-600
                          text-gray-900 dark:text-gray-100
                          disabled:opacity-60 transition-colors duration-150
                          ${isVoiceInterim ? 'italic text-gray-400 dark:text-gray-500' : ''}`}
              style={{ maxHeight: `${CHAT_TEXTAREA_MAX_HEIGHT_PX}px`, overflowY: 'auto' }}
            />
          </div>

          {/* Send button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={(!inputText.trim() && !attachedImage) || isSending || !hasKey}
            title={t.chat_send}
            className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full mb-0.5
                        transition-all duration-200 cursor-pointer
                        disabled:opacity-40 disabled:cursor-not-allowed
                        ${isSending
                          ? 'bg-blue-500 text-white'
                          : 'bg-blue-500 hover:bg-blue-600 text-white shadow-sm'}`}
          >
            {isSending ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : <SendIcon />}
          </button>
        </div>

      </div>
    </div>
  )
}
