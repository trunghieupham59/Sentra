
/**
 * useTranslate — encapsulates all business logic for the Translate page.
 *
 * Extracted from TranslatePage to separate concerns:
 *  - Text & image translation (including streaming phonetic pass)
 *  - Image attachment management (file pick, paste, drag-drop)
 *  - Auto-translate debounce + re-translate on lang/model/style change
 *  - Background language detection for swap button
 *  - Rewrite and copy actions
 *  - TTS and voice input integration
 *
 * TranslatePage owns only scroll-sync refs/effect and pure JSX render.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ImageAttachment } from '../components/translate/ImageTranslator'
import { MAX_TRANSLATE_IMAGE_DIMENSION } from '../constants/image'
import { DETECT_LANG_MAX_CHARS } from '../constants/providers'
import { COPY_FEEDBACK_DURATION_MS, IMAGE_AUTO_TRANSLATE_DELAY_MS } from '../constants/ui'
import { translationService } from '../services/translationService'
import { useAppStore, useT } from '../store/useAppStore'
import type { ImageTextRegion, PhoneticMode } from '../types'
import { renderTranslatedRegions } from '../utils/canvas'
import { createClientId } from '../utils/id'
import { extractImageFromClipboard, resizeImageFile } from '../utils/imageUtils'
import { estimateUsageCost } from '../utils/usageCost'
import { useTTS } from './useTTS'
import { useVoiceInput } from './useVoiceInput'

/**
 * Sentinel value set on translatedText when a Gemini image-edit result is shown.
 * Non-empty so action buttons conditionally appear, but those buttons check
 * `editedImageUrl` first — so the user cannot actually copy or speak this value.
 */
export const IMAGE_TRANSLATED_SENTINEL = '✓'

const AUTO_HISTORY_IDLE_MS = 60_000

type TranslateTrigger = 'manual' | 'auto'

interface AutoHistoryDraft {
  id: string
  contextKey: string
  sourceText: string
  timestamp: number
}

function createHistoryId(timestamp = Date.now()) {
  return createClientId('history', timestamp)
}

function getCommonPrefixLength(a: string, b: string) {
  let index = 0
  while (index < a.length && index < b.length && a[index] === b[index]) index++
  return index
}

function isLikelySameSourceDraft(previousText: string, nextText: string) {
  const previous = previousText.trim()
  const next = nextText.trim()
  if (!previous || !next) return false
  if (previous === next || previous.startsWith(next) || next.startsWith(previous)) return true

  const shorterLength = Math.min(previous.length, next.length)
  if (shorterLength < 12) return false

  return getCommonPrefixLength(previous, next) / shorterLength >= 0.6
}

function buildHistoryContextKey(
  provider: string,
  model: string,
  sourceLang: string,
  targetLang: string,
  style: string
) {
  return `${provider}|${model}|${sourceLang}|${targetLang}|${style}`
}

function shouldReuseAutoHistoryDraft(
  draft: AutoHistoryDraft,
  nextSourceText: string,
  nextContextKey: string,
  timestamp: number
) {
  if (timestamp - draft.timestamp > AUTO_HISTORY_IDLE_MS) return false
  if (draft.sourceText.trim() === nextSourceText.trim()) return true
  if (draft.contextKey !== nextContextKey) return false
  return isLikelySameSourceDraft(draft.sourceText, nextSourceText)
}

export function useTranslate() {
  const {
    sourceText, translatedText, phoneticText, sourceLang, targetLang,
    isTranslating, translateError,
    selectedProvider, selectedModels, autoTranslate, autoTranslateDelay, keyStatus, phoneticMode, translationStyle,
    ttsMode, ttsVoice,
    setSourceText, setTranslatedText, setPhoneticText, setTargetLang,
    setIsTranslating, setTranslateError, setActivePage, setPhoneticMode, setTranslationStyle, setAutoTranslate, addHistory, upsertHistory,
    recordUsageCost, recordModelUsage,
    swapLanguages,
  } = useAppStore()
  const t = useT()

  // Derived boolean — true when any phonetic mode is active
  const showFurigana = phoneticMode !== 'off'

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeTranslateRequestIdRef = useRef<string | null>(null)
  /**
   * Monotonically-increasing counter that identifies the "current" translation job.
   * Incremented each time a new job starts OR when the user cancels (clears content/image).
   * Every async step checks its captured generation against the current value before
   * touching state — if they differ the job was cancelled and results are silently dropped.
   */
  const translateGenerationRef = useRef(0)
  const phoneticRequestRef = useRef(0)
  const autoHistoryDraftRef = useRef<AutoHistoryDraft | null>(null)
  const hasKey = selectedProvider === 'local' || keyStatus[selectedProvider]
  const charCount = sourceText.length

  /**
   * True when the current error is due to a missing or invalid API key.
   * Computed once here instead of via fragile substring matching in the view.
   */
  const isApiKeyError = !!(translateError && (
    !hasKey ||
    translateError === t.translate_error_no_key ||
    translateError.toLowerCase().includes('api key') ||
    translateError.toLowerCase().includes('apikey') ||
    translateError.toLowerCase().includes('unauthorized') ||
    translateError.toLowerCase().includes('invalid key')
  ))

  const [copied, setCopied] = useState(false)
  const [isRewriting, setIsRewriting] = useState<'source' | 'translated' | null>(null)
  /** Shown when image translation silently switched to a different model/provider */
  const [imageSwitchNotice, setImageSwitchNotice] = useState<{ model: string; provider: string } | null>(null)
  /** Language detected by AI from the last source text — drives the swap button */
  const [detectedSourceLang, setDetectedSourceLang] = useState<string | null>(null)
  /** True while background language detection is in progress */
  const [isDetectingLang, setIsDetectingLang] = useState(false)

  // TTS — delegated to useTTS hook (Web Audio API + OS synthesis fallback, no console.log)
  const { speakingPanel, speakLoading, handleSpeak, stopSpeak } = useTTS({ ttsMode, ttsVoice })

  // ── Real-time model-switch notice from main process ──
  // Subscribe once on mount — main process emits 'image:model-switched' immediately
  // before the fallback translation starts, so the user sees the warning right away.
  useEffect(() => {
    if (!window.api?.onImageModelSwitched) return
    const cleanup = window.api.onImageModelSwitched(({ model: m, provider: p }) => {
      setImageSwitchNotice({ model: m, provider: p })
    })
    return cleanup
  }, [])

  // Image attachment state
  const [imageAttachment, setImageAttachment] = useState<ImageAttachment | null>(null)
  // Regions returned by AI when translating an image (fallback approach)
  const [imageRegions, setImageRegions] = useState<ImageTextRegion[] | null>(null)
  // Edited image returned directly by Gemini image-edit model
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null)
  // Drag-over state for source panel drop zone visual feedback
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  // Ref to hidden file input — triggered when user clicks the image icon
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Stable ref so lang-change effect can check imageAttachment without re-subscribing
  const imageAttachmentRef = useRef(imageAttachment)
  const translatedTextRef = useRef(translatedText)
  const isTranslatingRef = useRef(isTranslating)
  const phoneticModeRef = useRef(phoneticMode)
  imageAttachmentRef.current = imageAttachment
  translatedTextRef.current = translatedText
  isTranslatingRef.current = isTranslating
  phoneticModeRef.current = phoneticMode

  /** Process an image File: resize, convert to base64, attach to translate area */
  const processImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setTranslateError(t.image_translate_type_error)
      return
    }
    try {
      const result = await resizeImageFile(file, MAX_TRANSLATE_IMAGE_DIMENSION, { useQualityLoop: true })
      const attachment: ImageAttachment = {
        base64:         result.base64,
        mimeType:       result.mimeType,
        width:          result.width,
        height:         result.height,
        previewDataUrl: result.previewUrl,
        fileName:       result.fileName,
      }
      setImageAttachment(attachment)
      setImageRegions(null)
      setEditedImageUrl(null)
      setTranslatedText('')
      setPhoneticText('')
      setTranslateError(null)
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : 'Failed to process image')
    }
  }, [setTranslateError, setTranslatedText, setPhoneticText, t])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processImageFile(file)
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }, [processImageFile])

  // ── Paste image from clipboard into the source panel ──
  const handleSourcePanelPaste = useCallback((e: React.ClipboardEvent<HTMLElement>) => {
    const file = extractImageFromClipboard(e.clipboardData)
    if (!file) return
    e.preventDefault()
    processImageFile(file)
  }, [processImageFile])

  const handleSourcePanelDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingOver(true)
  }, [])

  const handleSourcePanelDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only clear when leaving the panel itself, not a child element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false)
    }
  }, [])

  const handleSourcePanelDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processImageFile(file)
  }, [processImageFile])

  // ── Voice input — shared hook (same logic as ChatPage) ──
  const {
    isVoiceActive,
    isVoiceInterim,
    handleVoiceRecordingChange,
    handleVoiceTranscript,
    resetVoicePrefix,
  } = useVoiceInput({ currentText: sourceText, onTextChange: setSourceText })

  /**
   * Triggers background language detection for `text` (best-effort, non-blocking).
   * On success → sets `detectedSourceLang`; on failure → degrades gracefully.
   * The swap button remains functional either way — it just won't auto-set target
   * language if detection fails.
   *
   * All values are passed as parameters (not closed over) so this callback never
   * needs to be recreated — stable empty-dep memoisation is safe here.
   */
  const detectLanguageInBackground = useCallback((
    text: string,
    generation: number,
    provider: string,
    model: string,
  ) => {
    setIsDetectingLang(true)
    translationService.detectLanguage({ provider, model, text: text.slice(0, DETECT_LANG_MAX_CHARS) })
      .then((res) => {
        if (translateGenerationRef.current !== generation) return
        if (res.success && res.lang) setDetectedSourceLang(res.lang)
      })
      .catch((_err) => {
        // Detection is best-effort — a failure here means the swap button won't
        // automatically change the target language, but it will still move the
        // translated text into the source panel correctly.
      })
      .finally(() => {
        if (translateGenerationRef.current === generation) setIsDetectingLang(false)
      })
  }, []) // All values are passed as params → no external deps needed

  const cancelActiveTranslation = useCallback(() => {
    const requestId = activeTranslateRequestIdRef.current
    if (!requestId) return
    void window.api.cancelTranslate?.({ requestId })
    activeTranslateRequestIdRef.current = null
  }, [])

  const recordTranslationHistory = useCallback((trigger: TranslateTrigger, plainText: string) => {
    const timestamp = Date.now()
    const model = selectedModels[selectedProvider]
    const contextKey = buildHistoryContextKey(selectedProvider, model, sourceLang, targetLang, translationStyle)
    const cost = estimateUsageCost({
      feature: 'translate',
      provider: selectedProvider,
      model,
      inputText: sourceText,
      outputText: plainText,
    })
    recordUsageCost(cost)
    const baseItem = {
      timestamp,
      provider: selectedProvider,
      model,
      sourceLang,
      targetLang,
      translationStyle,
      sourceText,
      translatedText: plainText,
      cost,
    }

    if (trigger === 'auto') {
      const existingDraft = autoHistoryDraftRef.current
      const id = existingDraft && shouldReuseAutoHistoryDraft(existingDraft, sourceText, contextKey, timestamp)
        ? existingDraft.id
        : createHistoryId(timestamp)

      upsertHistory({ ...baseItem, id })
      autoHistoryDraftRef.current = { id, contextKey, sourceText, timestamp }
      return
    }

    addHistory({ ...baseItem, id: createHistoryId(timestamp) })
    autoHistoryDraftRef.current = null
  }, [addHistory, upsertHistory, recordUsageCost, selectedProvider, selectedModels, sourceLang, targetLang, translationStyle, sourceText])

  const generatePhoneticText = useCallback((
    text: string,
    mode: PhoneticMode,
    ownerGeneration?: number,
  ) => {
    const requestId = ++phoneticRequestRef.current

    if (mode === 'off' || !text.trim() || text === IMAGE_TRANSLATED_SENTINEL) {
      setPhoneticText('')
      return
    }

    if (!hasKey) {
      setTranslateError(t.translate_error_no_key)
      return
    }

    setPhoneticText('')
    void translationService.translate({
      provider: selectedProvider,
      model: selectedModels[selectedProvider],
      sourceText: text,
      sourceLang: targetLang,
      targetLang,
      translationStyle,
      showFurigana: true,
      phoneticOnly: true,
      phoneticMode: mode,
    })
      .then((res) => {
        if (phoneticRequestRef.current !== requestId) return
        if (ownerGeneration !== undefined && translateGenerationRef.current !== ownerGeneration) return
        if (res.success && res.translatedText) setPhoneticText(res.translatedText)
      })
      .catch(() => {})
  }, [
    hasKey,
    selectedProvider,
    selectedModels,
    targetLang,
    translationStyle,
    setPhoneticText,
    setTranslateError,
    t.translate_error_no_key,
  ])

  const handlePhoneticModeChange = useCallback((mode: PhoneticMode) => {
    phoneticModeRef.current = mode
    setPhoneticMode(mode)

    if (mode === 'off') {
      phoneticRequestRef.current++
      setPhoneticText('')
      return
    }

    if (isTranslatingRef.current) {
      setPhoneticText('')
      return
    }

    const currentTranslation = translatedTextRef.current
    if (!currentTranslation || currentTranslation === IMAGE_TRANSLATED_SENTINEL || imageAttachmentRef.current) {
      setPhoneticText('')
      return
    }

    generatePhoneticText(currentTranslation, mode)
  }, [generatePhoneticText, setPhoneticMode, setPhoneticText])

  const runTranslate = useCallback(async (trigger: TranslateTrigger) => {
    if (!hasKey) { setTranslateError(t.translate_error_no_key); return }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    cancelActiveTranslation()
    const generation = ++translateGenerationRef.current
    const requestId = createClientId('translate')
    activeTranslateRequestIdRef.current = requestId
    setIsTranslating(true)
    setTranslateError(null)
    setImageSwitchNotice(null)

    // ── IMAGE mode: translate the attached image ──────────────────────────
    if (imageAttachment) {
      try {
        const result = await window.api.translateImage({
          provider: selectedProvider,
          model: selectedModels[selectedProvider],
          requestId,
          imageBase64: imageAttachment.base64,
          imageMimeType: imageAttachment.mimeType,
          sourceLang,
          targetLang,
        })
        // Bail out silently if the user cancelled while we were waiting
        if (translateGenerationRef.current !== generation) return
        if (result.success && result.editedImageBase64) {
          // ── Gemini image-edit: show the directly edited image ──
          const mimeType = imageAttachment.mimeType
          setEditedImageUrl(`data:${mimeType};base64,${result.editedImageBase64}`)
          setTranslatedText(IMAGE_TRANSLATED_SENTINEL) // non-empty so conditional buttons render
          setImageRegions(null)
        } else if (result.success && result.regions && result.regions.length > 0) {
          // ── Fallback (Claude/OpenAI): compile translated text from regions ──
          const text = result.regions.map(r => r.translatedText).filter(Boolean).join('\n')
          setTranslatedText(text)
          setImageRegions(result.regions)
          setEditedImageUrl(null)
        } else if (result.success) {
          setTranslatedText('')
          setTranslateError('No text found in image')
        } else {
          setTranslateError(result.error || 'Image translation failed')
        }

        // Show notice if system auto-switched to a different model/provider
        if (result.success && (result.usedModel || result.usedProvider)) {
          setImageSwitchNotice({
            model: result.usedModel ?? selectedModels[selectedProvider],
            provider: result.usedProvider ?? selectedProvider,
          })
        } else {
          setImageSwitchNotice(null)
        }
      } catch (err) {
        if (translateGenerationRef.current !== generation) return
        setTranslateError(err instanceof Error ? err.message : 'Unexpected error')
      } finally {
        if (translateGenerationRef.current === generation) setIsTranslating(false)
        if (translateGenerationRef.current === generation) activeTranslateRequestIdRef.current = null
      }
      return
    }

    // ── TEXT mode: normal translation ─────────────────────────────────────
    // Clear stale detection result whenever a new translation starts
    setDetectedSourceLang(null)
    setIsDetectingLang(false)
    if (!sourceText.trim()) {
      activeTranslateRequestIdRef.current = null
      setIsTranslating(false)
      return
    }
    try {
      const baseParams = {
        provider: selectedProvider,
        model: selectedModels[selectedProvider],
        requestId,
        sourceText,
        sourceLang,
        targetLang,
        translationStyle,
      }

      const plainResult = await translationService.translate({ ...baseParams, showFurigana: false })

      // Bail out silently if the user cancelled while we were waiting
      if (translateGenerationRef.current !== generation) return

      if (plainResult.success && plainResult.translatedText) {
        const plainText = plainResult.translatedText
        setTranslatedText(plainText)
        setPhoneticText('')   // clear stale phonetic — phonetic pass below will repopulate it
        setIsTranslating(false)

        recordTranslationHistory(trigger, plainText)
        recordModelUsage(selectedProvider, selectedModels[selectedProvider])

        // Second pass: add phonetic output for the mode that is active when the
        // translation finishes. This also supports toggling phonetic on while a
        // translation request is still in flight.
        const modeAtCompletion = phoneticModeRef.current
        if (modeAtCompletion !== 'off') generatePhoneticText(plainText, modeAtCompletion, generation)

        // Background language detection — runs in parallel with phonetic pass.
        // Identifies the source language so the swap button can set the correct target.
        detectLanguageInBackground(sourceText, generation, selectedProvider, selectedModels[selectedProvider])
      } else {
        setTranslateError(plainResult.error || 'Translation failed')
      }
    } catch (err) {
      if (translateGenerationRef.current !== generation) return
      setTranslateError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      if (translateGenerationRef.current === generation) setIsTranslating(false)
      if (translateGenerationRef.current === generation) activeTranslateRequestIdRef.current = null
    }
  }, [imageAttachment, sourceText, sourceLang, targetLang, selectedProvider, selectedModels,
       hasKey, translationStyle,
       setIsTranslating, setTranslateError, setTranslatedText, setPhoneticText, t, detectLanguageInBackground, recordTranslationHistory, generatePhoneticText, cancelActiveTranslation])

  const handleTranslate = useCallback(() => runTranslate('manual'), [runTranslate])

  /** Download the translated image (original + text regions overlaid) */
  const handleDownloadTranslatedImage = useCallback(async () => {
    if (!imageAttachment || !imageRegions) return
    try {
      const canvas  = document.createElement('canvas')
      canvas.width  = imageAttachment.width
      canvas.height = imageAttachment.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const img = new Image()
      img.src = imageAttachment.previewDataUrl
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Failed to load image'))
      })
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      renderTranslatedRegions(ctx, imageRegions, canvas.width, canvas.height)
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `translated_${Date.now()}.png`
      a.click()
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : 'Failed to download image')
    }
  }, [imageAttachment, imageRegions, setTranslateError])

  /** Download the Gemini-edited image directly */
  const handleDownloadEditedImage = useCallback(() => {
    if (!editedImageUrl) return
    const a = document.createElement('a')
    a.href = editedImageUrl
    a.download = `translated_${Date.now()}.png`
    a.click()
  }, [editedImageUrl])

  // Stable refs for effects below (avoids stale closures without re-triggering effects)
  const styleInitRef = useRef(false)
  const langInitRef = useRef(false)
  const modelInitRef = useRef(false)
  const runTranslateRef = useRef(runTranslate)
  const sourceTextRef = useRef(sourceText)
  const autoTranslateRef = useRef(autoTranslate)
  runTranslateRef.current = runTranslate
  sourceTextRef.current = sourceText
  autoTranslateRef.current = autoTranslate

  useLayoutEffect(() => {
    styleInitRef.current = false
    langInitRef.current = false
    modelInitRef.current = false
  }, [])

  useEffect(() => {
    if (!autoTranslate || !sourceText.trim()) autoHistoryDraftRef.current = null
  }, [autoTranslate, sourceText])

  // Auto-translate debounce (only when autoTranslate is enabled)
  // Skip while voice is recording — interim results would spam the API.
  // Use runTranslateRef to avoid the infinite loop caused by runTranslate changing when
  // isTranslating flips true→false after each translation.
  useEffect(() => {
    if (!autoTranslate || !sourceText.trim() || isVoiceActive) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { runTranslateRef.current('auto') }, autoTranslateDelay)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [autoTranslate, autoTranslateDelay, sourceText, isVoiceActive])

  // Auto-translate when an image is attached — image has no text to debounce on
  useEffect(() => {
    if (!autoTranslate || !imageAttachment) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { runTranslateRef.current('auto') }, IMAGE_AUTO_TRANSLATE_DELAY_MS)  // HC-03
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [autoTranslate, imageAttachment])

  // Re-translate when style changes (skip first render, skip manual mode)
  // biome-ignore lint/correctness/useExhaustiveDependencies: translationStyle is the intentional trigger; runTranslate is accessed via a stable ref
  useEffect(() => {
    if (!styleInitRef.current) { styleInitRef.current = true; return }
    if (!autoTranslateRef.current) return
    runTranslateRef.current('auto')
  }, [translationStyle])

  // Re-translate when target or source language changes (skip first render, skip manual mode)
  // Also fires when image is attached — imageAttachmentRef accessed via stable ref
  // biome-ignore lint/correctness/useExhaustiveDependencies: lang changes are the triggers; sourceText/imageAttachment/runTranslate accessed via stable refs
  useEffect(() => {
    if (!langInitRef.current) { langInitRef.current = true; return }
    if (!sourceTextRef.current.trim() && !imageAttachmentRef.current) return
    if (isTranslatingRef.current) {
      runTranslateRef.current(autoTranslateRef.current ? 'auto' : 'manual')
      return
    }
    if (!autoTranslateRef.current) return
    runTranslateRef.current('auto')
  }, [targetLang, sourceLang])

  // Re-translate when provider or model changes (skip first render, skip manual mode)
  // biome-ignore lint/correctness/useExhaustiveDependencies: provider/model changes are the triggers; runTranslate via stable ref
  useEffect(() => {
    if (!modelInitRef.current) { modelInitRef.current = true; return }
    if (!autoTranslateRef.current) return
    if (!sourceTextRef.current.trim() && !imageAttachmentRef.current) return
    runTranslateRef.current('auto')
  }, [selectedProvider, selectedModels[selectedProvider]])

  /** Swap translation panels — puts translated text into source, sets detected language as target. */
  const handleSwapLanguages = useCallback(() => {
    if (!translatedText || translatedText === IMAGE_TRANSLATED_SENTINEL || imageAttachment) return
    translateGenerationRef.current++
    cancelActiveTranslation()
    stopSpeak()
    // Delegates all text/lang state to the store. Passes detectedSourceLang so the store
    // can use it as the new targetLang instead of falling back to sourceLang/'ja'.
    swapLanguages(detectedSourceLang ?? undefined)
    setTranslateError(null)
    setIsTranslating(false)
    setDetectedSourceLang(null)
    setIsDetectingLang(false)
  }, [translatedText, detectedSourceLang, imageAttachment, stopSpeak, swapLanguages,
      setTranslateError, setIsTranslating, cancelActiveTranslation])

  const handleCopy = async () => {
    const textToCopy = showFurigana && phoneticText ? phoneticText : translatedText
    if (!textToCopy) return
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION_MS)  // HC-03
    } catch (_err) {
      setTranslateError(t.translate_error_copy)
    }
  }

  // Rewrite: make text more natural in its own language without changing meaning
  const handleRewrite = useCallback(async (panel: 'source' | 'translated') => {
    if (isRewriting) return
    if (!hasKey) { setTranslateError(t.translate_error_no_key); return }
    const text = panel === 'source' ? sourceText : translatedText
    const lang = panel === 'source'
      ? (sourceLang === 'auto' ? 'the same language as the input text' : sourceLang)
      : targetLang
    if (!text.trim()) return
    setIsRewriting(panel)
    try {
      const result = await translationService.rewriteText({
        provider: selectedProvider,
        model: selectedModels[selectedProvider],
        text,
        lang,
        translationStyle,
      })
      if (result.success && result.translatedText) {
        if (panel === 'source') {
          setSourceText(result.translatedText)
          // Clear stale phonetic immediately — auto-translate will regenerate it after the
          // new source text is translated; prevents old phonetic showing for new content.
          setPhoneticText('')
        } else {
          const rewrittenText = result.translatedText
          setTranslatedText(rewrittenText)
          setPhoneticText('')
          const modeAtRewrite = phoneticModeRef.current
          if (modeAtRewrite !== 'off') generatePhoneticText(rewrittenText, modeAtRewrite)
        }
      }
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : t.translate_error_rewrite)
    } finally {
      setIsRewriting(null)
    }
  }, [isRewriting, hasKey, sourceText, translatedText, sourceLang, targetLang, translationStyle,
      selectedProvider, selectedModels, generatePhoneticText,
      setSourceText, setTranslatedText, setPhoneticText, setTranslateError, t])

  /** Handles MarkdownEditor source text changes */
  const handleSourceChange = useCallback((val: string) => {
    setSourceText(val)
    stopSpeak()
    if (!val.trim()) {
      setTranslatedText('')
      setPhoneticText('')
    }
    // User edited manually while voice is active — reset prefix so next
    // transcript chunk replaces the field content, not appends to stale prefix
    if (isVoiceActive) resetVoicePrefix()
  }, [setSourceText, stopSpeak, setTranslatedText, setPhoneticText, isVoiceActive, resetVoicePrefix])

  /** Clears the source panel (ClearButton) — cancels any in-flight translation */
  const handleClearSource = useCallback(() => {
    translateGenerationRef.current++
    cancelActiveTranslation()
    setIsTranslating(false)
    stopSpeak()
    setSourceText('')
    setImageAttachment(null)
    setImageRegions(null)
    setEditedImageUrl(null)
    setTranslatedText('')
    setPhoneticText('')
    setTranslateError(null)
    setDetectedSourceLang(null)
    setIsDetectingLang(false)
    setImageSwitchNotice(null)
  }, [stopSpeak, setIsTranslating, setSourceText, setTranslatedText, setPhoneticText, setTranslateError, cancelActiveTranslation])

  /** Dismisses the current error banner — clears translateError in store */
  const handleDismissError = useCallback(() => {
    setTranslateError(null)
  }, [setTranslateError])

  /** Removes the attached image (ImageAttachmentPreview onRemove) — cancels in-flight job */
  const handleRemoveImage = useCallback(() => {
    translateGenerationRef.current++
    cancelActiveTranslation()
    setIsTranslating(false)
    setImageAttachment(null)
    setImageRegions(null)
    setEditedImageUrl(null)
    setTranslatedText('')
    setPhoneticText('')
    setTranslateError(null)
    setImageSwitchNotice(null)
  }, [setIsTranslating, setTranslatedText, setPhoneticText, setTranslateError, cancelActiveTranslation])

  return {
    // ── Store state (needed by JSX) ─────────────────────────────────────────
    sourceText,
    translatedText,
    phoneticText,
    sourceLang,
    targetLang,
    isTranslating,
    translateError,
    autoTranslate,
    phoneticMode,
    translationStyle,
    keyStatus,
    selectedProvider,
    // ── Store setters (used directly in JSX) ───────────────────────────────
    setTargetLang,
    setActivePage,
    setPhoneticMode: handlePhoneticModeChange,
    setTranslationStyle,
    setAutoTranslate,
    // ── Local state ────────────────────────────────────────────────────────
    copied,
    isRewriting,
    imageSwitchNotice,
    detectedSourceLang,
    isDetectingLang,
    imageAttachment,
    imageRegions,
    editedImageUrl,
    isDraggingOver,
    setImageSwitchNotice,
    // ── Computed ───────────────────────────────────────────────────────────
    charCount,
    isApiKeyError,
    // ── TTS ────────────────────────────────────────────────────────────────
    speakingPanel,
    speakLoading,
    handleSpeak,
    // ── Voice ──────────────────────────────────────────────────────────────
    isVoiceActive,
    isVoiceInterim,
    handleVoiceRecordingChange,
    handleVoiceTranscript,
    // ── Refs ───────────────────────────────────────────────────────────────
    fileInputRef,
    // ── Handlers ───────────────────────────────────────────────────────────
    handleTranslate,
    handleRewrite,
    handleSwapLanguages,
    handleCopy,
    handleDismissError,
    handleDownloadTranslatedImage,
    handleDownloadEditedImage,
    handleSourceChange,
    handleClearSource,
    handleRemoveImage,
    handleFileInputChange,
    handleSourcePanelPaste,
    handleSourcePanelDragOver,
    handleSourcePanelDragLeave,
    handleSourcePanelDrop,
  }
}
