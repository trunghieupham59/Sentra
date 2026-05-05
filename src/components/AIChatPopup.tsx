/**
 * AIChatPopup — Raycast-style standalone quick chat window.
 *
 * UX shape:
 *  - Q&A card (question header + answer body) per turn.
 *  - When a new turn starts, the active card snaps to fill the viewport,
 *    pushing older Q&A above the fold. Older pairs are revealed by
 *    scrolling up; wheel scroll works from anywhere on the popup.
 *  - Each Q&A has its own Copy + Regenerate actions on the bottom-right.
 *  - Conversation persists across hide ↔ show within a 5-minute TTL window
 *    so the user can re-open the popup and keep the context.
 *  - Whole popup is a drag region; interactive controls opt out.
 *
 * Mounted by quick-chat.html, not by the main app shell.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_CHAT_INPUT_CHARS } from '../constants/providers'
import type { ChatMessage } from '../services/chatService'
import { smartThinkingService } from '../services/smartThinkingService'
import { useAppStore, useT } from '../store/useAppStore'
import { localizeChatError, localizeChatException } from '../utils/chatErrors'
import { shouldSendChatMessage } from '../utils/keyboardShortcuts'
import { formatModelName } from '../utils/modelDisplay'
import { tpl } from '../utils/tpl'
import { AppLogoIcon } from './AppLogo'
import { MarkdownText } from './MarkdownText'
import { ProviderIcon } from './ProviderIcon'
import {
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
  PlusIcon,
  RefreshIcon,
  SendIcon,
  SparklesIcon,
  SpinnerIcon,
  XIcon,
} from './ui/icons'

const QUICK_TEXTAREA_MAX_HEIGHT_PX = 120

/**
 * Strip any trailing punctuation locales add to the loading copy
 * ("Đang suy nghĩ…", "Thinking…", "考え中…") so the polished pill can render
 * the label cleanly without doubled-up ellipses next to the bouncing dots.
 */
function stripTrailingEllipsis(label: string): string {
  return label.replace(/[…．.\s]+$/u, '')
}

/**
 * Three little bouncing dots — purely CSS-driven via .thinking-dot.
 * Each dot is staggered by 160 ms so they ripple smoothly. We keep them
 * fixed-size and absolutely-positioned-in-flow with `inline-flex` so the
 * surrounding label text doesn't reflow as the dots animate.
 */
function BouncingDots({ tone = 'blue' }: { tone?: 'blue' | 'gray' | 'white' } = {}) {
  const colour =
    tone === 'gray' ? 'bg-gray-400 dark:bg-gray-500'
    : tone === 'white' ? 'bg-white/85'
    : 'bg-blue-500 dark:bg-blue-400'
  return (
    <span className="inline-flex items-end gap-[3px] pb-[2px]" aria-hidden="true">
      <span className={`thinking-dot h-[5px] w-[5px] rounded-full ${colour}`} style={{ animationDelay: '0ms' }} />
      <span className={`thinking-dot h-[5px] w-[5px] rounded-full ${colour}`} style={{ animationDelay: '160ms' }} />
      <span className={`thinking-dot h-[5px] w-[5px] rounded-full ${colour}`} style={{ animationDelay: '320ms' }} />
    </span>
  )
}


/** Conversation kept this long after dismissal; after that, full reset on next show. */
const HISTORY_TTL_MS = 5 * 60 * 1000

const isMacPlatform = () => window.api?.platform === 'darwin'
const getPrimaryModifierKeyLabel = () => (isMacPlatform() ? '⌘' : 'Ctrl')
const getPrimaryModifierShortcutLabel = () => (isMacPlatform() ? 'Cmd' : 'Ctrl')

function isPrimaryModifierShortcut(e: KeyboardEvent, key: string) {
  const isMac = isMacPlatform()
  const primaryModifier = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey
  return primaryModifier && !e.altKey && !e.shiftKey && e.key.toLowerCase() === key.toLowerCase()
}

/** Internal conversation memory — sent to the model on every follow-up. */
interface Turn {
  role: 'user' | 'assistant'
  text: string
}

interface SmartStep {
  label: string
  content: string
  status: 'running' | 'complete' | 'error'
}

/** Small visual key cap used for keyboard hints. */
function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-md border border-gray-200 bg-white px-1 text-[11px] font-medium text-gray-500 shadow-sm shadow-gray-900/[0.04]">
      {children}
    </kbd>
  )
}

/**
 * Polished "Thinking…" pill — soft blue gradient, sparkle icon with a glow
 * halo, label, and three bouncing dots. Used while the model is mulling the
 * question over before any tokens arrive. The pill styling matches the Smart
 * Thinking pill so phase transitions feel cohesive.
 */
function ThinkingLabel({ label }: { label: string }) {
  const baseLabel = stripTrailingEllipsis(label)
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-blue-100/80 bg-gradient-to-r from-blue-50 via-sky-50 to-blue-50
                 px-3 py-1 text-[12.5px] font-semibold text-blue-700 shadow-sm shadow-blue-900/[0.04] select-none"
      role="status"
      aria-live="polite"
    >
      <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
        <span className="thinking-glow absolute inset-0 rounded-full bg-blue-400/30 blur-[3px]" aria-hidden />
        <SparklesIcon className="relative h-3.5 w-3.5 text-blue-500" />
      </span>
      <span className="tracking-[0.01em]">{baseLabel}</span>
      <BouncingDots tone="blue" />
    </span>
  )
}



export function AIChatPopup() {
  const {
    selectedProvider,
    selectedModels,
    keyStatus,
    setKeyStatus,
    chatSystemPrompt,
    chatSendShortcut,
  } = useAppStore()

  const t = useT()

  // ── Visible state — current/active Q&A pair ─────────────────────────────
  const [activeQuestion, setActiveQuestion] = useState('')
  const [response, setResponse] = useState('')
  const [smartStep, setSmartStep] = useState<SmartStep | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Conversation memory ───────────────────────────────────────────────
  // `history` holds finalized [user, assistant, user, assistant, ...] turns.
  // The active pair lives in `activeQuestion`/`response` and only gets folded
  // into history when the user sends a follow-up.
  const [history, setHistory] = useState<Turn[]>([])

  /**
   * Per-Q&A "Copied!" feedback key:
   *  - `'active'` — copied the active answer
   *  - `'footer'` — copied via the bottom-bar Copy button
   *  - number    — index of the Q&A pair in `history`
   */
  const [copiedKey, setCopiedKey] = useState<number | 'active' | 'footer' | null>(null)

  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  /** Outer scroll container for the whole Q&A list. */
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  /** Wrapper around the active Q&A card — sized to fill the viewport. */
  const activeWrapperRef = useRef<HTMLDivElement>(null)
  const [viewportHeight, setViewportHeight] = useState<number>(0)
  /** Wall-clock of last dismissal — drives the HISTORY_TTL_MS check. */
  const lastHideAtRef = useRef<number>(0)

  const model = selectedModels[selectedProvider] ?? ''
  const hasKey = selectedProvider === 'local' || keyStatus[selectedProvider]
  const platform = window.api?.platform
  const trimmedLength = input.trim().length
  const inputTooLong = trimmedLength > MAX_CHAT_INPUT_CHARS
  const canSend = Boolean(input.trim()) && !inputTooLong && !isSending && hasKey
  const turnCount = history.length / 2 + (activeQuestion ? 1 : 0)
  const hasContext = turnCount > 0
  const showThinking = isSending && !response.trim()
  const primaryModifierKey = getPrimaryModifierKeyLabel()
  const primaryModifierShortcut = getPrimaryModifierShortcutLabel()
  const placeholder = hasContext
    ? t.ai_chat_popup_followup_placeholder
    : chatSendShortcut === 'modEnter'
      ? tpl(t.ai_chat_popup_placeholder_mod_enter, { mod: primaryModifierShortcut })
      : t.ai_chat_popup_placeholder

  // Pretty short label for the active model (e.g. "GPT 5.4 Mini").
  // Falls back to `default` when no model has been picked yet.
  const modelLabel = model ? formatModelName(selectedProvider, model) : 'default'

  const focusInput = useCallback(() => {
    window.setTimeout(() => textareaRef.current?.focus(), 30)
  }, [])

  const hardReset = useCallback(() => {
    setActiveQuestion('')
    setResponse('')
    setSmartStep(null)
    setHistory([])
    setInput('')
    setError(null)
    setIsSending(false)
    setCopiedKey(null)
  }, [])

  const handleShow = useCallback(() => {
    // The popup runs in its own BrowserWindow / renderer process and therefore
    // has its own Zustand store. The main window persists provider / model /
    // system-prompt selections to localStorage; force a re-hydrate every time
    // the popup becomes visible so the user actually sees the latest config
    // (otherwise the popup keeps the snapshot it had on first mount).
    useAppStore.persist?.rehydrate?.()
    const elapsed = Date.now() - lastHideAtRef.current
    if (elapsed >= HISTORY_TTL_MS) {
      hardReset()
    }
    setInput('')
    setError(null)
    setCopiedKey(null)
    focusInput()
  }, [hardReset, focusInput])


  const hidePopup = useCallback(() => {
    lastHideAtRef.current = Date.now()
    window.api?.quickChat?.hide()
  }, [])

  // Mount lifecycle: tag <html> for popup-only CSS, run show-time logic.
  useEffect(() => {
    document.documentElement.classList.add('quick-chat-window')
    handleShow()
    return () => document.documentElement.classList.remove('quick-chat-window')
  }, [handleShow])

  // Subsequent shows from main process.
  useEffect(() => {
    if (!window.api?.quickChat?.onShow) return
    return window.api.quickChat.onShow(handleShow)
  }, [handleShow])

  // Detect API key for the selected provider.
  useEffect(() => {
    if (selectedProvider === 'local') {
      setKeyStatus('local', true)
      return
    }
    if (!window.api?.keychain?.hasKey) return
    window.api.keychain
      .hasKey(selectedProvider)
      .then((result) => setKeyStatus(selectedProvider, Boolean(result.exists)))
      .catch(() => setKeyStatus(selectedProvider, false))
  }, [selectedProvider, setKeyStatus])

  // Auto-grow textarea height to fit content (capped).
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, QUICK_TEXTAREA_MAX_HEIGHT_PX)}px`
  })

  // Measure scroll-container height so the active Q&A card can fill the viewport.
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const update = () => setViewportHeight(el.clientHeight)
    update()
    const RO = typeof ResizeObserver !== 'undefined' ? ResizeObserver : null
    const ro = RO ? new RO(update) : null
    ro?.observe(el)
    window.addEventListener('resize', update)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  // When a brand-new turn starts, snap the active card to the top.
  useEffect(() => {
    if (!activeQuestion) return
    const target = activeWrapperRef.current
    const container = scrollContainerRef.current
    if (!target || !container) return
    if (typeof container.scrollTo === 'function') {
      container.scrollTo({ top: target.offsetTop, behavior: 'smooth' })
    } else {
      container.scrollTop = target.offsetTop
    }
  }, [activeQuestion])

  /** Build IPC payload from full history + the next user turn. */
  const buildMessages = useCallback(
    (turns: Turn[], nextUserText: string): ChatMessage[] => {
      const all: ChatMessage[] = []
      for (const turn of turns) {
        if (!turn.text.trim()) continue
        all.push({ role: turn.role, content: [{ type: 'text', text: turn.text }] })
      }
      all.push({ role: 'user', content: [{ type: 'text', text: nextUserText }] })
      return all
    },
    [],
  )

  /**
   * Stream a single user turn using the given history snapshot. Used by both
   * "send a new question" and "regenerate the active answer".
   */
  const streamTurn = useCallback(
    async (historySnapshot: Turn[], userText: string) => {
      setActiveQuestion(userText)
      setResponse('')
      setSmartStep(null)
      setError(null)
      setIsSending(true)

      const payload = buildMessages(historySnapshot, userText)

      try {
        await smartThinkingService.run({
          provider: selectedProvider,
          model,
          question: userText,
          messages: payload,
          systemPrompt: chatSystemPrompt || undefined,
          // Careful Reasoning is always on by default (handled in the IPC
          // layer): the small token cost is well worth preventing silent
          // miscalculations on quantitative questions.
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
            // Smart Thinking lifecycle:
            //   • running   → swap "Thinking…" for the Smart Thinking pill
            //   • complete  → clear the pill so we fall back to plain "Thinking…"
            //                  while we wait for the answer to start streaming
            //   • error     → same as complete (the model will answer from
            //                  internal knowledge); no detail surfaced in UI
            onStepStart: (label) => {
              setSmartStep({ label, content: '', status: 'running' })
              return 'quick-chat-smart-step'
            },
            onStepComplete: () => {
              setSmartStep(null)
            },
            onStepError: () => {
              setSmartStep(null)
            },
            onAnswerStart: () => {
              setSmartStep(null)
              setResponse('')
              return 'quick-chat-smart-answer'
            },
            onAnswerToken: (_msgId, content) => {
              setResponse(content)
            },
            onAnswerComplete: (_msgId, content) => {
              setResponse(content)
            },
            onAnswerError: (_msgId, message, errorCode) => {
              setError(localizeChatError(t, { error: message, errorCode }, t.chat_error_failed_response))
            },
          },
        })
      } catch (err) {
        setError(localizeChatException(t, err, t.chat_error_unexpected))
      } finally {
        setIsSending(false)
        focusInput()
      }
    },
    [buildMessages, selectedProvider, model, chatSystemPrompt, t, focusInput],
  )


  /** Send a new question (or follow-up). Folds previous answer into history. */
  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || inputTooLong || isSending || !hasKey) return

    let nextHistory = history
    if (activeQuestion && response.trim()) {
      nextHistory = [
        ...history,
        { role: 'user', text: activeQuestion },
        { role: 'assistant', text: response },
      ]
      setHistory(nextHistory)
    }

    setInput('')
    await streamTurn(nextHistory, text)
  }, [input, inputTooLong, isSending, hasKey, history, activeQuestion, response, streamTurn])

  /**
   * Re-run the LLM for the given question.
   *  - For the active turn (`pairIdx === undefined`): re-run the same active
   *    question against the existing finalized history.
   *  - For an older pair (`pairIdx >= 0`): truncate history back to before
   *    that pair, restore its question to the active slot, and re-stream.
   *    Any later turns are dropped — same model as ChatGPT's "regenerate".
   */
  const handleRegenerate = useCallback(
    async (pairIdx?: number) => {
      if (isSending || !hasKey) return

      if (typeof pairIdx === 'number') {
        const userTurn = history[pairIdx * 2]
        if (!userTurn || userTurn.role !== 'user') return
        const truncated = history.slice(0, pairIdx * 2)
        setHistory(truncated)
        await streamTurn(truncated, userTurn.text)
        return
      }

      if (!activeQuestion.trim()) return
      await streamTurn(history, activeQuestion)
    },
    [isSending, hasKey, history, activeQuestion, streamTurn],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (shouldSendChatMessage(e.nativeEvent, chatSendShortcut, platform)) {
      e.preventDefault()
      e.stopPropagation()
      handleSend()
    }
  }

  const handleClearInput = useCallback(() => {
    setInput('')
    focusInput()
  }, [focusInput])

  const handleNewConversation = useCallback(() => {
    setHistory([])
    setActiveQuestion('')
    setResponse('')
    setSmartStep(null)
    setInput('')
    setError(null)
    focusInput()
  }, [focusInput])

  const handleOpenSettings = useCallback(() => {
    window.api?.quickChat?.openSettings()
  }, [])

  /** Copy text to clipboard and flash "Copied!" feedback on the matching button. */
  const handleCopy = useCallback(
    async (text: string, key: number | 'active' | 'footer') => {
      const value = text.trim()
      if (!value || !navigator.clipboard?.writeText) return
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey(null), 1200)
    },
    [],
  )

  const handleOpenInChat = useCallback(() => {
    const draft = input.trim()
    const question = draft || activeQuestion
    if (!question) {
      window.api?.quickChat?.openInChat()
      return
    }
    window.api?.quickChat?.openInChat({
      question,
      response: response.trim() || undefined,
      provider: selectedProvider,
      model,
    })
  }, [input, activeQuestion, response, selectedProvider, model])

  // Keyboard shortcuts: Esc closes; Cmd/Ctrl+N starts over; Cmd/Ctrl+Enter opens full Chat.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hidePopup()
        return
      }
      if (isPrimaryModifierShortcut(e, 'n') && !e.repeat) {
        if (hasContext || input.trim() || error) {
          e.preventDefault()
          handleNewConversation()
        }
        return
      }
      if (isPrimaryModifierShortcut(e, 'enter')) {
        e.preventDefault()
        handleOpenInChat()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [error, handleNewConversation, handleOpenInChat, hasContext, hidePopup, input])

  // Mark dismissal time whenever the popup loses visibility (any path).
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') lastHideAtRef.current = Date.now()
    }
    const onBlur = () => {
      lastHideAtRef.current = Date.now()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  /**
   * Forward wheel events from anywhere on the popup into the inner scroll
   * container, so users can scroll the conversation by spinning the wheel
   * over the header / footer / empty space — not only on the Q&A list.
   */
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current
    if (!container) return
    const target = e.target as Node | null
    if (target && container.contains(target)) return // native scroll handles it
    container.scrollTop += e.deltaY
  }, [])

  return (
    <div
      className="titlebar-drag h-screen w-screen bg-transparent p-3 text-gray-900"
      onWheel={handleWheel}
    >
      <section
        className="titlebar-drag relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white/95
                   shadow-2xl shadow-gray-950/20 backdrop-blur-xl"
        aria-label={t.ai_chat_popup_title}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/70 to-transparent" />

        {/* === Header / prompt bar ============================================ */}
        <div className="titlebar-drag flex flex-shrink-0 items-center gap-2 border-b border-gray-100 bg-white/70 px-3 py-2.5">
          <button
            type="button"
            onClick={hasContext ? handleNewConversation : undefined}
            disabled={!hasContext}
            title={hasContext ? `New conversation (${primaryModifierShortcut}+N)` : 'Quick AI'}
            className={`titlebar-no-drag flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg
                        bg-gradient-to-br from-blue-50 to-white ring-1 ring-blue-100 transition-colors
                        ${hasContext ? 'cursor-pointer hover:from-blue-100 hover:to-blue-50' : 'cursor-default'}`}
          >
            {hasContext ? (
              <PlusIcon className="h-4 w-4 text-blue-600" />
            ) : (
              <AppLogoIcon size={24} />
            )}
          </button>

          <div className="titlebar-no-drag relative flex min-w-0 flex-1 items-center">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              disabled={isSending}
              className="min-h-9 w-full resize-none rounded-lg bg-transparent px-2 py-2 pr-9 text-[18px]
                         font-medium leading-snug text-gray-900 placeholder:text-gray-400 outline-none
                         disabled:opacity-60"
              style={{ maxHeight: QUICK_TEXTAREA_MAX_HEIGHT_PX, overflowY: 'auto' }}
              aria-label={t.ai_chat_popup_title}
            />
            {input && !isSending && (
              <button
                type="button"
                onClick={handleClearInput}
                className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                aria-label={t.chat_clear}
                title={t.chat_clear}
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            title={t.chat_send}
            className="titlebar-no-drag flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg
                       bg-blue-500 text-white shadow-sm shadow-blue-900/20 transition-all
                       hover:bg-blue-600 active:scale-95
                       disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none"
            aria-label={t.chat_send}
          >
            {isSending ? (
              <SpinnerIcon className="h-4 w-4 animate-spin" />
            ) : (
              <SendIcon className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* === Body — Q&A list ============================================== */}
        <div
          ref={scrollContainerRef}
          className="titlebar-drag min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-gray-50/60 to-gray-50/20 px-4 py-4"
        >
          {!hasKey ? (
            <EmptyContainer>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 ring-1 ring-amber-200">
                <AppLogoIcon size={32} />
              </div>
              <p className="max-w-sm text-sm leading-6 text-amber-700">{t.chat_error_no_key}</p>
              <button
                type="button"
                onClick={handleOpenSettings}
                className="titlebar-no-drag rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
              >
                {t.chat_error_open_settings}
              </button>
            </EmptyContainer>
          ) : inputTooLong ? (
            <EmptyContainer>
              <p className="text-sm font-medium text-amber-600">
                {trimmedLength.toLocaleString()} / {MAX_CHAT_INPUT_CHARS.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">{t.ai_chat_popup_input_too_long}</p>
            </EmptyContainer>
          ) : !activeQuestion && !isSending ? (
            <EmptyContainer>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-white ring-1 ring-blue-100 shadow-sm shadow-blue-900/5">
                <AppLogoIcon size={42} />
              </div>
              <div className="text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-500/80">
                  {t.ai_chat_popup_short_label}
                </p>
                <h2 className="mt-0.5 text-xl font-semibold text-gray-900">
                  {t.ai_chat_popup_title}
                </h2>
              </div>
              <p className="max-w-[28rem] text-center text-[14px] leading-6 text-gray-500">
                {t.ai_chat_popup_empty_desc}
              </p>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-gray-400">
                <span className="inline-flex items-center gap-1.5">
                  <KeyCap>↵</KeyCap>
                  <span>{t.chat_send}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <KeyCap>⇧</KeyCap>
                  <KeyCap>↵</KeyCap>
                  <span>{t.ai_chat_popup_new_line}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <KeyCap>{primaryModifierKey}</KeyCap>
                  <KeyCap>↵</KeyCap>
                  <span>{t.ai_chat_popup_open_in_chat}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <KeyCap>Esc</KeyCap>
                  <span>{t.ai_chat_popup_close}</span>
                </span>
              </div>
            </EmptyContainer>
          ) : (
            <div className="mx-auto flex w-full max-w-[64rem] flex-col gap-3">
              {/* Past Q&A — only revealed by scrolling up. */}
              {Array.from({ length: history.length / 2 }).map((_, pairIdx) => {
                const userTurn = history[pairIdx * 2]
                const assistantTurn = history[pairIdx * 2 + 1]
                if (!userTurn || !assistantTurn) return null
                return (
                  <QAEntry
                    // biome-ignore lint/suspicious/noArrayIndexKey: append-only history
                    key={pairIdx}
                    question={userTurn.text}
                    answer={assistantTurn.text}
                    muted
                    isCopied={copiedKey === pairIdx}
                    onCopy={() => handleCopy(assistantTurn.text, pairIdx)}
                    onRegenerate={isSending ? undefined : () => handleRegenerate(pairIdx)}
                    copyLabel={t.chat_copy}
                    copiedLabel={t.chat_copied}
                    regenerateLabel={t.chat_regenerate}
                  />
                )
              })}

              {/* Active Q&A — fills the viewport. */}
              {activeQuestion && (
                <div
                  ref={activeWrapperRef}
                  style={
                    viewportHeight > 0
                      ? { minHeight: Math.max(viewportHeight - 32, 200) }
                      : undefined
                  }
                  className="flex flex-col"
                >
                  <ActiveQACard
                    question={activeQuestion}
                    response={response}
                    smartStep={smartStep}
                    isThinking={showThinking}
                    error={error}
                    isSending={isSending}
                    isCopied={copiedKey === 'active'}
                    smartThinkingLabel={t.chat_smart_thinking_badge}
                    thinkingLabel={t.chat_thinking}
                    copyLabel={t.chat_copy}
                    copiedLabel={t.chat_copied}
                    regenerateLabel={t.chat_regenerate}
                    onCopy={() => handleCopy(response, 'active')}
                    onRegenerate={isSending ? undefined : () => handleRegenerate()}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* === Footer ========================================================= */}
        <div className="titlebar-drag flex flex-shrink-0 items-center justify-between gap-3 border-t border-gray-100 bg-white/80 px-3 py-2 text-sm">
          <button
            type="button"
            onClick={handleOpenSettings}
            className="titlebar-no-drag group inline-flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
            title={hasKey ? 'Change model in Settings' : t.chat_error_open_settings}
          >
            <span
              className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${
                hasKey
                  ? 'bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.15)]'
                  : 'bg-amber-400'
              }`}
              aria-hidden
            />
            <ProviderIcon provider={selectedProvider} size={14} />
            <span className="truncate text-[12px] font-medium tracking-tight text-gray-700">
              / {modelLabel}
            </span>
            <span
              className="hidden items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-600 sm:inline-flex"
              title={t.chat_smart_thinking_hint}
            >
              <SparklesIcon className="h-3 w-3" />
              <span>{t.chat_smart_thinking_badge}</span>
            </span>
            {turnCount > 1 && (
              <span className="ml-1 hidden text-[11px] text-gray-400 sm:inline">
                · {turnCount} turns
              </span>
            )}
          </button>

          <div className="titlebar-no-drag flex flex-shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => handleCopy(response, 'footer')}
              disabled={!response.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
            >
              {copiedKey === 'footer' ? (
                <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <CopyIcon className="h-3.5 w-3.5" />
              )}
              <span>{copiedKey === 'footer' ? t.chat_copied : t.chat_copy}</span>
            </button>

            <span className="mx-0.5 h-4 w-px bg-gray-200" aria-hidden />

            <button
              type="button"
              onClick={handleOpenInChat}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
            >
              <span>{t.ai_chat_popup_open_in_chat}</span>
              <ArrowRightIcon className="h-3 w-3" />
              <span className="ml-1 hidden items-center gap-1 sm:inline-flex">
                <KeyCap>{primaryModifierKey}</KeyCap>
                <KeyCap>↵</KeyCap>
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

/** Vertically-centered empty/info container used in multiple states. */
function EmptyContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 text-center">
      {children}
    </div>
  )
}

/** Per-card action bar (Copy + Regenerate) — used by both QAEntry and ActiveQACard. */
function CardActions({
  isCopied,
  onCopy,
  onRegenerate,
  copyLabel,
  copiedLabel,
  regenerateLabel,
  copyDisabled,
}: {
  isCopied: boolean
  onCopy: () => void
  onRegenerate?: () => void
  copyLabel: string
  copiedLabel: string
  regenerateLabel: string
  copyDisabled?: boolean
}) {
  return (
    <div className="titlebar-no-drag flex items-center justify-end gap-1 border-t border-gray-100 bg-gray-50/40 px-3 py-1.5">
      <button
        type="button"
        onClick={onCopy}
        disabled={copyDisabled}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-white hover:text-gray-800 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
        title={copyLabel}
      >
        {isCopied ? (
          <CheckIcon className="h-3 w-3 text-emerald-500" />
        ) : (
          <CopyIcon className="h-3 w-3" />
        )}
        <span>{isCopied ? copiedLabel : copyLabel}</span>
      </button>
      <button
        type="button"
        onClick={onRegenerate}
        disabled={!onRegenerate}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-white hover:text-blue-600 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
        title={regenerateLabel}
      >
        <RefreshIcon className="h-3 w-3" />
        <span>{regenerateLabel}</span>
      </button>
    </div>
  )
}

/** One finalized Q&A pair from history — Q + A inside a single bordered card. */
function QAEntry({
  question,
  answer,
  muted,
  isCopied,
  onCopy,
  onRegenerate,
  copyLabel,
  copiedLabel,
  regenerateLabel,
}: {
  question: string
  answer: string
  muted?: boolean
  isCopied: boolean
  onCopy: () => void
  onRegenerate?: () => void
  copyLabel: string
  copiedLabel: string
  regenerateLabel: string
}) {
  return (
    <div
      className={`titlebar-no-drag overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm shadow-gray-900/5
                  ${muted ? 'opacity-80' : ''}`}
    >
      <div className="flex items-start gap-2 border-b border-gray-100 bg-gray-50/60 px-5 py-2.5 text-[12px] leading-5 text-gray-500">
        <span className="mt-0.5 inline-flex h-4 items-center rounded-md bg-gray-100 px-1.5 font-semibold uppercase tracking-wider text-[10px] text-gray-500">
          Q
        </span>
        <p className="min-w-0 flex-1 select-text break-words">{question}</p>
      </div>
      <div className="px-5 py-4">
        <MarkdownText text={answer} className="text-[15px] leading-7 text-gray-800" />
      </div>
      <CardActions
        isCopied={isCopied}
        onCopy={onCopy}
        onRegenerate={onRegenerate}
        copyLabel={copyLabel}
        copiedLabel={copiedLabel}
        regenerateLabel={regenerateLabel}
        copyDisabled={!answer.trim()}
      />
    </div>
  )
}

/** Active Q&A — same one-card layout as QAEntry but with Thinking / streaming state. */
function ActiveQACard({
  question,
  response,
  smartStep,
  isThinking,
  error,
  isSending,
  isCopied,
  smartThinkingLabel,
  thinkingLabel,
  copyLabel,
  copiedLabel,
  regenerateLabel,
  onCopy,
  onRegenerate,
}: {
  question: string
  response: string
  smartStep: SmartStep | null
  isThinking: boolean
  error: string | null
  isSending: boolean
  isCopied: boolean
  smartThinkingLabel: string
  thinkingLabel: string
  copyLabel: string
  copiedLabel: string
  regenerateLabel: string
  onCopy: () => void
  onRegenerate?: () => void
}) {
  // Actions are only useful once we have something to copy or once streaming
  // has finished (so users don't accidentally cancel a live answer).
  const showActions = Boolean(response.trim() || error) && !isSending

  return (
    <div className="titlebar-no-drag flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm shadow-gray-900/5">
      <div className="flex items-start gap-2 border-b border-gray-100 bg-gray-50/60 px-5 py-2.5 text-[12px] leading-5 text-gray-500">
        <span className="mt-0.5 inline-flex h-4 items-center rounded-md bg-gray-100 px-1.5 font-semibold uppercase tracking-wider text-[10px] text-gray-500">
          Q
        </span>
        <p className="min-w-0 flex-1 select-text break-words">{question}</p>
      </div>

      <div className="min-h-0 flex-1 px-5 py-4">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50/80 px-3 py-2.5">
            <p className="text-sm leading-6 text-red-700">{error}</p>
          </div>
        ) : isThinking ? (
          <div className="space-y-3">
            {/* Phase indicator:
             *   • smart step running → "Smart Thinking…" pill (replaces normal Thinking label)
             *   • otherwise          → plain "Thinking…" label (initial decide phase or
             *                          the gap between step completion and answer streaming)
             */}
            {smartStep?.status === 'running' ? (
              <SmartThinkingStep step={smartStep} badgeLabel={smartThinkingLabel} />
            ) : (
              <ThinkingLabel label={thinkingLabel} />
            )}
            <div className="space-y-2.5 pt-1">
              <div className="h-2 w-3/4 animate-pulse rounded-full bg-gray-200/80" />
              <div className="h-2 w-11/12 animate-pulse rounded-full bg-gray-200/80" />
              <div className="h-2 w-2/5 animate-pulse rounded-full bg-gray-200/80" />
            </div>
          </div>
        ) : response ? (
          <MarkdownText text={response} className="text-[15px] leading-7 text-gray-800" />
        ) : null}
      </div>

      {showActions && (
        <CardActions
          isCopied={isCopied}
          onCopy={onCopy}
          onRegenerate={onRegenerate}
          copyLabel={copyLabel}
          copiedLabel={copiedLabel}
          regenerateLabel={regenerateLabel}
          copyDisabled={!response.trim()}
        />
      )}
    </div>
  )
}

/**
 * Smart Thinking pill — the elevated cousin of ThinkingLabel. Same pill shape
 * so the transition between "Thinking…" and "Smart Thinking…" is just a tone
 * shift; this variant adds an indigo→sky gradient with a slow shimmer sweep
 * to communicate that the AI escalated to web grounding. Error states fall
 * back to a calm red treatment without losing the pill silhouette.
 */
function SmartThinkingStep({
  step,
  badgeLabel,
}: {
  step: SmartStep
  badgeLabel: string
}) {
  const isRunning = step.status === 'running'
  const isError = step.status === 'error'

  // Tooltip carries the underlying detail for users who want it, but the
  // visible UI never shows search queries / sources / reasoning inline.
  const tooltip = isError ? (step.content || step.label || badgeLabel) : badgeLabel

  if (isError) {
    return (
      <span
        className="inline-flex items-center gap-2 rounded-full border border-red-200/80 bg-red-50
                   px-3 py-1 text-[12.5px] font-semibold text-red-700 shadow-sm shadow-red-900/[0.04] select-none"
        title={tooltip}
        role="status"
      >
        <SparklesIcon className="h-3.5 w-3.5" />
        <span>{badgeLabel}</span>
      </span>
    )
  }

  return (
    <span
      className="relative inline-flex items-center gap-2 overflow-hidden rounded-full
                 border border-indigo-200/70 bg-gradient-to-r from-indigo-50 via-sky-50 to-violet-50
                 px-3 py-1 text-[12.5px] font-semibold text-indigo-700 shadow-sm shadow-indigo-900/[0.05] select-none"
      title={tooltip}
      role="status"
      aria-live="polite"
    >
      {/* Subtle shimmer wash — animated only while the step is running. */}
      {isRunning && (
        <span
          className="thinking-shimmer pointer-events-none absolute inset-0 bg-gradient-to-r
                     from-transparent via-white/55 to-transparent"
          aria-hidden
        />
      )}
      <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
        {isRunning && (
          <span
            className="thinking-glow absolute inset-0 rounded-full bg-indigo-400/35 blur-[3px]"
            aria-hidden
          />
        )}
        <SparklesIcon className="relative h-3.5 w-3.5 text-indigo-500" />
      </span>
      <span className="relative tracking-[0.01em]">{badgeLabel}</span>
      {isRunning && (
        <span className="relative">
          <BouncingDots tone="blue" />
        </span>
      )}
    </span>
  )
}


