import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FuriganaText } from '../components/FuriganaText'
import type { ImageAttachment } from '../components/ImageTranslator'
import { ImageTranslator } from '../components/ImageTranslator'
import { LanguageSelector } from '../components/LanguageSelector'
import { MarkdownEditor } from '../components/MarkdownEditor'
import { MarkdownText } from '../components/MarkdownText'
import { ModelSelector } from '../components/ModelSelector'
import { AutoTranslateToggle } from '../components/ui/AutoTranslateToggle'
import { ClearButton } from '../components/ui/ClearButton'
import { CopyButton } from '../components/ui/CopyButton'
import { ImageTranslateButton } from '../components/ui/ImageTranslateButton'
import { PhoneticToggle } from '../components/ui/PhoneticToggle'
import { RewriteButton } from '../components/ui/RewriteButton'
import { SpeakButton } from '../components/ui/SpeakButton'
import { TranslateButton } from '../components/ui/TranslateButton'
import { AlertTriangleIcon, ArrowRightIcon, AutoDetectIcon, ChevronDownIcon, DownloadIcon, MicrophoneIcon, SpinnerIcon, XIcon } from '../components/ui/icons'
import { VoiceRecorder } from '../components/VoiceRecorder'
import { MAX_INPUT_CHARS } from '../constants/providers'
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
  const hasKey = keyStatus[selectedProvider]
  const charCount = sourceText.length
  const [copied, setCopied] = useState(false)
  const [isRewriting, setIsRewriting] = useState<'source' | 'translated' | null>(null)

  // TTS — delegated to useTTS hook (Web Audio API + OS synthesis fallback, no console.log)
  const { speakingPanel, speakLoading, handleSpeak, stopSpeak } = useTTS({ ttsVoice })

  // Image attachment state (set when user uploads an image via the popup)
  const [imageAttachment, setImageAttachment] = useState<ImageAttachment | null>(null)
  // Regions returned by AI when translating an image (fallback approach)
  const [imageRegions, setImageRegions] = useState<ImageTextRegion[] | null>(null)
  // Edited image returned directly by Gemini image-edit model
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null)
  // Image translator modal state
  const [showImageTranslator, setShowImageTranslator] = useState(false)
  // Stable ref so lang-change effect can check imageAttachment without re-subscribing
  const imageAttachmentRef = useRef(imageAttachment)
  imageAttachmentRef.current = imageAttachment

  // ── Voice input — shared hook (same logic as ChatPage) ──
  const {
    isVoiceActive,
    isVoiceInterim,
    handleVoiceRecordingChange,
    handleVoiceTranscript,
    resetVoicePrefix,
  } = useVoiceInput({ currentText: sourceText, onTextChange: setSourceText })

  const handleTranslate = useCallback(async () => {
    if (isTranslating) return
    if (!hasKey) { setTranslateError(t.translate_error_no_key); return }

    setIsTranslating(true)
    setTranslateError(null)
    setPhoneticText('')

    // ── IMAGE mode: translate the attached image ──────────────────────────
    if (imageAttachment) {
      try {
        const result = await window.api.translateImage({
          provider:      selectedProvider,
          model:         selectedModels[selectedProvider],
          imageBase64:   imageAttachment.base64,
          imageMimeType: imageAttachment.mimeType,
          sourceLang,
          targetLang,
        })
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
      } catch (err) {
        setTranslateError(err instanceof Error ? err.message : 'Unexpected error')
      } finally {
        setIsTranslating(false)
      }
      return
    }

    // ── TEXT mode: normal translation ─────────────────────────────────────
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

      const plainResult = await window.api.translate({ ...baseParams, showFurigana: false })

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

        window.api.translate({ ...baseParams, sourceText: plainText, showFurigana: true, phoneticOnly: true })
          .then((res) => { if (res.success && res.translatedText) setPhoneticText(res.translatedText) })
          .catch(() => {})
      } else {
        setTranslateError(plainResult.error || 'Translation failed')
      }
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setIsTranslating(false)
    }
  }, [imageAttachment, sourceText, sourceLang, targetLang, selectedProvider, selectedModels,
      isTranslating, hasKey, translationStyle, setIsTranslating, setTranslateError,
      setTranslatedText, setPhoneticText, addHistory, t])

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
    debounceRef.current = setTimeout(() => { handleTranslateRef.current() }, 300)
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


  const handleCopy = async () => {
    const textToCopy = showFurigana && phoneticText ? phoneticText : translatedText
    if (!textToCopy) return
    await navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
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
      const result = await window.api.rewriteText({
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
        {/* Source: auto-detect badge */}
        <div className="flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                        bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                        text-sm text-gray-500 dark:text-gray-400 select-none">
          <AutoDetectIcon className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" />
          <span className="truncate">{t.lang_auto}</span>
        </div>

        {/* Arrow separator */}
        <ArrowRightIcon className="flex-shrink-0 w-4 h-4 text-gray-300 dark:text-gray-600" />

        {/* Target language selector */}
        <div className="flex-1">
          <LanguageSelector value={targetLang} onChange={setTargetLang} includeAuto={false} />
        </div>
      </div>

        {/* Text panels */}
      <div className="flex flex-1 min-h-0 divide-x divide-gray-200 dark:divide-gray-800">
        {/* Source panel */}
        <div className="flex-1 basis-0 flex flex-col min-w-0 relative">

          {/* ── Listening overlay (shown while voice is active) ── */}
          {isVoiceActive && (
            <div className="absolute inset-x-0 top-0 bottom-12 z-10 flex flex-col items-center justify-center
                            bg-white dark:bg-gray-900 fade-in">
              {/* Animated rings */}
              <div className="relative flex items-center justify-center mb-5">
                <span className="absolute w-28 h-28 rounded-full bg-red-100 dark:bg-red-900/20 animate-ping" style={{ animationDuration: '1.8s' }} />
                <span className="absolute w-20 h-20 rounded-full bg-red-200 dark:bg-red-900/30 animate-ping" style={{ animationDuration: '1.4s', animationDelay: '0.2s' }} />
                <span className="absolute w-14 h-14 rounded-full bg-red-300 dark:bg-red-900/50 animate-ping" style={{ animationDuration: '1.1s', animationDelay: '0.1s' }} />

                {/* Microphone circle */}
                <div className="relative w-16 h-16 rounded-full bg-red-500 dark:bg-red-600 flex items-center justify-center shadow-md">
                  <MicrophoneIcon className="w-7 h-7 text-white" />
                </div>
              </div>

              {/* Status label */}
              <p className="text-sm font-semibold text-red-500 dark:text-red-400 animate-pulse tracking-wide mb-3">
                {t.voice_listening}
              </p>

              {/* Sound-wave bars */}
              <div className="flex items-end gap-[3px] h-6 mb-4">
                {[1,2,3,4,5,6,7].map((i) => (
                  <span
                    key={i}
                    className="w-1 rounded-full bg-red-400 dark:bg-red-500 animate-bounce"
                    style={{
                      height: `${8 + (i % 3) * 6 + (i % 2) * 4}px`,
                      animationDuration: `${0.6 + i * 0.08}s`,
                      animationDelay: `${i * 0.07}s`,
                    }}
                  />
                ))}
              </div>

              {/* Interim / final transcript preview */}
              {sourceText ? (
                <p className={`max-w-[80%] text-center text-[13px] leading-relaxed line-clamp-3
                               ${isVoiceInterim
                                 ? 'text-gray-400 dark:text-gray-500 italic'
                                 : 'text-gray-700 dark:text-gray-300 font-medium'}`}>
                  {sourceText}
                </p>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-600 select-none">
                  {t.voice_record}…
                </p>
              )}
            </div>
          )}

          {/* ── Image attachment preview (shown when an image is attached) ── */}
          {imageAttachment && !isVoiceActive && (
            <div className="flex-shrink-0 mx-4 mt-3 relative rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800
                            border border-gray-200 dark:border-gray-700 max-h-48 flex items-center justify-center">
              <img
                src={imageAttachment.previewDataUrl}
                alt={imageAttachment.fileName}
                className="max-w-full max-h-48 object-contain"
              />
              {/* × to remove image */}
              <button
                type="button"
                onClick={() => {
                  setImageAttachment(null)
                  setImageRegions(null)
                  setEditedImageUrl(null)
                  setTranslatedText('')
                  setPhoneticText('')
                  setTranslateError(null)
                }}
                title="Remove image"
                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center
                           rounded-full bg-black/50 hover:bg-black/70 text-white cursor-pointer z-10"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
              {/* File name */}
              <div className="absolute bottom-0 inset-x-0 px-2 py-1
                              bg-black/40 text-white text-[10px] truncate">
                {imageAttachment.fileName}
              </div>
            </div>
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

              {/* Image translation button */}
              <ImageTranslateButton
                onClick={() => setShowImageTranslator(true)}
                title={t.image_translate_title}
              />

              {!isVoiceActive && (
                charCount > MAX_INPUT_CHARS ? (
                  <span className="text-xs tabular-nums text-amber-500 font-medium" title={t.translate_limit}>
                    ⚠ {charCount.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()}
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
                  onClick={() => { stopSpeak(); setSourceText(''); setTranslatedText(''); setPhoneticText(''); setTranslateError(null) }}
                  label={t.translate_clear}
                />
              </div>
            )}
          </div>
        </div>

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
                  <button
                    type="button"
                    title={t.image_translate_download}
                    onClick={() => {
                      const a = document.createElement('a')
                      a.href = editedImageUrl
                      a.download = `translated_${Date.now()}.png`
                      a.click()
                    }}
                    className="relative flex items-center justify-center w-8 h-8 rounded-full
                               transition-all duration-200 cursor-pointer
                               text-gray-400 hover:text-emerald-500 hover:bg-emerald-50
                               dark:hover:bg-emerald-950 dark:hover:text-emerald-400"
                  >
                    <DownloadIcon />
                  </button>
                )}

                {/* Download canvas-overlay image (regions fallback) */}
                {imageRegions && imageAttachment && !editedImageUrl && (
                  <button
                    type="button"
                    onClick={handleDownloadTranslatedImage}
                    title={t.image_translate_download}
                    className="relative flex items-center justify-center w-8 h-8 rounded-full
                               transition-all duration-200 cursor-pointer
                               text-gray-400 hover:text-emerald-500 hover:bg-emerald-50
                               dark:hover:bg-emerald-950 dark:hover:text-emerald-400"
                  >
                    <DownloadIcon />
                  </button>
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

      {/* Image translator modal — opens popup, resizes image, attaches to translate area */}
      {showImageTranslator && (
        <ImageTranslator
          onImageReady={(attachment) => {
            setImageAttachment(attachment)
            setImageRegions(null)
            setEditedImageUrl(null)
            setTranslatedText('')
            setPhoneticText('')
            setTranslateError(null)
          }}
          onClose={() => setShowImageTranslator(false)}
        />
      )}
    </div>
  )
}
