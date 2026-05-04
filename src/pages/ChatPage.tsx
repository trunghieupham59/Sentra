import { useCallback, useEffect, useRef, useState } from 'react'
import { AppLogoIcon } from '../components/AppLogo'
import { MessageBubble } from '../components/chat/MessageBubble'
import { SystemPromptDropdown } from '../components/chat/SystemPromptDropdown'
import { ModelSelector } from '../components/ModelSelector'
import { DragOverlay } from '../components/ui/DragOverlay'
import { ImagePreviewThumbnail } from '../components/ui/ImagePreviewThumbnail'
import {
  GearIcon,
  ImageIcon,
  LightbulbIcon,
  PlusIcon, SendIcon,
  SpinnerIcon, StopSquareIcon, TrashIcon, XIcon,
} from '../components/ui/icons'
import { VoiceRecorder } from '../components/VoiceRecorder'
import { MAX_CHAT_IMAGE_DIMENSION } from '../constants/image'
import { COPY_FEEDBACK_DURATION_MS } from '../constants/ui'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { chatService } from '../services/chatService'
import { deepResearchService } from '../services/deepResearchService'
import { smartThinkingService } from '../services/smartThinkingService'
import { useAppStore, useT } from '../store/useAppStore'
import type { ChatMessage, ChatMessageContent } from '../types'
import { localizeChatError, localizeChatException } from '../utils/chatErrors'
import { createClientId } from '../utils/id'
import { extractImageFromClipboard, resizeImageFile } from '../utils/imageUtils'
import { eventMatchesShortcut, formatShortcutLabel, shouldSendChatMessage } from '../utils/keyboardShortcuts'
import { estimateUsageCost } from '../utils/usageCost'

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
  const content = msg.content
    .filter((c) => msg.role === 'user' || c.type === 'text')
    .map((c) => ({
      type: c.type,
      text: c.text,
      imageBase64: c.imageBase64,
      imageMimeType: c.imageMimeType,
    }))

  return {
    role: msg.role,
    content,
  }
}

function toIpcHistory(messages: ChatMessage[]) {
  return messages
    .filter((m) => !m.isLoading && !m.error && !m.isResearchStep && !m.isSmartThinkingStep)
    .map(toIpcMessage)
}

function flattenChatCostInput(messages: ReturnType<typeof toIpcHistory>, systemPrompt?: string): string {
  const messageText = messages
    .flatMap((message) => message.content.map((content) => content.text ?? (content.type === 'image' ? '[image]' : '')))
    .filter(Boolean)
    .join('\n')
  return [systemPrompt, messageText].filter(Boolean).join('\n')
}

const IMAGE_EDIT_INTENT_PATTERN = new RegExp([
  '\\b(edit|change|modify|retouch|remove|replace|add|turn|make|convert|transform|erase|fill|extend|upscale|enhance|recolor)\\b',
  '(sửa|chỉnh|đổi|thay|xóa|xoá|bỏ|thêm|chuyển|biến|làm|tạo|ghép)',
  '(編集|変更|修正|削除|追加)',
].join('|'), 'i')

function shouldRouteToImageEdit(text: string, hasImage: boolean): boolean {
  return hasImage && IMAGE_EDIT_INTENT_PATTERN.test(text)
}

function buildImageDataUrl(imageBase64: string, imageMimeType: string): string {
  return `data:${imageMimeType};base64,${imageBase64}`
}

function getChatImageUrl(content: ChatMessageContent): string | null {
  return content.imagePreviewUrl ??
    (content.imageBase64 && content.imageMimeType
      ? buildImageDataUrl(content.imageBase64, content.imageMimeType)
      : null)
}

function imageExtensionFromMime(mimeType?: string): string {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType?.startsWith('image/')) return mimeType.replace('image/', '')
  return 'png'
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image for clipboard'))
    img.src = src
  })
}

async function imageUrlToPngBlob(imageUrl: string): Promise<Blob> {
  const img = await loadImageElement(imageUrl)
  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height
  if (!width || !height) throw new Error('Invalid image dimensions')

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable')
  ctx.drawImage(img, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Failed to encode image for clipboard'))
      }
    }, 'image/png')
  })
}

async function copyImageToClipboard(imageUrl: string): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    await navigator.clipboard?.writeText?.(imageUrl)
    return
  }

  const blob = await imageUrlToPngBlob(imageUrl)
  await navigator.clipboard.write([
    new ClipboardItem({ [blob.type]: blob }),
  ])
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
    chatSendShortcut, chatNewSessionShortcut,
    chatSessions, activeChatSessionId, chatSystemPrompt, systemPromptPresets,
    createChatSession, setActiveChatSession, addChatMessage, updateChatMessage,
    addChatSessionCost, clearChatSession, setChatSystemPrompt, addSystemPromptPreset, openSettings,
    recordUsageCost,
  } = useAppStore()
  const t = useT()

  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  /**
   * AbortController for the in-flight chat request. Held in a ref (not state)
   * because handlers shouldn't re-render when it's swapped, and because
   * `handleStop` needs the latest controller without going through React's
   * batched state queue. Reset to `null` once the request settles.
   */
  const abortControllerRef = useRef<AbortController | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [attachedImage, setAttachedImage] = useState<{
    base64: string; mimeType: string; previewUrl: string; fileName: string
  } | null>(null)
  /** User-visible error shown in the input area when image processing fails. */
  const [attachImageError, setAttachImageError] = useState<string | null>(null)
  /** Visual feedback state when user drags a file over the chat area */
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  /** Controls visibility of the AI config popup */
  const [showAIConfig, setShowAIConfig] = useState(false)
  /** Whether Deep Research multi-step pipeline is active */
  const [deepResearchMode, setDeepResearchMode] = useState(false)
  // Active preset = the preset whose content matches chatSystemPrompt
  const activePreset = systemPromptPresets.find((p) => p.content === chatSystemPrompt) ?? null
  const platform = window.api?.platform
  const newChatShortcutLabel = formatShortcutLabel(chatNewSessionShortcut, platform)

  // ── Voice input — shared hook (same logic as TranslatePage) ──
  const {
    isVoiceActive,
    isVoiceInterim,
    voicePrefixRef: _voicePrefixRef,
    handleVoiceRecordingChange,
    handleVoiceTranscript,
    resetVoicePrefix,
  } = useVoiceInput({ currentText: inputText, onTextChange: setInputText })

  const hasKey = selectedProvider === 'local' || keyStatus[selectedProvider]
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  /** Ref for AI config popup — used for click-outside detection */
  const aiConfigRef = useRef<HTMLDivElement>(null)

  // Active session
  const activeSession = chatSessions.find((s) => s.id === activeChatSessionId) ?? null

  const recordChatCost = useCallback((sessionId: string, messageId: string, inputText: string, reply: string) => {
    const cost = estimateUsageCost({
      feature: 'chat',
      provider: selectedProvider,
      model: selectedModels[selectedProvider],
      inputText,
      outputText: reply,
    })
    recordUsageCost(cost)
    addChatSessionCost(sessionId, cost)
    updateChatMessage(sessionId, messageId, { cost })
  }, [addChatSessionCost, recordUsageCost, selectedProvider, selectedModels, updateChatMessage])

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

  // ── Close AI config popup on outside click ──
  useEffect(() => {
    if (!showAIConfig) return
    const handleOutside = (e: MouseEvent) => {
      if (aiConfigRef.current && !aiConfigRef.current.contains(e.target as Node)) {
        setShowAIConfig(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showAIConfig])

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
      const msg = err instanceof Error ? err.message : t.image_translate_error_failed
      setAttachImageError(msg)
    }
  }, [t.image_translate_error_failed])

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
    const historyMessages = msgs
      .slice(0, lastAssistantIdx.i)
      .filter((m) => !m.isLoading && !m.error && !m.isResearchStep)

    if (historyMessages.length === 0) return

    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsSending(true)

    // Reset assistant message to loading
    updateChatMessage(activeChatSessionId, assistantMsgId, {
      content: [{ type: 'text', text: '' }],
      isLoading: true,
      error: undefined,
      timestamp: Date.now(),
    })

    try {
      let streamedText = ''
      const result = await chatService.stream(
        {
          provider: selectedProvider,
          model: selectedModels[selectedProvider],
          messages: historyMessages.map(toIpcMessage),
          systemPrompt: chatSystemPrompt || undefined,
        },
        {
          onToken: (token) => {
            streamedText += token
            updateChatMessage(activeChatSessionId, assistantMsgId, {
              content: [{ type: 'text', text: streamedText }],
              isLoading: true,
              error: undefined,
            })
          },
          signal: controller.signal,
        },
      )

      // User cancelled mid-stream — keep partial tokens, no error banner.
      if (result.errorCode === 'CANCELLED' || controller.signal.aborted) {
        updateChatMessage(activeChatSessionId, assistantMsgId, {
          content: [{ type: 'text', text: streamedText }],
          isLoading: false,
        })
      } else if (result.success && result.reply) {
        updateChatMessage(activeChatSessionId, assistantMsgId, {
          content: [{ type: 'text', text: result.reply }],
          isLoading: false,
        })
        recordChatCost(
          activeChatSessionId,
          assistantMsgId,
          flattenChatCostInput(historyMessages.map(toIpcMessage), chatSystemPrompt || undefined),
          result.reply,
        )
      } else {
        updateChatMessage(activeChatSessionId, assistantMsgId, {
          isLoading: false,
          error: localizeChatError(t, result, t.chat_error_failed_regenerate),
        })
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // Cancellation thrown as exception — finalise without error banner.
        updateChatMessage(activeChatSessionId, assistantMsgId, {
          isLoading: false,
        })
      } else {
        updateChatMessage(activeChatSessionId, assistantMsgId, {
          isLoading: false,
          error: localizeChatException(t, err, t.chat_error_unexpected),
        })
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
      setIsSending(false)
    }
  }, [
    isSending,
    activeChatSessionId,
    updateChatMessage,
    selectedProvider,
    selectedModels,
    chatSystemPrompt,
    recordChatCost,
    t,
  ])

  const handleSend = useCallback(async () => {
    const text = inputText.trim()
    if ((!text && !attachedImage) || isSending) return
    if (!hasKey) return

    const sessionId = ensureSession()

    // ── Build the user message (shared by normal, vision, and Deep Research paths)
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

    // ── Deep Research path ────────────────────────────────────────────────────
    if (deepResearchMode && (text || attachedImage)) {
      addChatMessage(sessionId, userMsg)
      setInputText('')
      setAttachedImage(null)
      const drController = new AbortController()
      abortControllerRef.current = drController
      setIsSending(true)

      try {
        await deepResearchService.run({
          signal: drController.signal,
          provider: selectedProvider,
          model: selectedModels[selectedProvider],
          question: text || 'Research the attached image in depth.',
          images: attachedImage
            ? [{
                imageBase64: attachedImage.base64,
                imageMimeType: attachedImage.mimeType,
              }]
            : undefined,
          uiText: {
            stepAnalyze: t.chat_deep_research_step_analyze,
            stepRound1: t.chat_deep_research_step_round1,
            stepGap: t.chat_deep_research_step_gap,
            stepDeep: t.chat_deep_research_step_deep,
            stepCross: t.chat_deep_research_step_cross,
            stepSynth: t.chat_deep_research_step_synth,
            modeRealtime: t.chat_deep_research_mode_realtime,
            modeAiOnly: t.chat_deep_research_mode_ai_only,
            willStudy: t.chat_deep_research_will_study,
            imageContext: t.chat_deep_research_image_context,
            imageTerms: t.chat_deep_research_image_terms,
            imageKbLabel: t.chat_deep_research_image_kb_label,
            complete: t.chat_deep_research_complete,
            gapsFound: t.chat_deep_research_gaps_found,
            deeperLabel: t.chat_deep_research_deeper_label,
            cannotAnalyze: t.chat_deep_research_cannot_analyze,
            cannotResearch: t.chat_deep_research_cannot_research,
            crossFailed: t.chat_deep_research_cross_failed,
            crossFailedInline: t.chat_deep_research_cross_failed_inline,
            synthFailed: t.chat_deep_research_synth_failed,
            errorInline: t.chat_deep_research_error_inline,
            errorAnalyze: t.chat_deep_research_error_analyze,
            errorGeneric: t.chat_deep_research_error_generic,
            errorEval: t.chat_deep_research_error_eval,
            errorCross: t.chat_deep_research_error_cross,
            errorSynth: t.chat_deep_research_error_synth,
            errorUnknown: t.chat_deep_research_error_unknown,
            webSummary: t.chat_deep_research_web_summary,
          },
          callbacks: {
            onStepStart: (label) => {
              const msgId = createClientId('msg-dr')
              addChatMessage(sessionId, {
                id: msgId,
                role: 'assistant',
                content: [{ type: 'text', text: '' }],
                timestamp: Date.now(),
                isLoading: true,
                isResearchStep: true,
                researchStepLabel: label,
              })
              return msgId
            },
            onStepComplete: (msgId, content, isFinal) => {
              updateChatMessage(sessionId, msgId, {
                content: [{ type: 'text', text: content }],
                isLoading: false,
                isResearchStep: !isFinal,
                isResearchFinal: isFinal,
                ...(isFinal ? { researchStepLabel: undefined } : {}),
              })
              if (isFinal) {
                recordChatCost(sessionId, msgId, text || 'Research the attached image in depth.', content)
              }
            },
            onStepError: (msgId, error) => {
              updateChatMessage(sessionId, msgId, {
                isLoading: false,
                error: localizeChatException(t, error, t.chat_error_failed_response),
                isResearchStep: true,
              })
            },
          },
        })
      } catch {
        // Catastrophic error — individual step errors handled by onStepError.
        // Cancellation throws too, but is just used to halt the pipeline.
      } finally {
        if (abortControllerRef.current === drController) {
          abortControllerRef.current = null
        }
        setIsSending(false)
      }
      return
    }

    addChatMessage(sessionId, userMsg)
    setInputText('')
    setAttachedImage(null)
    const sendController = new AbortController()
    abortControllerRef.current = sendController
    setIsSending(true)

    // Build IPC-format conversation history (includes the user message just added).
    const ipcHistory = toIpcHistory(
      useAppStore.getState().chatSessions.find((s) => s.id === sessionId)?.messages ?? []
    )

    // ── Smart Thinking path (DEFAULT for text-only chat) ─────────────────────
    // AI itself classifies the question and decides whether to web-search.
    // Skipped only when:
    //   • The user attached an image (vision flow uses straight chatService.stream)
    //   • There is no text (image-only message)
    if (text && !attachedImage) {
      // Single morphing placeholder bubble shared across all Smart Thinking phases:
      //   1. Initial "Thinking…" — while AI classifier decides whether to web-search.
      //   2. "Smart Thinking…" pill — shown only if the classifier triggered a web search.
      //   3. Back to "Thinking…" — between search completion and the start of token streaming.
      //   4. Streaming tokens — final answer fills the same bubble.
      // Reusing one bubble (instead of swapping between a step bubble and an answer bubble)
      // matches modern chat UIs and keeps the conversation flow visually stable.
      const placeholderMsgId = `msg-${Date.now()}-a`
      addChatMessage(sessionId, {
        id: placeholderMsgId,
        role: 'assistant',
        content: [{ type: 'text', text: '' }],
        timestamp: Date.now(),
        isLoading: true,
      })

      try {
        await smartThinkingService.run({
          signal: sendController.signal,
          provider: selectedProvider,
          model: selectedModels[selectedProvider],
          question: text,
          messages: ipcHistory,
          systemPrompt: chatSystemPrompt || undefined,
          uiText: {
            webSearchStepLabelPrefix: t.chat_smart_thinking_step_label_prefix,
            webSearchSummaryTitle: t.chat_smart_thinking_summary_title,
            webSearchDefaultReason: t.chat_smart_thinking_default_reason,
            webSearchSourcesTitle: t.chat_smart_thinking_sources_title,
            webSearchNoSources: t.chat_smart_thinking_no_sources,
            webSearchNoResults: t.chat_smart_thinking_no_results,
            webSearchErrorFallback: t.chat_smart_thinking_search_error,
            noResponseError: t.chat_smart_thinking_no_response,
            unknownError: t.chat_smart_thinking_unknown_error,
          },
          callbacks: {
            // Step starts → flip the placeholder to the "Smart Thinking…" pill.
            // We deliberately ignore `label` and any step content/sources so the
            // user only sees a lightweight indicator.
            onStepStart: (_label) => {
              updateChatMessage(sessionId, placeholderMsgId, {
                content: [{ type: 'text', text: '' }],
                isLoading: true,
                isSmartThinkingStep: true,
                researchStepLabel: t.chat_smart_thinking_badge,
              })
              return placeholderMsgId
            },
            // Step done → clear the Smart Thinking pill and return the bubble
            // to its plain "Thinking…" state until token streaming begins.
            onStepComplete: (_msgId, _content) => {
              updateChatMessage(sessionId, placeholderMsgId, {
                content: [{ type: 'text', text: '' }],
                isLoading: true,
                isSmartThinkingStep: false,
                researchStepLabel: undefined,
              })
            },
            onStepError: (_msgId, error) => {
              // Soft fallback: keep showing "Thinking…" so the model can still
              // answer from internal knowledge. We log the error to the bubble
              // only as a tooltip-friendly signal; the visible spinner stays.
              updateChatMessage(sessionId, placeholderMsgId, {
                content: [{ type: 'text', text: '' }],
                isLoading: true,
                isSmartThinkingStep: false,
                researchStepLabel: undefined,
                error: localizeChatException(t, error, t.chat_error_failed_response),
              })
            },
            onAnswerStart: () => placeholderMsgId,
            onAnswerToken: (_msgId, content) => {
              updateChatMessage(sessionId, placeholderMsgId, {
                content: [{ type: 'text', text: content }],
                isLoading: true,
                isSmartThinkingStep: false,
                researchStepLabel: undefined,
                error: undefined,
              })
            },
            onAnswerComplete: (_msgId, content) => {
              updateChatMessage(sessionId, placeholderMsgId, {
                content: [{ type: 'text', text: content }],
                isLoading: false,
                isSmartThinkingStep: false,
                researchStepLabel: undefined,
              })
              recordChatCost(
                sessionId,
                placeholderMsgId,
                flattenChatCostInput(ipcHistory, chatSystemPrompt || undefined),
                content,
              )
            },
            onAnswerError: (_msgId, error, errorCode) => {
              updateChatMessage(sessionId, placeholderMsgId, {
                isLoading: false,
                isSmartThinkingStep: false,
                researchStepLabel: undefined,
                error: localizeChatError(t, { error, errorCode }, t.chat_error_failed_response),
              })
            },
          },
        })
      } catch {
        // Per-step errors are handled by callbacks; ignore catastrophic ones.
      } finally {
        if (abortControllerRef.current === sendController) {
          abortControllerRef.current = null
        }
        setIsSending(false)
      }
      return
    }

    // ── Image edit path ──────────────────────────────────────────────────────
    // Chat/vision endpoints can analyze images but cannot return edited pixels.
    // When the prompt asks for a visual edit, call the dedicated image-edit API.
    const shouldEditImage = Boolean(attachedImage && text && shouldRouteToImageEdit(text, true))

    if (attachedImage && shouldEditImage) {
      const assistantMsgId = `msg-${Date.now()}-a`
      addChatMessage(sessionId, {
        id: assistantMsgId,
        role: 'assistant',
        content: [{ type: 'text', text: '' }],
        timestamp: Date.now(),
        isLoading: true,
      })

      if (typeof window.api.editChatImage !== 'function') {
        updateChatMessage(sessionId, assistantMsgId, {
          isLoading: false,
          error: t.chat_error_image_edit_reload_required,
        })
        setIsSending(false)
        return
      }

      try {
        const result = await chatService.editImage({
          provider: selectedProvider,
          model: selectedModels[selectedProvider],
          prompt: text,
          imageBase64: attachedImage.base64,
          imageMimeType: attachedImage.mimeType,
        })

        if (result.success && result.imageBase64 && result.imageMimeType) {
          const outputLabel = t.chat_image_edit_done
          updateChatMessage(sessionId, assistantMsgId, {
            content: [
              {
                type: 'image',
                imageBase64: result.imageBase64,
                imageMimeType: result.imageMimeType,
                imagePreviewUrl: buildImageDataUrl(result.imageBase64, result.imageMimeType),
                imageFileName: `edited-image-${Date.now()}.${imageExtensionFromMime(result.imageMimeType)}`,
              },
              { type: 'text', text: outputLabel },
            ],
            isLoading: false,
          })
          recordChatCost(sessionId, assistantMsgId, text, outputLabel)
        } else {
          updateChatMessage(sessionId, assistantMsgId, {
            isLoading: false,
            error: localizeChatError(t, result, t.chat_error_failed_image_edit),
          })
        }
      } catch (err) {
        updateChatMessage(sessionId, assistantMsgId, {
          isLoading: false,
          error: localizeChatException(t, err, t.chat_error_failed_image_edit),
        })
      } finally {
        setIsSending(false)
      }
      return
    }

    // ── Vision / image-attached path ─────────────────────────────────────────
    // Smart Thinking does not support images; non-edit image prompts use vision chat.

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
      let streamedText = ''
      const result = await chatService.stream(
        {
          provider: selectedProvider,
          model: selectedModels[selectedProvider],
          messages: ipcHistory,
          systemPrompt: chatSystemPrompt || undefined,
        },
        {
          onToken: (token) => {
            streamedText += token
            updateChatMessage(sessionId, assistantMsgId, {
              content: [{ type: 'text', text: streamedText }],
              isLoading: true,
              error: undefined,
            })
          },
          signal: sendController.signal,
        },
      )

      // User cancelled mid-stream — keep partial tokens, no error banner.
      if (result.errorCode === 'CANCELLED' || sendController.signal.aborted) {
        updateChatMessage(sessionId, assistantMsgId, {
          content: [{ type: 'text', text: streamedText }],
          isLoading: false,
        })
      } else if (result.success && result.reply) {
        updateChatMessage(sessionId, assistantMsgId, {
          content: [{ type: 'text', text: result.reply }],
          isLoading: false,
        })
        recordChatCost(
          sessionId,
          assistantMsgId,
          flattenChatCostInput(ipcHistory, chatSystemPrompt || undefined),
          result.reply,
        )
      } else {
        updateChatMessage(sessionId, assistantMsgId, {
          isLoading: false,
          error: localizeChatError(t, result, t.chat_error_failed_response),
        })
      }
    } catch (err) {
      if (sendController.signal.aborted) {
        updateChatMessage(sessionId, assistantMsgId, {
          isLoading: false,
        })
      } else {
        updateChatMessage(sessionId, assistantMsgId, {
          isLoading: false,
          error: localizeChatException(t, err, t.chat_error_failed_response),
        })
      }
    } finally {
      if (abortControllerRef.current === sendController) {
        abortControllerRef.current = null
      }
      setIsSending(false)
    }
  }, [
    inputText,
    attachedImage,
    isSending,
    hasKey,
    deepResearchMode,
    ensureSession,
    addChatMessage,
    updateChatMessage,
    selectedProvider,
    selectedModels,
    chatSystemPrompt,
    recordChatCost,
    t,
  ])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (shouldSendChatMessage(e.nativeEvent, chatSendShortcut, platform)) {
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

  const showCopiedToast = useCallback(() => {
    setCopiedId(String(Date.now()))
    setTimeout(() => setCopiedId(null), COPY_FEEDBACK_DURATION_MS)
  }, [])

  const handleDownloadImage = useCallback((content: ChatMessageContent) => {
    const imageUrl = getChatImageUrl(content)
    if (!imageUrl) return

    const a = document.createElement('a')
    a.href = imageUrl
    a.download = content.imageFileName ?? `viezan-chat-image-${Date.now()}.${imageExtensionFromMime(content.imageMimeType)}`
    a.click()
  }, [])

  const handleCopyImage = useCallback(async (content: ChatMessageContent) => {
    const imageUrl = getChatImageUrl(content)
    if (!imageUrl) return

    try {
      await copyImageToClipboard(imageUrl)
    } catch {
      await navigator.clipboard?.writeText?.(imageUrl).catch(() => {})
    }
    showCopiedToast()
  }, [showCopiedToast])

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    showCopiedToast()
  }

  const handleNewChat = useCallback(() => {
    setActiveChatSession(null)
  }, [setActiveChatSession])

  useEffect(() => {
    const handleNewChatShortcut = (e: KeyboardEvent) => {
      if (e.repeat || !eventMatchesShortcut(e, chatNewSessionShortcut, platform)) return
      e.preventDefault()
      handleNewChat()
    }

    window.addEventListener('keydown', handleNewChatShortcut)
    return () => window.removeEventListener('keydown', handleNewChatShortcut)
  }, [chatNewSessionShortcut, handleNewChat, platform])

  const handleClear = () => {
    if (activeChatSessionId) clearChatSession(activeChatSessionId)
  }

  /**
   * Stop the in-flight chat request.
   *
   * Calls `controller.abort()` on the active AbortController; that signal is
   * forwarded down through chatService → preload → main process, which closes
   * the provider stream and emits a `CANCELLED` event so the UI keeps any
   * tokens already streamed without showing an error banner.
   */
  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const messages = activeSession?.messages ?? []

  /** Shared input area — reused in both empty-state and messages-state layouts */
  const inputArea = (
    <div>
      {/* Image attach error */}
      {attachImageError && (
        <div className="px-4 pt-2 flex items-center gap-2">
          <p className="text-xs text-red-500 dark:text-red-400">{attachImageError}</p>
          <button
            type="button"
            onClick={() => setAttachImageError(null)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
            aria-label={t.translate_error_dismiss}
          >
            <XIcon className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Image preview */}
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

      {/* Deep Research active badge */}
      {deepResearchMode && (
        <div className="flex items-center gap-1.5 px-4 pt-2">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full
                           bg-indigo-50 dark:bg-indigo-950/40
                           border border-indigo-200 dark:border-indigo-700">
            <LightbulbIcon className="w-2.5 h-2.5 text-indigo-500" />
            <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">{t.chat_deep_research_badge}</span>
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-600">{t.chat_deep_research_hint}</span>
        </div>
      )}

      {/* Textarea + buttons */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex items-center gap-1 flex-shrink-0">
          <VoiceRecorder
            sourceLang="auto"
            onTranscript={handleVoiceTranscript}
            onRecordingChange={handleVoiceRecordingChange}
            titleRecord={t.chat_voice_record}
            titleStop={t.chat_voice_stop}
            labelTranscribing="…"
            labelRecording="…"
          />
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
          {/* Deep Research toggle (Smart Thinking is automatic — no toggle needed) */}
          <button
            type="button"
            onClick={() => setDeepResearchMode((v) => !v)}
            title={deepResearchMode ? t.chat_deep_research_disable : t.chat_deep_research_enable}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 cursor-pointer
                        ${deepResearchMode
                          ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400'
                          : 'text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950 dark:hover:text-indigo-400'}`}
          >
            <LightbulbIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value)
              if (isVoiceActive) resetVoicePrefix()
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={t.chat_placeholder}
            rows={1}
            disabled={isSending}
            className={`w-full resize-none rounded-lg px-4 py-2.5 text-sm leading-relaxed
                        bg-gray-100 dark:bg-gray-800 border border-transparent
                        focus:outline-none focus:border-blue-400 dark:focus:border-blue-600
                        placeholder-gray-400 dark:placeholder-gray-600
                        text-gray-900 dark:text-gray-100
                        disabled:opacity-60 transition-colors duration-150
                        ${isVoiceInterim ? 'italic text-gray-400 dark:text-gray-500' : ''}`}
            style={{ maxHeight: `${CHAT_TEXTAREA_MAX_HEIGHT_PX}px`, overflowY: 'auto' }}
          />
        </div>

        {/*
         * Send / Stop morphing button.
         *
         * While `isSending` is true the primary action is to stop the
         * in-flight request — the button switches to a red Stop button so
         * the user can interrupt long answers (mirrors ChatGPT / Claude UX).
         * The Stop button is only ENABLED when an AbortController is
         * actually attached to abortControllerRef; otherwise the request is
         * not interruptible (e.g. image-edit IPC) and the button stays
         * disabled to avoid a confusing no-op click.
         */}
        {isSending ? (
          <button
            type="button"
            onClick={handleStop}
            disabled={!abortControllerRef.current}
            title={t.chat_stop}
            aria-label={t.chat_stop}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full
                       bg-red-500 hover:bg-red-600 text-white shadow-sm
                       transition-all duration-200 cursor-pointer
                       disabled:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <StopSquareIcon className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={(!inputText.trim() && !attachedImage) || !hasKey}
            title={t.chat_send}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full
                       bg-blue-500 hover:bg-blue-600 text-white shadow-sm
                       transition-all duration-200 cursor-pointer
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <SendIcon />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div
      role="application"
      aria-label={t.chat_attach_image}
      className="app-page relative"
      onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true) }}
      onDragLeave={handleDragLeave}
      onDrop={handleFileDrop}
    >
      {/* Drop indicator overlay */}
      {isDraggingOver && (
        <DragOverlay label={t.chat_attach_image} zIndex="z-50" showRing />
      )}

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="app-workspace">

          {/* ── Top action bar: actions + settings icon ── */}
          <div className="app-topbar justify-end gap-1.5">
            {/* New chat */}
            <button
              type="button"
              onClick={handleNewChat}
              title={newChatShortcutLabel ? `${t.chat_new_session} (${newChatShortcutLabel})` : t.chat_new_session}
              className="toolbar-pill-button cursor-pointer whitespace-nowrap"
            >
              <PlusIcon />
              <span>{t.chat_new_session}</span>
            </button>

            {/* Clear — only when there are messages */}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                title={t.chat_clear}
                className="toolbar-pill-button cursor-pointer whitespace-nowrap hover:!border-red-200 hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-950/50 dark:hover:!text-red-400"
              >
                <TrashIcon />
                <span>{t.chat_clear}</span>
              </button>
            )}

            {/* AI Config settings icon + popup */}
            <div className="relative" ref={aiConfigRef}>
              <button
                type="button"
                onClick={() => setShowAIConfig((v) => !v)}
                title={t.translate_ai_config_title}
                className={`toolbar-icon-button cursor-pointer ${showAIConfig ? 'toolbar-icon-button-active' : ''}`}
              >
                <GearIcon className="w-3.5 h-3.5" />
              </button>

              {/* Settings popup */}
              {showAIConfig && (
                <div className="floating-panel absolute top-full right-0 mt-2 z-50 w-[480px] p-4 flex flex-col gap-4">
                  <h2 className="popover-title">
                    {t.translate_ai_config_title}
                  </h2>
                  <div className="flex flex-col gap-3">
                    <ModelSelector />
                    <SystemPromptDropdown
                      chatSystemPrompt={chatSystemPrompt}
                      systemPromptPresets={systemPromptPresets}
                      activePreset={activePreset}
                      onSetChatSystemPrompt={setChatSystemPrompt}
                      onNavigateSettings={() => { openSettings(); setShowAIConfig(false) }}
                      onAddPreset={addSystemPromptPreset}
                      t={t}
                    />
                  </div>

                </div>
              )}
            </div>
          </div>

          {messages.length === 0 ? (
            /* ── Empty state: centered layout (ChatGPT-style) ── */
            <div className="flex-1 flex flex-col items-center justify-center gap-6 pb-4">
              {/* Logo + description */}
              <div className="flex flex-col items-center gap-3 text-center select-none">
                <AppLogoIcon size={72} />
                <div>
                  <h2 className="text-base font-semibold text-gray-700 dark:text-gray-200">{t.chat_empty_title}</h2>
                  <p className="text-sm text-gray-400 dark:text-gray-600 mt-1 max-w-[280px]">{t.chat_empty_desc}</p>
                </div>
                {!hasKey && (
                  <div className="mt-1 flex flex-col items-center gap-2">
                    <p className="text-xs text-orange-500 dark:text-orange-400">{t.chat_error_no_key}</p>
                    <button
                      type="button"
                      onClick={() => openSettings()}
                      className="btn-primary text-xs py-1.5 px-3"
                    >
                      {t.chat_error_open_settings}
                    </button>
                  </div>
                )}
              </div>

              {/* Input box — centered card, max-width constrained */}
              <div className={`surface-panel w-full max-w-2xl transition-colors duration-150 ${
                isDraggingOver ? 'surface-panel-drop' : ''
              }`}>
                {inputArea}
              </div>
            </div>
          ) : (
            /* ── With messages: card layout ── */
            <div className={`surface-panel flex-1 min-h-0 transition-colors duration-150 ${
              isDraggingOver ? 'surface-panel-drop' : ''
            }`}>

              {/* Messages list */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-4 py-4 space-y-4">
                  {(() => {
                    const lastAssistantIdx = messages.reduce(
                      (acc, m, i) => (m.role === 'assistant' ? i : acc), -1
                    )
                    return messages.map((msg, idx) => (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        onCopy={handleCopy}
                        onCopyImage={handleCopyImage}
                        onDownloadImage={handleDownloadImage}
                        onRegenerate={idx === lastAssistantIdx ? handleRegenerate : undefined}
                        isLastAssistant={idx === lastAssistantIdx}
                        isSending={isSending}
                        copyLabel={t.translate_copy}
                        downloadImageLabel={t.chat_download_image}
                        regenerateLabel={t.chat_regenerate}
                      />
                    ))
                  })()}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input — panel footer */}
              <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800">
                {inputArea}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Copied toast ── */}
      {copiedId && (
        <div className="pointer-events-none fixed bottom-20 left-1/2 -translate-x-1/2
                        bg-gray-800 text-white text-xs px-3 py-1.5 rounded-full shadow-lg fade-in z-50">
          {t.chat_copied}
        </div>
      )}
    </div>
  )
}
