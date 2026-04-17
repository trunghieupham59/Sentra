
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
import type { ImageAttachment } from '../components/ImageTranslator'
import { MAX_TRANSLATE_IMAGE_DIMENSION } from '../constants/image'
import { DETECT_LANG_MAX_CHARS } from '../constants/providers'
import { COPY_FEEDBACK_DURATION_MS, IMAGE_AUTO_TRANSLATE_DELAY_MS } from '../constants/ui'
import { translationService } from '../services/translationService'
import { useAppStore, useT } from '../store/useAppStore'
import type { ImageTextRegion } from '../types'
import { renderTranslatedRegions } from '../utils/canvas'
import { extractImageFromClipboard, resizeImageFile } from '../utils/imageUtils'
import { useTTS } from './useTTS'
import { useVoiceInput } from './useVoiceInput'

/**
 * Sentinel value set on translatedText when a Gemini image-edit result is shown.
 * Non-empty so action buttons conditionally appear, but those buttons check
 * `editedImageUrl` first — so the user cannot actually copy or speak this value.
 */
export const IMAGE_TRANSLATED_SENTINEL = '✓'

export function useTranslate() {
  const {
    sourceText, translatedText, phoneticText, sourceLang, targetLang,
    isTranslating, translateError,
    selectedProvider, selectedModels, autoTranslate, autoTranslateDelay, keyStatus, showFurigana, translationStyle,
    ttsVoice,
    setSourceText, setTranslatedText, setPhoneticText, setTargetLang,
    setIsTranslating, setTranslateError, setActivePage, setShowFurigana, setTranslationStyle, setAutoTranslate, addHistory,
    swapLanguages,
  } = useAppStore()
  const t = useT()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /**
   * Monotonically-increasing counter that identifies the "current" translation job.
   * Incremented each time a new job starts OR when the user cancels (clears content/image).
   * Every async step checks its captured generation against the current value before
   * touching state — if they differ the job was cancelled and results are silently dropped.
   */
  const translateGenerationRef = useRef(0)
  const hasKey = keyStatus[selectedProvider]
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
  const { speakingPanel, speakLoading, handleSpeak, stopSpeak } = useTTS({ ttsVoice })

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
  imageAttachmentRef.current = imageAttachment

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

  const handleTranslate = useCallback(async () => {
    if (!hasKey) { setTranslateError(t.translate_error_no_key); return }
    if (isTranslating) return

    const generation = ++translateGenerationRef.current
    setIsTranslating(true)
    setTranslateError(null)
    setImageSwitchNotice(null)

    // ── IMAGE mode: translate the attached image ──────────────────────────
    if (imageAttachment) {
      try {
        const result = await window.api.translateImage({
          provider: selectedProvider,
          model: selectedModels[selectedProvider],
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
      }
      return
    }

    // ── TEXT mode: normal translation ─────────────────────────────────────
    // Clear stale detection result whenever a new translation starts
    setDetectedSourceLang(null)
    setIsDetectingLang(false)
    if (!sourceText.trim()) { setIsTranslating(false); return }
    try {
      const baseParams = {
        provider: selectedProvider,
        model: selectedModels[selectedProvider],
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

        addHistory({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          provider: selectedProvider,
          model: selectedModels[selectedProvider],
          sourceLang,
          targetLang,
          sourceText,
          translatedText: plainText,
        })

        translationService.translate({ ...baseParams, sourceText: plainText, showFurigana: true, phoneticOnly: true })
          .then((res) => {
            // Also guard the phonetic pass against cancellation
            if (translateGenerationRef.current !== generation) return
            if (res.success && res.translatedText) setPhoneticText(res.translatedText)
          })
          .catch(() => {})

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
    }
  // biome-ignore lint/correctness/useExhaustiveDependencies: detectLanguageInBackground has stable empty-dep memoisation — safe to omit
  }, [imageAttachment, sourceText, sourceLang, targetLang, selectedProvider, selectedModels,
       isTranslating, hasKey, translationStyle, setIsTranslating, setTranslateError,
       setTranslatedText, setPhoneticText, addHistory, t, detectLanguageInBackground])

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
  const handleTranslateRef = useRef(handleTranslate)
  const sourceTextRef = useRef(sourceText)
  const autoTranslateRef = useRef(autoTranslate)
  handleTranslateRef.current = handleTranslate
  sourceTextRef.current = sourceText
  autoTranslateRef.current = autoTranslate

  useLayoutEffect(() => {
    styleInitRef.current = false
    langInitRef.current = false
    modelInitRef.current = false
  }, [])

  // Auto-translate debounce (only when autoTranslate is enabled)
  // Skip while voice is recording — interim results would spam the API.
  // Use handleTranslateRef (already defined below for style effect) to avoid the infinite loop
  // caused by handleTranslate changing when isTranslating flips true→false after each translation.
  useEffect(() => {
    if (!autoTranslate || !sourceText.trim() || isVoiceActive) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { handleTranslateRef.current() }, autoTranslateDelay)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [autoTranslate, autoTranslateDelay, sourceText, isVoiceActive])

  // Auto-translate when an image is attached — image has no text to debounce on
  useEffect(() => {
    if (!imageAttachment) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { handleTranslateRef.current() }, IMAGE_AUTO_TRANSLATE_DELAY_MS)  // HC-03
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [imageAttachment])

  // Re-translate when style changes (skip first render, skip manual mode)
  // biome-ignore lint/correctness/useExhaustiveDependencies: translationStyle is the intentional trigger; handleTranslate is accessed via a stable ref
  useEffect(() => {
    if (!styleInitRef.current) { styleInitRef.current = true; return }
    if (!autoTranslateRef.current) return
    handleTranslateRef.current()
  }, [translationStyle])

  // Re-translate when target or source language changes (skip first render, skip manual mode)
  // Also fires when image is attached — imageAttachmentRef accessed via stable ref
  // biome-ignore lint/correctness/useExhaustiveDependencies: lang changes are the triggers; sourceText/imageAttachment/handleTranslate accessed via stable refs
  useEffect(() => {
    if (!langInitRef.current) { langInitRef.current = true; return }
    if (!autoTranslateRef.current) return
    if (!sourceTextRef.current.trim() && !imageAttachmentRef.current) return
    handleTranslateRef.current()
  }, [targetLang, sourceLang])

  // Re-translate when provider or model changes (skip first render, skip manual mode)
  // biome-ignore lint/correctness/useExhaustiveDependencies: provider/model changes are the triggers; handleTranslate via stable ref
  useEffect(() => {
    if (!modelInitRef.current) { modelInitRef.current = true; return }
    if (!autoTranslateRef.current) return
    if (!sourceTextRef.current.trim() && !imageAttachmentRef.current) return
    handleTranslateRef.current()
  }, [selectedProvider, selectedModels[selectedProvider]])

  /** Swap translation panels — puts translated text into source, sets detected language as target. */
  const handleSwapLanguages = useCallback(() => {
    if (!translatedText || translatedText === IMAGE_TRANSLATED_SENTINEL || imageAttachment) return
    translateGenerationRef.current++
    stopSpeak()
    // Delegates all text/lang state to the store. Passes detectedSourceLang so the store
    // can use it as the new targetLang instead of falling back to sourceLang/'ja'.
    swapLanguages(detectedSourceLang ?? undefined)
    setTranslateError(null)
    setIsTranslating(false)
    setDetectedSourceLang(null)
    setIsDetectingLang(false)
  }, [translatedText, detectedSourceLang, imageAttachment, stopSpeak, swapLanguages,
      setTranslateError, setIsTranslating])

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
          // If phonetic mode is active, regenerate phonetic text for the rewritten content
          if (showFurigana) {
            translationService.translate({
              provider: selectedProvider,
              model: selectedModels[selectedProvider],
              sourceText: rewrittenText,
              sourceLang: targetLang,
              targetLang,
              translationStyle,
              showFurigana: true,
              phoneticOnly: true,
            })
              .then((res) => {
                if (res.success && res.translatedText) setPhoneticText(res.translatedText)
              })
              .catch(() => {})
          }
        }
      }
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : t.translate_error_rewrite)
    } finally {
      setIsRewriting(null)
    }
  }, [isRewriting, hasKey, sourceText, translatedText, sourceLang, targetLang, translationStyle,
      selectedProvider, selectedModels, showFurigana, setSourceText, setTranslatedText, setPhoneticText, setTranslateError, t])

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
    setIsTranslating(false)
    stopSpeak()
    setSourceText('')
    setTranslatedText('')
    setPhoneticText('')
    setTranslateError(null)
    setDetectedSourceLang(null)
    setIsDetectingLang(false)
  }, [stopSpeak, setIsTranslating, setSourceText, setTranslatedText, setPhoneticText, setTranslateError])

  /** Dismisses the current error banner — clears translateError in store */
  const handleDismissError = useCallback(() => {
    setTranslateError(null)
  }, [setTranslateError])

  /** Removes the attached image (ImageAttachmentPreview onRemove) — cancels in-flight job */
  const handleRemoveImage = useCallback(() => {
    translateGenerationRef.current++
    setIsTranslating(false)
    setImageAttachment(null)
    setImageRegions(null)
    setEditedImageUrl(null)
    setTranslatedText('')
    setPhoneticText('')
    setTranslateError(null)
    setImageSwitchNotice(null)
  }, [setIsTranslating, setTranslatedText, setPhoneticText, setTranslateError])

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
    showFurigana,
    translationStyle,
    keyStatus,
    selectedProvider,
    // ── Store setters (used directly in JSX) ───────────────────────────────
    setTargetLang,
    setActivePage,
    setShowFurigana,
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
