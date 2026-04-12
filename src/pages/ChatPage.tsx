import { useCallback, useEffect, useRef, useState } from 'react'
import { AppLogoIcon } from '../components/AppLogo'
import { MarkdownText } from '../components/MarkdownText'
import { ModelSelector } from '../components/ModelSelector'
import { VoiceRecorder } from '../components/VoiceRecorder'
import { useAppStore, useT } from '../store/useAppStore'
import type { ChatMessage, ChatMessageContent } from '../types'

const MAX_IMAGE_SIZE = 1200
const MAX_CHAT_SESSIONS = 20

// ─── Resize image helper ──────────────────────────────────────────────────────
async function resizeImageToBase64(
  file: File,
  maxSize: number
): Promise<{ base64: string; mimeType: string; previewUrl: string; fileName: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        if (width > height) { height = Math.round((height * maxSize) / width); width = maxSize }
        else { width = Math.round((width * maxSize) / height); height = maxSize }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      const dataUrl = canvas.toDataURL(mimeType, 0.85)
      URL.revokeObjectURL(url)
      resolve({
        base64: dataUrl.split(',')[1],
        mimeType,
        previewUrl: dataUrl,
        fileName: file.name,
      })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
    img.src = url
  })
}

// ─── Message bubble component ─────────────────────────────────────────────────
function MessageBubble({
  message,
  onCopy,
  onRegenerate,
  isLastAssistant,
  isSending,
  regenerateLabel,
}: {
  message: ChatMessage
  onCopy: (text: string) => void
  onRegenerate?: () => void
  isLastAssistant?: boolean
  isSending?: boolean
  regenerateLabel?: string
}) {
  const isUser = message.role === 'user'
  const textContent = message.content.find((c) => c.type === 'text')?.text ?? ''
  const imageContents = message.content.filter((c) => c.type === 'image')

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden
                       ${isUser ? 'bg-blue-500' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'}`}>
        {isUser ? (
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
          </svg>
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
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        ) : message.error ? (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {message.error}
          </div>
        ) : textContent ? (
          <div className={`rounded-2xl px-4 py-3 break-words
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
              {/* Clipboard check icon — easier to see */}
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
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
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {regenerateLabel ?? 'Regenerate'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main ChatPage ────────────────────────────────────────────────────────────
export function ChatPage() {
  const {
    selectedProvider, selectedModels, keyStatus,
    chatSessions, activeChatSessionId, chatSystemPrompt, systemPromptPresets,
    createChatSession, setActiveChatSession, addChatMessage, updateChatMessage,
    clearChatSession, setChatSystemPrompt, setActivePage,
  } = useAppStore()
  const t = useT()

  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [attachedImage, setAttachedImage] = useState<{
    base64: string; mimeType: string; previewUrl: string; fileName: string
  } | null>(null)
  const [showPromptDropdown, setShowPromptDropdown] = useState(false)
  const [isVoiceActive, setIsVoiceActive] = useState(false)
  const promptDropdownRef = useRef<HTMLDivElement>(null)

  // Active preset = the preset whose content matches chatSystemPrompt
  const activePreset = systemPromptPresets.find((p) => p.content === chatSystemPrompt) ?? null

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showPromptDropdown) return
    const handleOutside = (e: MouseEvent) => {
      if (promptDropdownRef.current && !promptDropdownRef.current.contains(e.target as Node)) {
        setShowPromptDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showPromptDropdown])
  const [isVoiceInterim, setIsVoiceInterim] = useState(false)
  const voicePrefixRef = useRef('')

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
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [inputText])

  // ── Ensure active session exists for current provider/model ──
  const ensureSession = useCallback(() => {
    if (activeChatSessionId && chatSessions.find((s) => s.id === activeChatSessionId)) {
      return activeChatSessionId
    }
    return createChatSession(selectedProvider, selectedModels[selectedProvider])
  }, [activeChatSessionId, chatSessions, createChatSession, selectedProvider, selectedModels])

  // ── Voice handlers ──
  const handleVoiceRecordingChange = useCallback((recording: boolean) => {
    if (recording) {
      voicePrefixRef.current = inputText ? `${inputText.trimEnd()} ` : ''
      setIsVoiceActive(true)
    } else {
      setIsVoiceActive(false)
      setIsVoiceInterim(false)
    }
  }, [inputText])

  const handleVoiceTranscript = useCallback((transcript: string, isFinal: boolean) => {
    setInputText(voicePrefixRef.current + transcript)
    setIsVoiceInterim(!isFinal)
  }, [])

  // ── Image attachment ──
  const handleImageSelect = async (file: File) => {
    try {
      const result = await resizeImageToBase64(file, MAX_IMAGE_SIZE)
      setAttachedImage(result)
    } catch (err) {
      console.error('Failed to process image:', err)
    }
  }

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) handleImageSelect(file)
  }

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
      const result = await window.api.chat({
        provider: selectedProvider,
        model: selectedModels[selectedProvider],
        messages: historyMessages.map((m) => ({
          role: m.role,
          content: m.content.map((c) => ({
            type: c.type,
            text: c.text,
            imageBase64: c.imageBase64,
            imageMimeType: c.imageMimeType,
          })),
        })),
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
        .map((m) => ({
          role: m.role,
          content: m.content.map((c) => ({
            type: c.type,
            text: c.text,
            imageBase64: c.imageBase64,
            imageMimeType: c.imageMimeType,
          })),
        }))

      const result = await window.api.chat({
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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedId(text.slice(0, 20))
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleNewChat = () => {
    const id = createChatSession(selectedProvider, selectedModels[selectedProvider])
    setActiveChatSession(id)
    // Trim old sessions
    const sessions = useAppStore.getState().chatSessions
    if (sessions.length > MAX_CHAT_SESSIONS) {
      // handled by store — no-op here
    }
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
      className="flex flex-col h-full bg-gray-50 dark:bg-gray-950"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleFileDrop}
    >
      {/* ── Toolbar ── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5
                      bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="flex-1 min-w-0 overflow-hidden">
          <ModelSelector />
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* System Prompt Dropdown */}
          <div className="relative" ref={promptDropdownRef}>
            <button
              type="button"
              onClick={() => setShowPromptDropdown((v) => !v)}
              title={t.chat_system_prompt}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border
                          transition-all duration-200 select-none cursor-pointer whitespace-nowrap
                          ${(chatSystemPrompt || activePreset)
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-400'
                            : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'}`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="max-w-[120px] truncate">
                {activePreset ? activePreset.name : chatSystemPrompt ? t.chat_system_prompt : t.chat_system_prompt}
              </span>
              {(chatSystemPrompt || activePreset) && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
              )}
              <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown panel */}
            {showPromptDropdown && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl
                              border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">

                {/* Header with label */}
                <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                  {t.settings_chat_presets}
                </p>

                {/* None option — always at top, styled like a preset */}
                <button
                  type="button"
                  onClick={() => { setChatSystemPrompt(''); setShowPromptDropdown(false) }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer
                              flex items-center gap-2
                              ${!chatSystemPrompt
                                ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">None</span>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">No system prompt</p>
                  </div>
                  {!chatSystemPrompt && (
                    <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                {/* Presets list */}
                <div className="border-t border-gray-100 dark:border-gray-700">
                  {systemPromptPresets.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-gray-400 dark:text-gray-600">
                      {t.settings_chat_presets_empty}
                    </p>
                  ) : (
                    systemPromptPresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setChatSystemPrompt(preset.content)
                          setShowPromptDropdown(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer
                                    flex items-start gap-2
                                    ${chatSystemPrompt === preset.content
                                      ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium truncate">{preset.name}</span>
                            {preset.isDefault && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 shrink-0">
                                {t.settings_chat_preset_is_default}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{preset.content}</p>
                        </div>
                        {chatSystemPrompt === preset.content && (
                          <svg className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))
                  )}
                </div>

                {/* Footer: Go to settings */}
                <div className="px-3 py-2.5 flex items-center justify-end border-t border-gray-100 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => { setShowPromptDropdown(false); setActivePage('settings') }}
                    className="text-xs text-blue-500 dark:text-blue-400 hover:underline cursor-pointer transition-colors flex items-center gap-1"
                  >
                    {t.settings_title}
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>

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
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
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
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>{t.chat_clear}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 select-none">
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
          messages.map((msg, idx) => {
            const isLastAssistant =
              msg.role === 'assistant' &&
              idx === messages.map((m) => m.role).lastIndexOf('assistant')
            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                onCopy={handleCopy}
                onRegenerate={isLastAssistant ? handleRegenerate : undefined}
                isLastAssistant={isLastAssistant}
                isSending={isSending}
                regenerateLabel={t.chat_regenerate}
              />
            )
          })
        )}
        <div ref={messagesEndRef} />
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

        {/* Image preview */}
        {attachedImage && (
          <div className="px-4 pt-3 flex items-start gap-2">
            <div className="relative group">
              <img
                src={attachedImage.previewUrl}
                alt={attachedImage.fileName}
                className="h-16 w-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
              />
              <button
                type="button"
                onClick={() => setAttachedImage(null)}
                title={t.chat_remove_image}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center
                           rounded-full bg-gray-800 hover:bg-gray-700 text-white cursor-pointer shadow"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="absolute bottom-0 inset-x-0 px-1 py-0.5 bg-black/50 text-white text-[9px] truncate rounded-b-lg">
                {attachedImage.fileName}
              </div>
            </div>
          </div>
        )}

        {/* Voice overlay */}
        {isVoiceActive && (
          <div className="flex items-center gap-3 px-4 py-2 bg-red-50 dark:bg-red-950/20 border-t border-red-100 dark:border-red-900/50">
            <div className="flex items-end gap-[3px] h-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-red-400 dark:bg-red-500 animate-bounce"
                  style={{ height: `${6 + (i % 3) * 4}px`, animationDuration: `${0.5 + i * 0.1}s`, animationDelay: `${i * 0.05}s` }}
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

            {/* Image attach */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title={t.chat_attach_image}
              className="flex items-center justify-center w-8 h-8 rounded-full
                         text-gray-400 hover:text-emerald-500 hover:bg-emerald-50
                         dark:hover:bg-emerald-950 dark:hover:text-emerald-400 transition-all duration-200 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
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
                if (isVoiceActive) voicePrefixRef.current = ''
              }}
              onKeyDown={handleKeyDown}
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
              style={{ maxHeight: '160px', overflowY: 'auto' }}
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
                          : 'bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900/50'}`}
          >
            {isSending ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            )}
          </button>
        </div>

        {/* No key warning */}
        {!hasKey && messages.length === 0 && (
          <div className="px-4 pb-2">
            <p className="text-xs text-orange-500 dark:text-orange-400 text-center">
              {t.chat_error_no_key}{' '}
              <button type="button" onClick={() => setActivePage('settings')} className="underline font-medium">
                {t.chat_error_open_settings}
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
