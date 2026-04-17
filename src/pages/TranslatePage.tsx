import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FuriganaText } from '../components/FuriganaText'
import type { ImageAttachment } from '../components/ImageTranslator'
import { DragOverlay } from '../components/ui/DragOverlay'
import { ImageAttachmentPreview } from '../components/translate/ImageAttachmentPreview'
import { VoiceOverlay } from '../components/translate/VoiceOverlay'
import { translationService } from '../services/translationService'
import { LanguageSelector } from '../components/LanguageSelector'
import { MarkdownEditor } from '../components/MarkdownEditor'
import { MarkdownText } from '../components/MarkdownText'
import { ModelSelector } from '../components/ModelSelector'
import { AutoTranslateToggle } from '../components/ui/AutoTranslateToggle'
import { DownloadImageButton } from '../components/ui/DownloadImageButton'
import { ClearButton } from '../components/ui/ClearButton'
import { CopyButton } from '../components/ui/CopyButton'
import { ImageTranslateButton } from '../components/ui/ImageTranslateButton'
import { PhoneticToggle } from '../components/ui/PhoneticToggle'
import { RewriteButton } from '../components/ui/RewriteButton'
import { SpeakButton } from '../components/ui/SpeakButton'
import { TranslateButton } from '../components/ui/TranslateButton'
import { AlertTriangleIcon, AutoDetectIcon, ChevronDownIcon, SpinnerIcon, SwapIcon, XIcon } from '../components/ui/icons'
import { VoiceRecorder } from '../components/VoiceRecorder'
import { MAX_TRANSLATE_IMAGE_DIMENSION } from '../constants/image'
import { MAX_INPUT_CHARS, DETECT_LANG_MAX_CHARS } from '../constants/providers'
import { COPY_FEEDBACK_DURATION_MS, IMAGE_AUTO_TRANSLATE_DELAY_MS } from '../constants/ui'
import { resizeImageFile, extractImageFromClipboard } from '../utils/imageUtils'
import { useTTS } from '../hooks/useTTS'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { useAppStore, useT } from '../store/useAppStore'
import type { ImageTextRegion, TranslationStyle } from '../types'
import { renderTranslatedRegions } from '../utils/canvas'

/**
 * Sentinel value set on translatedText when a Gemini image-edit result is shown.
 * Non-empty so action buttons conditionally appear, but those buttons check
 * `editedImageUrl` first — so the user cannot actually copy or speak this value.
 */
const IMAGE_TRANSLATED_SENTINEL = '✓'

export function TranslatePage() {
  const {
    sourceText, translatedText, phoneticText, sourceLang, targetLang,
    isTranslating, translateError,
    selectedProvider, selectedModels, autoTranslate, autoTranslateDelay, keyStatus, showFurigana, translationStyle,
    ttsVoice,
    setSourceText, setTranslatedText, setPhoneticText, setTargetLang,
    setIsTranslating, setTranslateError, setActivePage, setShowFurigana, setTranslationStyle, setAutoTranslate, addHistory,
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
    const canvas  = document.createElement('canvas')
    canvas.width  = imageAttachment.width
    canvas.height = imageAttachment.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.src = imageAttachment.previewDataUrl
    await new Promise<void>(resolve => { img.onload = () => resolve() })
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    renderTranslatedRegions(ctx, imageRegions, canvas.width, canvas.height)
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `translated_${Date.now()}.png`
    a.click()
  }, [imageAttachment, imageRegions])

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
    if (!translatedText || translatedText === IMAGE_TRANSLATED_SENTINEL) return
    translateGenerationRef.current++
    stopSpeak()
    setSourceText(translatedText)
    setTranslatedText('')
    setPhoneticText('')
    setTranslateError(null)
    setIsTranslating(false)
    if (detectedSourceLang) {
      setTargetLang(detectedSourceLang)
    }
    setDetectedSourceLang(null)
    setIsDetectingLang(false)
  }, [translatedText, detectedSourceLang, stopSpeak, setSourceText, setTranslatedText,
      setPhoneticText, setTranslateError, setIsTranslating, setTargetLang])

  const handleCopy = async () => {
    const textToCopy = showFurigana && phoneticText ? phoneticText : translatedText
    if (!textToCopy) return
    await navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION_MS)  // HC-03
  }

  // Scroll-sync refs — keeps both panels scrolled to the same relative position
  const sourceScrollRef = useRef<HTMLDivElement | null>(null)
  const translatedScrollRef = useRef<HTMLDivElement | null>(null)
  const isSyncingScrollRef = useRef(false)

  useEffect(() => {
    const source = sourceScrollRef.current
    const translated = translatedScrollRef.current
    if (!source || !translated) return

    const syncFromSource = () => {
      if (isSyncingScrollRef.current) return
      isSyncingScrollRef.current = true
      const maxSrc = source.scrollHeight - source.clientHeight
      const ratio = maxSrc > 0 ? source.scrollTop / maxSrc : 0
      translated.scrollTop = ratio * (translated.scrollHeight - translated.clientHeight)
      requestAnimationFrame(() => { isSyncingScrollRef.current = false })
    }

    const syncFromTranslated = () => {
      if (isSyncingScrollRef.current) return
      isSyncingScrollRef.current = true
      const maxSrc = translated.scrollHeight - translated.clientHeight
      const ratio = maxSrc > 0 ? translated.scrollTop / maxSrc : 0
      source.scrollTop = ratio * (source.scrollHeight - source.clientHeight)
      requestAnimationFrame(() => { isSyncingScrollRef.current = false })
    }

    source.addEventListener('scroll', syncFromSource, { passive: true })
    translated.addEventListener('scroll', syncFromTranslated, { passive: true })

    return () => {
      source.removeEventListener('scroll', syncFromSource)
      translated.removeEventListener('scroll', syncFromTranslated)
    }
  }, [])

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
        } else {
          setTranslatedText(result.translatedText)
          setPhoneticText('')
        }
      }
    } catch (err) {
      console.error('[rewrite] error:', err)
    } finally {
      setIsRewriting(null)
    }
  }, [isRewriting, hasKey, sourceText, translatedText, sourceLang, targetLang, translationStyle,
      selectedProvider, selectedModels, setSourceText, setTranslatedText, setPhoneticText, setTranslateError, t])

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      {/* Toolbar — single row, no wrap */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 overflow-hidden
                      bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        {/* ModelSelector takes remaining space, shrinks when needed */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <ModelSelector />
        </div>

        {/* Right controls — never wrap, never shrink */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Style dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 whitespace-nowrap">{t.translate_style_label}</span>
            <div className="relative">
              <select
                value={translationStyle}
                onChange={(e) => setTranslationStyle(e.target.value as TranslationStyle)}
                className={`text-xs font-medium px-2.5 py-1.5 pr-6 rounded-full border appearance-none cursor-pointer
                            transition-colors duration-200 outline-none
                            ${translationStyle !== 'neutral'
                              ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400'
                              : 'bg-gray-100 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                            }`}
              >
                <option value="friendly">{t.translate_style_friendly}</option>
                <option value="neutral">{t.translate_style_neutral}</option>
                <option value="professional">{t.translate_style_professional}</option>
                <option value="business">{t.translate_style_business}</option>
                <option value="slack">{t.translate_style_slack}</option>
                <option value="polite">{t.translate_style_polite}</option>
                <option value="technical">{t.translate_style_technical}</option>
              </select>
              <div className="pointer-events-none absolute right-2 inset-y-0 flex items-center">
                <ChevronDownIcon className="w-3 h-3 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Auto / Manual translation mode toggle — fixed width to prevent layout shift */}
          <AutoTranslateToggle
            autoTranslate={autoTranslate}
            onChange={setAutoTranslate}
            titleAuto={t.translate_mode_auto_title}
            titleManual={t.translate_mode_manual_title}
            labelAuto={t.translate_mode_auto}
            labelManual={t.translate_mode_manual}
          />

          {/* Phonetic reading toggle */}
          <PhoneticToggle
            showFurigana={showFurigana}
            onChange={setShowFurigana}
            label={t.translate_phonetic}
          />
        </div>
      </div>

      {/* Language bar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2
                      bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        {/* Source: auto-detect badge — shows detected language name when known */}
        <div className="flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                        bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                        text-sm text-gray-500 dark:text-gray-400 select-none overflow-hidden">
          <AutoDetectIcon className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" />
          <span className="truncate">{t.lang_auto}</span>
          {detectedSourceLang && (
            <span className="ml-auto pl-1.5 text-xs font-medium text-blue-500 dark:text-blue-400 shrink-0 truncate">
              {t.lang_names[detectedSourceLang] ?? detectedSourceLang}
            </span>
          )}
        </div>

        {/* Swap languages button — replaces the static arrow; shows spinner while detecting */}
        <button
          type="button"
          onClick={handleSwapLanguages}
          disabled={!translatedText || translatedText === IMAGE_TRANSLATED_SENTINEL || !!imageAttachment}
          title={t.translate_swap}
          className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full
                      transition-all duration-200
                      ${(!translatedText || translatedText === IMAGE_TRANSLATED_SENTINEL || !!imageAttachment)
                        ? 'text-gray-200 dark:text-gray-700 cursor-not-allowed'
                        : 'cursor-pointer text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/50 dark:hover:text-blue-400'}`}
        >
          {isDetectingLang
            ? <SpinnerIcon className="w-4 h-4 animate-spin" />
            : <SwapIcon className="w-4 h-4" />}
        </button>

        {/* Target language selector */}
        <div className="flex-1">
          <LanguageSelector value={targetLang} onChange={setTargetLang} includeAuto={false} />
        </div>
      </div>

        {/* Text panels */}
      <div className="flex flex-1 min-h-0 divide-x divide-gray-200 dark:divide-gray-800">
        {/* Source panel — also acts as an image drop zone */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: drop zone requires drag event handlers on the panel container */}
        <section
          aria-label={t.image_translate_title}
          className={`flex-1 basis-0 flex flex-col min-w-0 relative transition-colors duration-150
                      ${isDraggingOver ? 'bg-emerald-50 dark:bg-emerald-950/20 ring-2 ring-inset ring-emerald-300 dark:ring-emerald-700' : ''}`}
          onDragOver={handleSourcePanelDragOver}
          onDragLeave={handleSourcePanelDragLeave}
          onDrop={handleSourcePanelDrop}
          onPaste={handleSourcePanelPaste}
        >
          {/* Drop indicator overlay */}
          {isDraggingOver && (
            <DragOverlay label={t.image_translate_upload_hint.split('\n')[0]} zIndex="z-30" />
          )}

          {/* ── Listening overlay (shown while voice is active) ── */}
          <VoiceOverlay
            isVoiceActive={isVoiceActive}
            isVoiceInterim={isVoiceInterim}
            sourceText={sourceText}
            listeningLabel={t.voice_listening}
            recordLabel={t.voice_record}
          />

          {/* ── Image attachment preview (shown when an image is attached) ── */}
          {imageAttachment && !isVoiceActive && (
            <ImageAttachmentPreview
              imageAttachment={imageAttachment}
              onRemove={() => {
                // Cancel any in-flight translation job before clearing image state
                translateGenerationRef.current++
                setIsTranslating(false)
                setImageAttachment(null)
                setImageRegions(null)
                setEditedImageUrl(null)
                setTranslatedText('')
                setPhoneticText('')
                setTranslateError(null)
                setImageSwitchNotice(null)
              }}
            />
          )}


          {/* ── Typora-like markdown editor (line being edited = raw, others = rendered) ── */}
          <div
            ref={sourceScrollRef}
            className="flex-1 overflow-auto p-4 min-h-0"
          >
            <MarkdownEditor
              value={sourceText}
              onChange={(val) => {
                setSourceText(val)
                stopSpeak()
                if (!val.trim()) {
                  setTranslatedText('')
                  setPhoneticText('')
                }
                // User edited manually while voice is active — reset prefix so next
                // transcript chunk replaces the field content, not appends to stale prefix
                if (isVoiceActive) resetVoicePrefix()
              }}
              placeholder={t.translate_placeholder}
              className={`min-h-full ${isVoiceInterim ? 'opacity-50 italic' : ''}`}
            />
          </div>

          <div className="flex-shrink-0 flex items-center justify-between px-4 h-12
                          border-t border-gray-100 dark:border-gray-800 relative z-20 bg-white dark:bg-gray-900">
            <div className="flex items-center gap-2">
              {/* Manual translate button — in source panel bottom bar when in manual mode */}
              {!autoTranslate && (
                <TranslateButton
                  isTranslating={isTranslating}
                  disabled={!sourceText.trim() && !imageAttachment}
                  onClick={handleTranslate}
                  labelTranslate={t.translate_btn ?? 'Dịch'}
                  labelLoading={t.translate_btn_loading}
                />
              )}
              {/* Voice recorder — shows its own inline status labels */}
              <VoiceRecorder
                sourceLang={sourceLang}
                onTranscript={handleVoiceTranscript}
                onRecordingChange={handleVoiceRecordingChange}
                titleRecord={t.voice_record}
                titleStop={t.voice_stop}
                labelTranscribing={t.voice_transcribing}
                labelRecording={t.voice_whisper_mode}
                useWhisper={keyStatus.openai}
              />

              {/* Image translation button — opens native file picker directly */}
              <ImageTranslateButton
                onClick={() => fileInputRef.current?.click()}
                title={t.image_translate_title}
              />
              {/* Hidden file input for image selection */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFileInputChange}
              />

              {!isVoiceActive && (
                charCount > MAX_INPUT_CHARS ? (
                  <span className="flex items-center gap-1 text-xs tabular-nums text-amber-500 font-medium" title={t.translate_limit}>
                    <AlertTriangleIcon className="w-3 h-3 flex-shrink-0" />
                    {charCount.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-xs tabular-nums text-gray-400">
                    {charCount.toLocaleString()} {t.translate_chars}
                  </span>
                )
              )}
            </div>
            {sourceText && !isVoiceActive && (
              <div className="flex items-center gap-2">
                {/* Speak source text */}
                <SpeakButton
                  panel="source"
                  text={sourceText}
                  lang={sourceLang === 'auto' ? 'en' : sourceLang}
                  speakingPanel={speakingPanel}
                  speakLoading={speakLoading}
                  onSpeak={handleSpeak}
                  labelSpeak={t.translate_speak}
                  labelStop={t.translate_speak_stop}
                />

                {/* Rewrite source text */}
                <RewriteButton
                  panel="source"
                  isRewriting={isRewriting}
                  onRewrite={handleRewrite}
                  labelRewrite={t.translate_rewrite}
                  labelRewriting={t.translate_rewriting}
                />

                {/* Clear source text */}
                <ClearButton
                  onClick={() => {
                    // Cancel any in-flight translation job before clearing state
                    translateGenerationRef.current++
                    setIsTranslating(false)
                    stopSpeak()
                    setSourceText('')
                    setTranslatedText('')
                    setPhoneticText('')
                    setTranslateError(null)
                    setDetectedSourceLang(null)
                    setIsDetectingLang(false)
                  }}
                  label={t.translate_clear}
                />
              </div>
            )}
          </div>
        </section>

        {/* Result panel */}
        <div className="flex-1 basis-0 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900/50">
          <div ref={translatedScrollRef} className="flex-1 p-4 overflow-auto relative">
            {isTranslating ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <SpinnerIcon className="w-5 h-5 animate-spin text-blue-500" />
                  <span className="text-sm text-gray-400">{t.translate_btn_loading}</span>
                </div>
              </div>
            ) : translateError ? (
              <div className="fade-in flex flex-col gap-3">
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30
                                border border-red-200 dark:border-red-900 rounded-lg">
                  <AlertTriangleIcon className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-300">{translateError}</p>
                </div>
                {(translateError.includes('API key') || translateError.includes('Settings') ||
                  translateError.includes('Cài đặt') || translateError.includes('設定')) && (
                  <button type="button" onClick={() => setActivePage('settings')} className="btn-primary w-fit text-xs">
                    {t.translate_error_open_settings}
                  </button>
                )}
              </div>
            ) : editedImageUrl ? (
              /* ── Gemini image-edit result: show the translated image directly ── */
              <img
                src={editedImageUrl}
                alt="Translated"
                className="max-w-full rounded-lg fade-in"
              />
            ) : translatedText ? (
              showFurigana && phoneticText
                ? <FuriganaText text={phoneticText} className="textarea-field fade-in" />
                : <MarkdownText text={translatedText} className="textarea-field fade-in" />
            ) : (
              <p className="text-[15px] text-gray-300 dark:text-gray-700 leading-relaxed select-none">
                {t.translate_result_placeholder}
              </p>
            )}
          </div>

          <div className="flex-shrink-0 flex items-center justify-between px-4 h-12
                          border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
            <span className="text-xs text-gray-400 tabular-nums">
              {translatedText && !editedImageUrl ? `${translatedText.length.toLocaleString()} ${t.translate_chars}` : ''}
            </span>
            {(translatedText || editedImageUrl) && (
              <div className="flex items-center gap-2">
                {/* Speak translated text — hide when showing Gemini-edited image */}
                {!editedImageUrl && (
                  <SpeakButton
                    panel="translated"
                    text={translatedText}
                    lang={targetLang}
                    speakingPanel={speakingPanel}
                    speakLoading={speakLoading}
                    onSpeak={handleSpeak}
                    labelSpeak={t.translate_speak}
                    labelStop={t.translate_speak_stop}
                  />
                )}

                {/* Download edited image (Gemini image-edit result) */}
                {editedImageUrl && (
                  <DownloadImageButton
                    title={t.image_translate_download}
                    onClick={() => {
                      const a = document.createElement('a')
                      a.href = editedImageUrl
                      a.download = `translated_${Date.now()}.png`
                      a.click()
                    }}
                  />
                )}

                {/* Download canvas-overlay image (regions fallback) */}
                {imageRegions && imageAttachment && !editedImageUrl && (
                  <DownloadImageButton
                    title={t.image_translate_download}
                    onClick={handleDownloadTranslatedImage}
                  />
                )}

                {/* Rewrite translated text */}
                {!editedImageUrl && (
                  <RewriteButton
                    panel="translated"
                    isRewriting={isRewriting}
                    onRewrite={handleRewrite}
                    labelRewrite={t.translate_rewrite}
                    labelRewriting={t.translate_rewriting}
                  />
                )}

                {/* Copy translated text */}
                {!editedImageUrl && (
                  <CopyButton
                    copied={copied}
                    onClick={handleCopy}
                    labelCopy={t.translate_copy}
                    labelCopied={t.translate_copied}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Model-switch warning toast — floating red popup at bottom center ── */}
      {imageSwitchNotice && (
        <div className="pointer-events-auto fixed bottom-16 left-1/2 -translate-x-1/2 z-50
                        max-w-sm w-full mx-4 fade-in">
          <div className="flex items-start gap-2.5 px-4 py-3
                          bg-red-600 dark:bg-red-700 text-white
                          rounded-xl shadow-lg shadow-red-900/20">
            <AlertTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold leading-snug">{t.image_model_switched_title}</p>
              <p className="text-xs opacity-90 leading-snug mt-0.5">
                Using <strong>{imageSwitchNotice.model}</strong>
                {imageSwitchNotice.provider !== selectedProvider && (
                  <> ({imageSwitchNotice.provider})</>
                )}
                {' '}— {t.image_model_switched_body}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setImageSwitchNotice(null)}
              className="flex-shrink-0 text-white/70 hover:text-white cursor-pointer mt-0.5"
              aria-label="Dismiss"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
