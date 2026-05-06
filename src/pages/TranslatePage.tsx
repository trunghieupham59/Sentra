import { type MutableRefObject, useEffect, useRef, useState } from 'react'
import { MarkdownText } from '../components/MarkdownText'
import { ModelSelector } from '../components/ModelSelector'
import { FuriganaText } from '../components/translate/FuriganaText'
import { ImageAttachmentPreview } from '../components/translate/ImageAttachmentPreview'
import { ImageSwitchToast } from '../components/translate/ImageSwitchToast'
import { ResultPanelActions } from '../components/translate/ResultPanelActions'
import { SourceLanguageSelector } from '../components/translate/SourceLanguageSelector'
import { SourcePanelActions } from '../components/translate/SourcePanelActions'
import { TargetLanguageSelector } from '../components/translate/TargetLanguageSelector'
import { TranslateError } from '../components/translate/TranslateError'
import { TranslateToolbar } from '../components/translate/TranslateToolbar'
import { VoiceOverlay } from '../components/translate/VoiceOverlay'
import { DragOverlay } from '../components/ui/DragOverlay'
import { AlertTriangleIcon, GearIcon, SpinnerIcon, SwapIcon } from '../components/ui/icons'
import { TranslateButton } from '../components/ui/TranslateButton'
import { ACCEPTED_IMAGE_MIME_TYPES } from '../constants/image'
import { MAX_INPUT_CHARS } from '../constants/providers'
import { IMAGE_TRANSLATED_SENTINEL, useTranslate } from '../hooks/useTranslate'
import { useAppStore, useT } from '../store/useAppStore'

export function TranslatePage() {
  const t = useT()
  const { setSourceLang, openSettings } = useAppStore()
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
    handleTranslate, handleRewrite, handleSwapLanguages, handleCopy,
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

  /** Controls visibility of the AI config popup */
  const [showAIConfig, setShowAIConfig] = useState(false)
  /** Ref for AI config popup — used for click-outside detection */
  const aiConfigRef = useRef<HTMLDivElement>(null)

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

  return (
    <div className="app-page">

      {/* Centered content — fills remaining height */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="app-workspace">

          {/* ── Top action bar: Language selectors + settings icon ── */}
          <div className="app-topbar">
            {/* Source language selector — left half, overflow-hidden prevents pills from bleeding right */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <SourceLanguageSelector
                sourceLang={sourceLang}
                onSourceLangChange={setSourceLang}
                detectedSourceLang={detectedSourceLang}
                isDetectingLang={isDetectingLang}
                langNames={t.lang_names}
              />
            </div>

            {/* Swap button — inline between the two selectors */}
            <button
              type="button"
              onClick={handleSwapLanguages}
              disabled={!(translatedText && translatedText !== IMAGE_TRANSLATED_SENTINEL && !imageAttachment)}
              title={t.translate_swap}
              className={`btn-icon flex-shrink-0 border-transparent bg-transparent shadow-none
                          ${!(translatedText && translatedText !== IMAGE_TRANSLATED_SENTINEL && !imageAttachment)
                            ? 'text-gray-200 dark:text-gray-700'
                            : 'text-gray-400 dark:bg-transparent'}`}
            >
              <SwapIcon className="w-5 h-5" />
            </button>

            {/* Target language selector + settings icon — right half */}
            <div className="flex-1 min-w-0 flex items-center gap-3">
              {/* overflow-hidden only on selector, NOT the whole div (gear popup must not be clipped) */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <TargetLanguageSelector
                  targetLang={targetLang}
                  onTargetLangChange={setTargetLang}
                  langNames={t.lang_names}
                />
              </div>

              {/* AI Config settings icon + popup */}
              <div className="relative flex-shrink-0" ref={aiConfigRef}>
                <button
                  type="button"
                  onClick={() => setShowAIConfig((v) => !v)}
                  title={t.translate_ai_config_title}
                  className={`toolbar-icon-button ai-config-button cursor-pointer ${showAIConfig ? 'toolbar-icon-button-active' : ''}`}
                >
                  <GearIcon className="w-3.5 h-3.5" />
                </button>

                {/* Settings popup */}
                {showAIConfig && (
                  <div className="floating-panel ai-config-panel absolute top-full right-0 mt-2 z-50 w-[520px] p-4 flex flex-col gap-4">
                    <h2 className="popover-title">
                      {t.translate_ai_config_title}
                    </h2>
                    {/* Row 1: Provider + Model selector */}
                    <ModelSelector />

                    {/* Divider */}
                    <div className="border-t border-gray-100 dark:border-gray-800" />

                    {/* Row 2: Style + Phonetic + Auto-translate */}
                    <TranslateToolbar
                      hideModelSelector
                      translationStyle={translationStyle}
                      onStyleChange={setTranslationStyle}
                      autoTranslate={autoTranslate}
                      onAutoTranslateChange={setAutoTranslate}
                      phoneticMode={phoneticMode}
                      onPhoneticModeChange={setPhoneticMode}
                      isPhoneticLoading={
                        phoneticMode !== 'off' &&
                        !phoneticText &&
                        (isTranslating || (!!translatedText && translatedText !== IMAGE_TRANSLATED_SENTINEL))
                      }
                      labelStyleLabel={t.translate_style_label}
                      labelStyleGeneral={t.translate_style_general}
                      labelStyleFormal={t.translate_style_formal}
                      labelStyleCasual={t.translate_style_casual}
                      labelStyleBusiness={t.translate_style_business}
                      labelStyleTechnical={t.translate_style_technical}
                      labelStyleNatural={t.translate_style_natural}
                      labelPhoneticSection={t.translate_phonetic}
                      labelPhoneticOff={t.translate_phonetic_off}
                      labelPhoneticStandard={t.translate_phonetic_standard}
                      labelPhoneticTranscription={t.translate_phonetic_transcription}
                      labelAutoSection={t.settings_auto_translate}
                      titleAutoMode={t.translate_mode_auto_title}
                      titleManualMode={t.translate_mode_manual_title}
                      labelAutoMode={t.translate_mode_auto}
                      labelManualMode={t.translate_mode_manual}
                    />
                  </div>
                )}
              </div>
            </div>
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

              {/* Source panel footer — LEFT: icons | RIGHT: char count + translate button */}
              <div className="surface-footer relative z-20">
                {/* LEFT: mic, image, (clear, rewrite, speak when content present) */}
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
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_IMAGE_MIME_TYPES}
                  className="hidden"
                  onChange={handleFileInputChange}
                />

                {/* RIGHT: char count + translate button */}
                <div className="flex items-center gap-3">
                  {!isVoiceActive && (
                    charCount > MAX_INPUT_CHARS ? (
                      <span className="flex items-center gap-1 text-xs tabular-nums text-gray-500 font-medium" title={t.translate_limit}>
                        <AlertTriangleIcon className="w-3 h-3 flex-shrink-0" />
                        {charCount.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-xs tabular-nums text-gray-400">
                        {charCount.toLocaleString()} {t.translate_chars}
                      </span>
                    )
                  )}
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
              </div>
            </section>

            {/* ── Result panel card ── */}
            <div className="surface-panel h-full">
              <div ref={translatedScrollRef} className="flex-1 min-h-0 overflow-auto p-4 relative">
                {isTranslating ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <SpinnerIcon className="w-5 h-5 animate-spin text-gray-500" />
                      <span className="text-sm text-gray-400">{t.translate_btn_loading}</span>
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
                      // Standard mode: show {word|reading} ruby annotations over original script
                      ? <FuriganaText text={phoneticText} className="textarea-field fade-in" />
                      // Phonetic mode: replace original script with pure phonetics (hiragana/pinyin/romanization/IPA)
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
                  labelChars={t.translate_chars}
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
