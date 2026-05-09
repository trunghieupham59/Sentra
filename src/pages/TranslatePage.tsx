import { type MutableRefObject, useEffect, useMemo, useRef, useState } from 'react'
import { MarkdownText } from '../components/MarkdownText'
import { ModelPickerDropdown } from '../components/ModelSelector'
import { ProviderIcon } from '../components/ProviderIcon'
import { FuriganaText } from '../components/translate/FuriganaText'
import { ImageAttachmentPreview } from '../components/translate/ImageAttachmentPreview'
import { ImageSwitchToast } from '../components/translate/ImageSwitchToast'
import { ResultPanelActions } from '../components/translate/ResultPanelActions'
import { SourceLanguageSelector } from '../components/translate/SourceLanguageSelector'
import { SourcePanelActions } from '../components/translate/SourcePanelActions'
import { TargetLanguageSelector } from '../components/translate/TargetLanguageSelector'
import { TranslateError } from '../components/translate/TranslateError'
import { VoiceOverlay } from '../components/translate/VoiceOverlay'
import { DragOverlay } from '../components/ui/DragOverlay'
import { AlertTriangleIcon, ChevronDownIcon, SpinnerIcon } from '../components/ui/icons'
import { TranslateButton } from '../components/ui/TranslateButton'
import { ACCEPTED_IMAGE_MIME_TYPES } from '../constants/image'
import { MAX_INPUT_CHARS, PROVIDERS } from '../constants/providers'
import { IMAGE_TRANSLATED_SENTINEL, useTranslate } from '../hooks/useTranslate'
import { useAppStore, useT } from '../store/useAppStore'
import type { PhoneticMode, TranslationStyle } from '../types'
import { dedupeModelsByFamily, formatModelName } from '../utils/modelDisplay'

export function TranslatePage() {
  const t = useT()
  const { setSourceLang, openSettings, selectedModels, dynamicModels } = useAppStore()
  const {
    // Store state
    sourceText, translatedText, phoneticText, sourceLang, targetLang,
    isTranslating, translateError, autoTranslate, phoneticMode, translationStyle,
    selectedProvider,
    // Store setters
    setTargetLang, setPhoneticMode, setTranslationStyle, setAutoTranslate,
    // Local state
    copied, isRewriting, imageSwitchNotice, detectedSourceLang, isDetectingLang,
    imageAttachment, imageRegions, editedImageUrl, isDraggingOver,
    setImageSwitchNotice,
    // Computed
    charCount,
    isApiKeyError,
    // TTS
    speakingPanel, speakLoading, handleSpeak,
    // Voice
    isVoiceActive, isVoiceInterim, handleVoiceRecordingChange, handleVoiceTranscript,
    // Refs
    fileInputRef,
    // Handlers
    handleTranslate, handleRewrite, handleCopy,
    handleDismissError,
    handleDownloadTranslatedImage, handleDownloadEditedImage,
    handleSourceChange, handleClearSource, handleRemoveImage,
    handleFileInputChange, handleSourcePanelPaste,
    handleSourcePanelDragOver, handleSourcePanelDragLeave, handleSourcePanelDrop,
  } = useTranslate()

  // Scroll-sync refs — keeps both panels scrolled to the same relative position
  const sourceScrollRef = useRef<HTMLDivElement | null>(null)
  const translatedScrollRef = useRef<HTMLDivElement | null>(null)
  const isSyncingScrollRef = useRef(false)

  useEffect(() => {
    const source = sourceScrollRef.current
    const translated = translatedScrollRef.current
    if (!source || !translated) return

    const makeSyncHandler = (
      from: HTMLDivElement,
      to: HTMLDivElement,
      flag: MutableRefObject<boolean>
    ) => () => {
      if (flag.current) return
      flag.current = true
      const maxFrom = from.scrollHeight - from.clientHeight
      const ratio = maxFrom > 0 ? from.scrollTop / maxFrom : 0
      to.scrollTop = ratio * (to.scrollHeight - to.clientHeight)
      requestAnimationFrame(() => { flag.current = false })
    }

    const syncFromSource = makeSyncHandler(source, translated, isSyncingScrollRef)
    const syncFromTranslated = makeSyncHandler(translated, source, isSyncingScrollRef)

    source.addEventListener('scroll', syncFromSource, { passive: true })
    translated.addEventListener('scroll', syncFromTranslated, { passive: true })

    return () => {
      source.removeEventListener('scroll', syncFromSource)
      translated.removeEventListener('scroll', syncFromTranslated)
    }
  }, [])

  const [showAIConfig, setShowAIConfig] = useState(false)
  const aiConfigRef = useRef<HTMLDivElement>(null)

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

  // ── Model display name for the toolbar pill ──
  const currentDynamic = dynamicModels[selectedProvider] ?? []
  const staticModels = PROVIDERS.find((p) => p.id === selectedProvider)?.models ?? []
  const rawModels = currentDynamic.length > 0 ? currentDynamic : staticModels
  const displayModels = useMemo(
    () => dedupeModelsByFamily(selectedProvider, rawModels),
    [selectedProvider, rawModels],
  )
  const selectedModelId = selectedModels[selectedProvider] ?? displayModels[0]?.id ?? ''
  const selectedModelObj = displayModels.find((m) => m.id === selectedModelId) ?? displayModels[0]
  const modelDisplayName = selectedModelObj
    ? formatModelName(selectedProvider, selectedModelObj.id, selectedModelObj.name)
    : (selectedModelId || '…')

  // ── Inline toolbar data ──
  const styleOptions: Array<[TranslationStyle, string]> = [
    ['general',   t.translate_style_general],
    ['formal',    t.translate_style_formal],
    ['casual',    t.translate_style_casual],
    ['business',  t.translate_style_business],
    ['technical', t.translate_style_technical],
    ['natural',   t.translate_style_natural],
  ]

  const phoneticOptions: Array<[PhoneticMode, string]> = [
    ['off',      t.translate_phonetic_off],
    ['standard', t.translate_phonetic_standard],
    ['phonetic', t.translate_phonetic_transcription],
  ]

  const isPhoneticLoading =
    phoneticMode !== 'off' &&
    !phoneticText &&
    (isTranslating || (!!translatedText && translatedText !== IMAGE_TRANSLATED_SENTINEL))

  return (
    <div className="app-page">

      <div className="flex-1 flex flex-col min-h-0">
        <div className="app-workspace">

          {/* ── Inline toolbar ── */}
          <div className="app-topbar gap-1.5">

            {/* Model pill — opens provider/model popup */}
            <div className="relative flex-shrink-0" ref={aiConfigRef}>
              <button
                type="button"
                onClick={() => setShowAIConfig((v) => !v)}
                title={t.translate_ai_config_title}
                className="toolbar-pill-button flex items-center gap-1.5 px-3 h-9"
              >
                <ProviderIcon provider={selectedProvider} size={13} />
                <span className="text-sm font-semibold whitespace-nowrap">{modelDisplayName}</span>
                <ChevronDownIcon className="w-3 h-3 flex-shrink-0 text-gray-400" />
              </button>

              {showAIConfig && (
                <div className="absolute top-full left-0 mt-2 z-50">
                  <ModelPickerDropdown onClose={() => setShowAIConfig(false)} />
                </div>
              )}
            </div>

            {/* Style pills */}
            <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto">
              {styleOptions.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTranslationStyle(value)}
                  className={
                    translationStyle === value
                      ? 'toolbar-pill-button whitespace-nowrap flex-shrink-0 !px-2.5 text-xs'
                      : 'btn-ghost whitespace-nowrap flex-shrink-0 !px-2.5 text-xs'
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Phonetic mode pills */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {phoneticOptions.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPhoneticMode(value)}
                  className={
                    phoneticMode === value
                      ? 'toolbar-pill-button whitespace-nowrap flex items-center gap-1 !px-2.5 text-xs'
                      : 'btn-ghost whitespace-nowrap !px-2.5 text-xs'
                  }
                >
                  {label}
                  {phoneticMode === value && isPhoneticLoading && (
                    <SpinnerIcon className="w-3 h-3 animate-spin" />
                  )}
                </button>
              ))}
            </div>

            {/* Auto/Manual toggle */}
            <button
              type="button"
              onClick={() => setAutoTranslate(!autoTranslate)}
              title={autoTranslate ? t.translate_mode_auto_title : t.translate_mode_manual_title}
              className={
                autoTranslate
                  ? 'btn-primary whitespace-nowrap flex-shrink-0'
                  : 'toolbar-pill-button whitespace-nowrap flex-shrink-0'
              }
            >
              {autoTranslate ? t.translate_mode_auto : t.translate_mode_manual}
            </button>
          </div>

          {/* Text panels */}
          <div className="app-panel-grid">

            {/* ── Source panel card ── */}
            <section
              aria-label={t.image_translate_title}
              className={`surface-panel h-full relative transition-colors duration-150 ${
                isDraggingOver ? 'surface-panel-drop' : 'surface-panel-focus'
              }`}
              onDragOver={handleSourcePanelDragOver}
              onDragLeave={handleSourcePanelDragLeave}
              onDrop={handleSourcePanelDrop}
              onPaste={handleSourcePanelPaste}
            >
              {/* Drop indicator overlay */}
              {isDraggingOver && (
                <DragOverlay label={t.image_translate_upload_hint.split('\n')[0]} zIndex="z-30" />
              )}

              {/* Panel header: language selector + char count */}
              <div className="surface-panel-header">
                <SourceLanguageSelector
                  compact
                  sourceLang={sourceLang}
                  onSourceLangChange={setSourceLang}
                  detectedSourceLang={detectedSourceLang}
                  isDetectingLang={isDetectingLang}
                  langNames={t.lang_names}
                />
                {!isVoiceActive && (
                  charCount > MAX_INPUT_CHARS ? (
                    <span
                      className="flex items-center gap-1 text-xs tabular-nums font-medium"
                      style={{ color: 'var(--vzn-danger)' }}
                      title={t.translate_limit}
                    >
                      <AlertTriangleIcon className="w-3 h-3 flex-shrink-0" />
                      {charCount.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-xs tabular-nums" style={{ color: 'var(--vzn-text-soft)' }}>
                      {charCount.toLocaleString()} {t.translate_chars}
                    </span>
                  )
                )}
              </div>

              {/* Listening overlay */}
              <VoiceOverlay
                isVoiceActive={isVoiceActive}
                isVoiceInterim={isVoiceInterim}
                sourceText={sourceText}
                listeningLabel={t.voice_listening}
                recordLabel={t.voice_record}
              />

              {/* Image attachment preview */}
              {imageAttachment && !isVoiceActive && (
                <ImageAttachmentPreview
                  imageAttachment={imageAttachment}
                  onRemove={handleRemoveImage}
                />
              )}

              {/* Plain text input */}
              <div
                ref={sourceScrollRef}
                className="flex-1 min-h-0 overflow-auto p-4 flex flex-col"
              >
                <textarea
                  value={sourceText}
                  onChange={(e) => handleSourceChange(e.target.value)}
                  placeholder={t.translate_placeholder}
                  className={`textarea-field flex-1 min-h-0 ${isVoiceInterim ? 'opacity-50 italic' : ''}`}
                />
              </div>

              {/* Source panel footer */}
              <div className="surface-footer relative z-20">
                <SourcePanelActions
                  isVoiceActive={isVoiceActive}
                  isVoiceInterim={isVoiceInterim}
                  isRewriting={isRewriting}
                  sourceText={sourceText}
                  sourceLang={sourceLang}
                  hasImage={!!imageAttachment}
                  speakingPanel={speakingPanel}
                  speakLoading={speakLoading}
                  onVoiceTranscript={handleVoiceTranscript}
                  onVoiceRecordingChange={handleVoiceRecordingChange}
                  onImageButtonClick={() => fileInputRef.current?.click()}
                  onSpeak={handleSpeak}
                  onRewrite={handleRewrite}
                  onClear={handleClearSource}
                  labelVoiceRecord={t.voice_record}
                  labelVoiceStop={t.voice_stop}
                  labelVoiceTranscribing={t.voice_transcribing}
                  labelVoiceRecording={t.voice_whisper_mode}
                  labelImageTranslate={t.image_translate_title}
                  labelSpeak={t.translate_speak}
                  labelSpeakStop={t.translate_speak_stop}
                  labelRewrite={t.translate_rewrite}
                  labelRewriting={t.translate_rewriting}
                  labelClear={t.translate_clear}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_IMAGE_MIME_TYPES}
                  className="hidden"
                  onChange={handleFileInputChange}
                />

                {!autoTranslate && (
                  <TranslateButton
                    isTranslating={isTranslating}
                    disabled={!sourceText.trim() && !imageAttachment}
                    onClick={handleTranslate}
                    labelTranslate={t.translate_btn}
                    labelLoading={t.translate_btn_loading}
                  />
                )}
              </div>
            </section>

            {/* ── Result panel card ── */}
            <div className="surface-panel h-full">

              {/* Panel header: target language selector + char count */}
              <div className="surface-panel-header">
                <TargetLanguageSelector
                  compact
                  targetLang={targetLang}
                  onTargetLangChange={setTargetLang}
                  langNames={t.lang_names}
                />
                {translatedText && !editedImageUrl && (
                  <span className="text-xs tabular-nums" style={{ color: 'var(--vzn-text-soft)' }}>
                    {translatedText.length.toLocaleString()} {t.translate_chars}
                  </span>
                )}
              </div>

              <div ref={translatedScrollRef} className="flex-1 min-h-0 overflow-auto p-4 relative">
                {isTranslating ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <SpinnerIcon className="w-5 h-5 animate-spin text-gray-500" />
                      <span className="text-sm" style={{ color: 'var(--vzn-text-soft)' }}>{t.translate_btn_loading}</span>
                    </div>
                  </div>
                ) : translateError ? (
                  <TranslateError
                    error={translateError}
                    isApiKeyError={isApiKeyError}
                    canRetry={!!(sourceText.trim() || imageAttachment)}
                    onRetry={handleTranslate}
                    onDismiss={handleDismissError}
                    onOpenSettings={() => openSettings()}
                    labelRetry={t.translate_error_retry}
                    labelOpenSettings={t.translate_error_open_settings}
                    labelDismiss={t.translate_error_dismiss}
                  />
                ) : editedImageUrl ? (
                  <img
                    src={editedImageUrl}
                    alt={t.image_translate_title}
                    className="max-w-full rounded-lg fade-in"
                  />
                ) : translatedText ? (
                  phoneticMode !== 'off' && phoneticText
                    ? phoneticMode === 'standard'
                      ? <FuriganaText text={phoneticText} className="textarea-field fade-in" />
                      : <MarkdownText text={phoneticText} className="textarea-field fade-in" />
                    : <MarkdownText text={translatedText} className="textarea-field fade-in" />
                ) : (
                  <p className="ui-reader-muted select-none">
                    {t.translate_result_placeholder}
                  </p>
                )}
              </div>

              {/* Result panel footer */}
              <div className="surface-footer">
                <ResultPanelActions
                  translatedText={translatedText}
                  targetLang={targetLang}
                  editedImageUrl={editedImageUrl}
                  hasImageRegions={!!imageRegions}
                  hasImageAttachment={!!imageAttachment}
                  copied={copied}
                  isRewriting={isRewriting}
                  speakingPanel={speakingPanel}
                  speakLoading={speakLoading}
                  onSpeak={handleSpeak}
                  onDownloadEdited={handleDownloadEditedImage}
                  onDownloadTranslated={handleDownloadTranslatedImage}
                  onRewrite={handleRewrite}
                  onCopy={handleCopy}
                  labelSpeak={t.translate_speak}
                  labelSpeakStop={t.translate_speak_stop}
                  labelDownload={t.image_translate_download}
                  labelRewrite={t.translate_rewrite}
                  labelRewriting={t.translate_rewriting}
                  labelCopy={t.translate_copy}
                  labelCopied={t.translate_copied}
                />
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Model-switch warning toast */}
      {imageSwitchNotice && (
        <ImageSwitchToast
          model={imageSwitchNotice.model}
          provider={imageSwitchNotice.provider}
          currentProvider={selectedProvider}
          onDismiss={() => setImageSwitchNotice(null)}
          titleLabel={t.image_model_switched_title}
          bodyLabel={t.image_model_switched_body}
          usingLabel={t.image_model_switched_using}
        />
      )}
    </div>
  )
}
