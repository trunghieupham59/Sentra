import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AppLogoIcon } from '../components/AppLogo'
import { MessageBubble } from '../components/chat/MessageBubble'
import { ResearchStepsPanel } from '../components/chat/ResearchStepsPanel'
import { SystemPromptDropdown } from '../components/chat/SystemPromptDropdown'
import { ModelSelector } from '../components/ModelSelector'
import { ProviderIcon } from '../components/ProviderIcon'
import { DragOverlay } from '../components/ui/DragOverlay'
import { ImagePreviewThumbnail } from '../components/ui/ImagePreviewThumbnail'
import {
  ArrowRightIcon,
  ChevronDownIcon,
  ImageIcon,
  LightbulbIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  StopSquareIcon,
  TranslateIcon,
  TrashIcon,
  XIcon,
} from '../components/ui/icons'

import { VoiceRecorder } from '../components/VoiceRecorder'
import { MAX_CHAT_IMAGE_DIMENSION, MAX_IMAGE_INPUT_BYTES } from '../constants/image'
import { COPY_FEEDBACK_DURATION_MS } from '../constants/ui'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { chatService } from '../services/chatService'
import { DEEP_RESEARCH_CANCELLED_ERROR, deepResearchService } from '../services/deepResearchService'
import { smartThinkingService } from '../services/smartThinkingService'
import { useAppStore, useT } from '../store/useAppStore'
import type { ChatMessage, ChatMessageContent, DeepResearchResumeState } from '../types'

import { localizeChatError, localizeChatException } from '../utils/chatErrors'
import { createClientId } from '../utils/id'
import { extractImageFromClipboard, resizeImageFile } from '../utils/imageUtils'
import { eventMatchesShortcut, formatShortcutLabel, shouldSendChatMessage } from '../utils/keyboardShortcuts'
import { formatModelName } from '../utils/modelDisplay'
import { estimateUsageCost } from '../utils/usageCost'


/** Max height (px) của textarea input — giới hạn scroll khi text dài */
const CHAT_TEXTAREA_MAX_HEIGHT_PX = 160

/**
 * Buffer interval (ms) used to coalesce streamed tokens before they hit the
 * Zustand store. 60 ms ≈ 16 Hz feels real-time to the eye while skipping
 * ~70% of the per-token re-renders ChatPage would otherwise pay for.
 */
const CHAT_STREAM_BUFFER_INTERVAL_MS = 60


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
  // Subscribe with `useShallow` so ChatPage only re-renders when one of the
  // listed slices actually changes (instead of on every unrelated store mutation
  // such as locale, history, usage cost, etc.). Actions are stable references in
  // Zustand so they're safe to include without churn.
  const {
    selectedProvider, selectedModels, keyStatus,
    chatSendShortcut, chatNewSessionShortcut,
    chatSessions, activeChatSessionId, chatSystemPrompt, systemPromptPresets,
    createChatSession, setActiveChatSession, addChatMessage, updateChatMessage,
    addChatSessionCost, clearChatSession, setChatSystemPrompt, addSystemPromptPreset, openSettings,
    recordUsageCost, setDeepResearchResumeState,
    setChatSessionDraft, setChatSessionDeepResearchMode,
    setChatPendingDraft, setChatPendingDeepResearchMode,
  } = useAppStore(
    useShallow((s) => ({
      selectedProvider: s.selectedProvider,
      selectedModels: s.selectedModels,
      keyStatus: s.keyStatus,
      chatSendShortcut: s.chatSendShortcut,
      chatNewSessionShortcut: s.chatNewSessionShortcut,
      chatSessions: s.chatSessions,
      activeChatSessionId: s.activeChatSessionId,
      chatSystemPrompt: s.chatSystemPrompt,
      systemPromptPresets: s.systemPromptPresets,
      createChatSession: s.createChatSession,
      setActiveChatSession: s.setActiveChatSession,
      addChatMessage: s.addChatMessage,
      updateChatMessage: s.updateChatMessage,
      addChatSessionCost: s.addChatSessionCost,
      clearChatSession: s.clearChatSession,
      setChatSystemPrompt: s.setChatSystemPrompt,
      addSystemPromptPreset: s.addSystemPromptPreset,
      openSettings: s.openSettings,
      recordUsageCost: s.recordUsageCost,
      setDeepResearchResumeState: s.setDeepResearchResumeState,
      setChatSessionDraft: s.setChatSessionDraft,
      setChatSessionDeepResearchMode: s.setChatSessionDeepResearchMode,
      setChatPendingDraft: s.setChatPendingDraft,
      setChatPendingDeepResearchMode: s.setChatPendingDeepResearchMode,
    })),
  )


  const t = useT()

  /**
   * Composer state — backed by the store so drafts and toggle survive page
   * navigation (lazy-loaded ChatPage unmounts when user switches to
   * Translate/etc.). Local `useState` is the source of truth at render time
   * for typing perf; effects below sync it with whichever session — or the
   * empty-state pending bucket — owns the draft right now.
   *
   * Mirrors ChatGPT/Claude behaviour: text drafts + mode toggle persist
   * per-session; attached images stay ephemeral.
   */
  const [inputText, setInputTextLocal] = useState(() => {
    const s = useAppStore.getState()
    if (s.activeChatSessionId) {
      return s.chatSessions.find((x) => x.id === s.activeChatSessionId)?.draftInput ?? ''
    }
    return s.chatPendingDraft
  })
  const setInputText = useCallback((text: string) => {
    setInputTextLocal(text)
    const sid = useAppStore.getState().activeChatSessionId
    if (sid) setChatSessionDraft(sid, text)
    else setChatPendingDraft(text)
  }, [setChatSessionDraft, setChatPendingDraft])
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
  /** Whether Deep Research multi-step pipeline is active — persisted per session */
  const [deepResearchMode, setDeepResearchModeLocal] = useState(() => {
    const s = useAppStore.getState()
    if (s.activeChatSessionId) {
      return s.chatSessions.find((x) => x.id === s.activeChatSessionId)?.deepResearchMode ?? false
    }
    return s.chatPendingDeepResearchMode
  })
  const setDeepResearchMode = useCallback((updater: boolean | ((v: boolean) => boolean)) => {
    setDeepResearchModeLocal((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      const sid = useAppStore.getState().activeChatSessionId
      if (sid) setChatSessionDeepResearchMode(sid, next)
      else setChatPendingDeepResearchMode(next)
      return next
    })
  }, [setChatSessionDeepResearchMode, setChatPendingDeepResearchMode])

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

  // Auto-scroll to bottom on new messages.
  // Use `instant` instead of `smooth` to avoid jank during streaming — when
  // tokens land every ~60 ms a smooth scroll animation never settles and the
  // browser ends up dropping frames on long replies.
  const msgCount = activeSession?.messages.length ?? 0
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages count
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [msgCount])

  // ── Auto-resize textarea ──
  // biome-ignore lint/correctness/useExhaustiveDependencies: inputText is the trigger for resize
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, CHAT_TEXTAREA_MAX_HEIGHT_PX)}px`
  }, [inputText])

  // ── Hydrate composer when the active session changes ──
  // Sources of truth for draft/mode:
  //   - active session exists → that session's `draftInput` / `deepResearchMode`
  //   - no active session (empty state) → `chatPendingDraft` / `chatPendingDeepResearchMode`
  // Reset attachedImage too — ephemeral by design, mirrors ChatGPT/Claude.
  useEffect(() => {
    const s = useAppStore.getState()
    if (activeChatSessionId) {
      const session = s.chatSessions.find((x) => x.id === activeChatSessionId)
      setInputTextLocal(session?.draftInput ?? '')
      setDeepResearchModeLocal(session?.deepResearchMode ?? false)
    } else {
      setInputTextLocal(s.chatPendingDraft)
      setDeepResearchModeLocal(s.chatPendingDeepResearchMode)
    }
    setAttachedImage(null)
  }, [activeChatSessionId])

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
    // Hard upper-bound check before decoding — a 50 MP RAW/HEIC dropped into
    // the composer would otherwise allocate hundreds of megabytes of canvas
    // memory inside resizeImageFile and freeze the renderer.
    if (file.size > MAX_IMAGE_INPUT_BYTES) {
      const maxMb = Math.round(MAX_IMAGE_INPUT_BYTES / (1024 * 1024))
      setAttachImageError(t.image_translate_size_error(maxMb))
      return
    }
    try {
      // DUP-05: use shared resizeImageFile (fixed quality, no compression loop needed for chat)
      const result = await resizeImageFile(file, MAX_CHAT_IMAGE_DIMENSION)
      setAttachedImage(result)
    } catch (err) {
      // Show error in the UI so the user knows the attachment failed
      const msg = err instanceof Error ? err.message : t.image_translate_error_failed
      setAttachImageError(msg)
    }
  }, [t.image_translate_error_failed, t.image_translate_size_error])

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
      .filter((m) => !m.isLoading && !m.error && !m.isResearchStep && !m.isSmartThinkingStep)

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
          carefulReasoning: true,
        },
        {
          // Buffer tokens so the store update fires at most once per ~60 ms
          // instead of for every provider token. This caps the streaming-time
          // re-render rate while keeping the perceived latency below 100 ms.
          bufferIntervalMs: CHAT_STREAM_BUFFER_INTERVAL_MS,
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

  /**
   * Run (or resume) the Deep Research pipeline against an active session.
   *
   * Extracted from the original `handleSend` Deep Research branch so that
   * the new "Tiếp tục nghiên cứu" button can call the same orchestration
   * with a `resumeState` argument — both code paths share the exact same
   * step bubbles, callbacks, and persistence wiring, so resume looks
   * identical to a fresh run from the user's perspective.
   *
   * The function expects the user message + any attachments to already be
   * pushed into the session — fresh runs do that in `handleSend`, resumed
   * runs simply skip it because the original user message is still there.
   */
  const runDeepResearchPipeline = useCallback(async ({
    sessionId,
    question,
    images,
    resumeState,
  }: {
    sessionId: string
    question: string
    images: { imageBase64: string; imageMimeType: string }[]
    resumeState?: DeepResearchResumeState
  }) => {
    const drController = new AbortController()
    abortControllerRef.current = drController
    setIsSending(true)

    try {
      await deepResearchService.run({
        signal: drController.signal,
        provider: selectedProvider,
        model: selectedModels[selectedProvider],
        question,
        carefulReasoning: true,
        images: images.length > 0 ? images : undefined,
        resumeState,
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
          onStepStart: (label, meta) => {
            const msgId = createClientId('msg-dr')
            addChatMessage(sessionId, {
              id: msgId,
              role: 'assistant',
              content: [{ type: 'text', text: '' }],
              timestamp: Date.now(),
              isLoading: true,
              isResearchStep: true,
              researchStepLabel: label,
              researchStepPhase: meta.phase,
              researchStepAspect: meta.aspect,
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
              recordChatCost(sessionId, msgId, question, content)
            }
          },
          onStepError: (msgId, error) => {
            updateChatMessage(sessionId, msgId, {
              isLoading: false,
              error: error === DEEP_RESEARCH_CANCELLED_ERROR
                ? undefined
                : localizeChatException(t, error, t.chat_error_failed_response),
              isResearchStep: true,
            })
          },
          // Persist phase-level snapshots so a Stop / page reload can resume
          // the run from the last completed phase. The store action accepts
          // `null` to clear the snapshot when synthesis succeeds.
          onResumeStateChange: (state) => {
            setDeepResearchResumeState(sessionId, state)
          },
        },
      })
    } catch {
      // Catastrophic + cancellation errors are surfaced via per-step
      // callbacks; we swallow here so the orchestration's `finally` always
      // resets the in-flight controller flag.
    } finally {
      if (abortControllerRef.current === drController) {
        abortControllerRef.current = null
      }
      setIsSending(false)
    }
  }, [
    selectedProvider,
    selectedModels,
    addChatMessage,
    updateChatMessage,
    recordChatCost,
    setDeepResearchResumeState,
    t,
  ])

  /**
   * Click handler for the "Tiếp tục nghiên cứu" button on a stopped Deep
   * Research panel. Restores the persisted snapshot and replays the
   * pipeline starting from the next phase — already-completed phases are
   * skipped inside the service (see `isPhaseDone`), so the user pays only
   * for the remaining steps.
   */
  const handleResumeDeepResearch = useCallback(async () => {
    if (isSending || !activeChatSessionId) return
    const session = useAppStore.getState().chatSessions.find((s) => s.id === activeChatSessionId)
    const resumeState = session?.deepResearchResumeState
    if (!resumeState) return
    await runDeepResearchPipeline({
      sessionId: activeChatSessionId,
      question: resumeState.question,
      images: [],
      resumeState,
    })
  }, [isSending, activeChatSessionId, runDeepResearchPipeline])

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
      id: createClientId('msg-u'),
      role: 'user',
      content: userContent,
      timestamp: Date.now(),
    }

    // ── Deep Research path ────────────────────────────────────────────────────
    if (deepResearchMode && (text || attachedImage)) {
      addChatMessage(sessionId, userMsg)
      setDeepResearchResumeState(sessionId, null)
      setInputText('')
      setAttachedImage(null)
      await runDeepResearchPipeline({
        sessionId,
        question: text || t.chat_deep_research_image_only_prompt,
        images: attachedImage
          ? [{ imageBase64: attachedImage.base64, imageMimeType: attachedImage.mimeType }]
          : [],
      })
      return
    }


    addChatMessage(sessionId, userMsg)
    setDeepResearchResumeState(sessionId, null)
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
      const placeholderMsgId = createClientId('msg-a')
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
          carefulReasoning: true,
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
            onStepError: (_msgId, _error) => {
              // Soft fallback: keep showing "Thinking…" so the model can still
              // answer from internal knowledge. The web-search failure itself
              // is not surfaced — only a final answer error would be.
              updateChatMessage(sessionId, placeholderMsgId, {
                content: [{ type: 'text', text: '' }],
                isLoading: true,
                isSmartThinkingStep: false,
                researchStepLabel: undefined,
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
      const assistantMsgId = createClientId('msg-a')
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
        if (abortControllerRef.current === sendController) {
          abortControllerRef.current = null
        }
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

        // The edit IPC does not yet accept an AbortSignal — if the user clicked
        // Stop while the backend was running, finalise the bubble silently and
        // discard the result instead of overwriting with edited content.
        if (sendController.signal.aborted) {
          updateChatMessage(sessionId, assistantMsgId, { isLoading: false })
        } else if (result.success && result.imageBase64 && result.imageMimeType) {
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
        if (sendController.signal.aborted) {
          updateChatMessage(sessionId, assistantMsgId, { isLoading: false })
        } else {
          updateChatMessage(sessionId, assistantMsgId, {
            isLoading: false,
            error: localizeChatException(t, err, t.chat_error_failed_image_edit),
          })
        }
      } finally {
        if (abortControllerRef.current === sendController) {
          abortControllerRef.current = null
        }
        setIsSending(false)
      }
      return
    }

    // ── Vision / image-attached path ─────────────────────────────────────────
    // Smart Thinking does not support images; non-edit image prompts use vision chat.

    // Placeholder assistant message
    const assistantMsgId = createClientId('msg-a')
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
          carefulReasoning: true,
        },
        {
          // Same buffering rationale as the regenerate path — see the constant.
          bufferIntervalMs: CHAT_STREAM_BUFFER_INTERVAL_MS,

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
    runDeepResearchPipeline,
    setDeepResearchResumeState,
    setInputText,
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
  const currentModel = selectedModels[selectedProvider]
  const currentModelLabel = formatModelName(selectedProvider, currentModel)
  const canResumeDeepResearch = Boolean(
    !isSending
    && !inputText.trim()
    && !attachedImage
    && activeSession?.deepResearchResumeState
    && activeSession.deepResearchResumeState.lastCompletedPhase !== 'synth',
  )

  /** Shared input area — reused in both empty-state and messages-state layouts */
  const inputArea = (
    <div className="flex flex-col">
      {/* Image attach error */}
      {attachImageError && (
        <div className="px-4 pt-2 flex items-center gap-2">
          <p className="ui-error-text text-xs">{attachImageError}</p>
          <button
            type="button"
            onClick={() => setAttachImageError(null)}
            className="btn-icon btn-icon-xs btn-icon-danger"
            aria-label={t.translate_error_dismiss}
          >
            <XIcon className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Active mode pills row — only renders when Deep Research is on */}
      {deepResearchMode && (
        <div className="flex items-center gap-1.5 px-4 pt-3">
          <span className="chat-pill chat-pill-neutral">
            <LightbulbIcon className="h-2.5 w-2.5" />
            <span>{t.chat_deep_research_badge}</span>
          </span>
          <span className="ui-micro">
            {t.chat_deep_research_hint}
          </span>
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
        <div className="voice-recording-panel mx-3 mt-2 flex items-center gap-3 px-4 py-2">
          <div className="flex items-end gap-[3px] h-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className="voice-recording-bar"
                style={{ height: `${VOICE_BAR_HEIGHT_BASE_PX + (i % 3) * VOICE_BAR_HEIGHT_STEP_PX}px`, animationDuration: `${VOICE_BAR_DURATION_BASE_S + i * VOICE_BAR_DURATION_STEP_S}s`, animationDelay: `${i * VOICE_BAR_DELAY_STEP_S}s` }}
              />
            ))}
          </div>
          <span
            className={`text-xs font-medium ${isVoiceInterim ? 'italic' : 'voice-recording-text'}`}
            style={isVoiceInterim ? { color: 'var(--vzn-text-soft)' } : undefined}
          >
            {inputText || '…'}
          </span>
        </div>
      )}

      {/* Textarea */}
      <div className="px-3 pt-2">
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
          className={`chat-input-field ${isVoiceInterim ? 'italic' : ''}`}
          style={{
            maxHeight: `${CHAT_TEXTAREA_MAX_HEIGHT_PX}px`,
            overflowY: 'auto',
            ...(isVoiceInterim ? { color: 'var(--vzn-text-soft)' } : null),
          }}
        />
      </div>

      {/* Action toolbar */}
      <div className="flex items-center gap-1 px-2 pb-2">
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
          className="chat-action-button"
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
        {/*
         * Deep Research toggle — Smart Thinking is automatic, and Careful
         * Reasoning is always on by default (handled in the IPC layer), so
         * Deep Research is the only chat-mode toggle exposed in the toolbar.
         */}
        <button
          type="button"
          onClick={() => setDeepResearchMode((v) => !v)}
          title={deepResearchMode ? t.chat_deep_research_disable : t.chat_deep_research_enable}
          className={`chat-action-button ${deepResearchMode ? 'chat-action-button-active-neutral' : ''}`}
        >
          <LightbulbIcon className="w-4 h-4" />
        </button>

        <div className="flex-1" />

        {/* Char counter — subtle, only when getting close to long text */}
        {inputText.length > 600 && (
          <span className="ui-micro tabular-nums px-1">
            {inputText.length}
          </span>
        )}

        {/*
         * Send / Stop / Resume morphing button.
         *
         * The primary action always occupies the same slot in the composer:
         * Send for a new prompt, Stop while work is running, Resume when a
         * stopped Deep Research checkpoint is waiting and the draft is empty.
         */}
        {isSending ? (
          <button
            type="button"
            onClick={handleStop}
            title={t.chat_stop}
            aria-label={t.chat_stop}
            className="chat-stop-button"
          >
            <StopSquareIcon className="w-5 h-5" />
          </button>
        ) : canResumeDeepResearch ? (
          <button
            type="button"
            onClick={handleResumeDeepResearch}
            title={t.chat_deep_research_resume}
            aria-label={t.chat_deep_research_resume}
            className="chat-resume-button"
          >
            <span className="chat-primary-action-label">{t.chat_deep_research_resume_short}</span>
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={(!inputText.trim() && !attachedImage) || !hasKey}
            title={t.chat_send}
            className="chat-send-button"
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
      onDragOver={(e) => {
        e.preventDefault()
        if (!isDraggingOver) setIsDraggingOver(true)
      }}
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

          {/* ── Top action bar: model badge (opens config) + actions ── */}
          <div className="app-topbar gap-1.5">
            {/* Model badge — single trigger for AI config popup */}
            <div className="relative" ref={aiConfigRef}>
              <button
                type="button"
                onClick={() => setShowAIConfig((v) => !v)}
                title={t.translate_ai_config_title}
                className={`chat-model-badge ${showAIConfig ? 'chat-model-badge-active' : ''}`}
              >
                <ProviderIcon provider={selectedProvider} size={14} />
                <span className="max-w-[160px] truncate">{currentModelLabel}</span>
                <ChevronDownIcon className="w-3 h-3 opacity-60" />
              </button>

              {/* AI config popup */}
              {showAIConfig && (
                <div className="floating-panel ai-config-panel absolute top-full left-0 mt-2 z-50 w-[440px] p-4 flex flex-col gap-4 fade-in">
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

            {/* Active session turn count — subtle informational text */}
            {messages.length > 0 && (
              <span className="ui-meta ml-1 hidden font-medium md:inline">
                · {messages.filter((m) => m.role === 'user').length} {t.history_chat_messages}
              </span>
            )}

            <div className="flex-1" />

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
                className="toolbar-pill-button toolbar-pill-danger cursor-pointer whitespace-nowrap"
              >
                <TrashIcon />
                <span>{t.chat_clear}</span>
              </button>
            )}
          </div>

          {messages.length === 0 ? (
            /* ── Empty state: compact centered layout ── */
            <div className="flex-1 flex flex-col items-center justify-center gap-7 px-4 pb-6 overflow-y-auto">
              {/* Logo + heading */}
              <div className="flex flex-col items-center gap-3 text-center select-none">
                <AppLogoIcon size={52} />
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--vzn-text-strong)' }}>
                    {t.chat_empty_title}
                  </h2>
                  <p className="ui-caption mx-auto max-w-[320px] leading-relaxed">
                    {t.chat_empty_desc}
                  </p>
                </div>
                {!hasKey && (
                  <div className="flex flex-col items-center gap-2 mt-1">
                    <p className="text-xs" style={{ color: 'var(--vzn-text-muted)' }}>{t.chat_error_no_key}</p>
                    <button
                      type="button"
                      onClick={() => openSettings()}
                      className="btn-primary btn-sm"
                    >
                      {t.chat_error_open_settings}
                    </button>
                  </div>
                )}
              </div>

              {/* Composer + suggestion chips */}
              <div className="flex w-full max-w-2xl flex-col gap-3">
                <div className={`chat-composer w-full ${isDraggingOver ? 'chat-composer-drop' : ''}`}>
                  {inputArea}
                </div>

                {/* Suggestion chips — 2×2 grid */}
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { icon: <TranslateIcon className="h-4 w-4" />, label: t.chat_suggest_translate, prompt: t.chat_suggest_translate_prompt },
                    { icon: <SearchIcon className="h-4 w-4" />, label: t.chat_suggest_research, prompt: t.chat_suggest_research_prompt },
                    { icon: <LightbulbIcon className="h-4 w-4" />, label: t.chat_suggest_explain, prompt: t.chat_suggest_explain_prompt },
                    { icon: <PencilIcon className="h-4 w-4" />, label: t.chat_suggest_write, prompt: t.chat_suggest_write_prompt },
                  ] as const).map(({ icon, label, prompt }) => (
                    <button
                      key={label}
                      type="button"
                      className="chat-suggest-chip group"
                      onClick={() => {
                        setInputText(prompt)
                        textareaRef.current?.focus()
                      }}
                    >
                      <span className="chat-suggest-icon">{icon}</span>
                      <span className="text-xs font-semibold leading-snug" style={{ color: 'var(--vzn-text)' }}>
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ── With messages: card layout ── */
            <div className={`surface-panel flex-1 min-h-0 transition-colors duration-150 ${
              isDraggingOver ? 'surface-panel-drop' : ''
            }`}>

              {/* Messages list — consecutive research-step messages are
               *  collapsed into a single ResearchStepsPanel so a Deep Research
               *  reply with 6–10 internal phases shows up as ONE tidy
               *  "Đã suy nghĩ · 8 bước" card rather than a wall of nested UI.
               *  See ResearchStepsPanel.tsx for the rationale and behaviour. */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-4 py-5 space-y-4">
                  {(() => {
                    const lastAssistantIdx = messages.reduce(
                      (acc, m, i) => (m.role === 'assistant' ? i : acc), -1
                    )

                    // Walk the messages list and emit either a single bubble
                    // or a grouped panel for each consecutive run of research
                    // steps. We keep the order stable so React keys remain
                    // unique (we use the first step id as the panel's key).
                    const rendered: React.ReactNode[] = []
                    let i = 0
                    while (i < messages.length) {
                      const msg = messages[i]
                      if (msg.isResearchStep) {
                        // Collect every consecutive research-step message.
                        const group: ChatMessage[] = []
                        while (i < messages.length && messages[i].isResearchStep) {
                          group.push(messages[i])
                          i++
                        }
                        rendered.push(
                          <ResearchStepsPanel
                            key={`rsp-${group[0].id}`}
                            steps={group}
                          />
                        )
                        continue

                      }
                      rendered.push(
                        <MessageBubble
                          key={msg.id}
                          message={msg}
                          onCopy={handleCopy}
                          onCopyImage={handleCopyImage}
                          onDownloadImage={handleDownloadImage}
                          onRegenerate={i === lastAssistantIdx ? handleRegenerate : undefined}
                          isLastAssistant={i === lastAssistantIdx}
                          isSending={isSending}
                          copyLabel={t.translate_copy}
                          downloadImageLabel={t.chat_download_image}
                          regenerateLabel={t.chat_regenerate}
                        />
                      )
                      i++
                    }
                    return rendered
                  })()}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input — panel footer, wrapped as composer card */}
              <div
                className="flex-shrink-0 px-3 pb-3 pt-1 border-t"
                style={{
                  borderColor: 'var(--vzn-border)',
                  background: 'color-mix(in srgb, var(--vzn-surface) 70%, transparent)',
                }}
              >
                <div className="chat-composer">
                  {inputArea}
                </div>
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
