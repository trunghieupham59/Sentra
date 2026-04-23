import { type MutableRefObject, useEffect, useRef } from 'react'
import { FuriganaText } from '../components/FuriganaText'
import { MarkdownText } from '../components/MarkdownText'
import { ImageAttachmentPreview } from '../components/translate/ImageAttachmentPreview'
import { ImageSwitchToast } from '../components/translate/ImageSwitchToast'
import { ResultPanelActions } from '../components/translate/ResultPanelActions'
import { SourcePanelActions } from '../components/translate/SourcePanelActions'
import { TranslateError } from '../components/translate/TranslateError'
import { TranslateLanguageBar } from '../components/translate/TranslateLanguageBar'
import { TranslateToolbar } from '../components/translate/TranslateToolbar'
import { VoiceOverlay } from '../components/translate/VoiceOverlay'
import { DragOverlay } from '../components/ui/DragOverlay'
import { AlertTriangleIcon, SpinnerIcon } from '../components/ui/icons'
import { TranslateButton } from '../components/ui/TranslateButton'
import { ACCEPTED_IMAGE_MIME_TYPES } from '../constants/image'
import { MAX_INPUT_CHARS } from '../constants/providers'
import { IMAGE_TRANSLATED_SENTINEL, useTranslate } from '../hooks/useTranslate'
import { useAppStore, useT } from '../store/useAppStore'

export function TranslatePage() {
  const t = useT()
  const { setSourceLang } = useAppStore()
  const {
    // Store state
    sourceText, translatedText, phoneticText, sourceLang, targetLang,
    isTranslating, translateError, autoTranslate, phoneticMode, translationStyle,
    keyStatus, selectedProvider,
    // Store setters
    setTargetLang, setActivePage, setPhoneticMode, setTranslationStyle, setAutoTranslate,
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

  /** Shared Tailwind classes for panel footer bars (inside cards) */
  const PANEL_FOOTER_CLS =
    'flex-shrink-0 flex items-center justify-between px-4 h-12 ' +
    'border-t border-gray-200 dark:border-gray-800'

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950">

      {/* Centered content — fills remaining height */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-6 pt-6 pb-4 flex flex-col gap-4 flex-1 min-h-0 min-w-0">

          {/* Page title */}
          <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-100 flex-shrink-0">
            Dịch Thuật Với AI
          </h1>

          {/* Toolbar + Language bar — combined in a single gray card */}
          <div className="rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 px-5 py-4 flex flex-col gap-4 flex-shrink-0">
            <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Cấu hình AI Nâng Cao
            </h2>
          <TranslateToolbar
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
            labelStyleNeutral={t.translate_style_neutral}
            labelStyleFriendly={t.translate_style_friendly}
            labelStyleProfessional={t.translate_style_professional}
            labelStyleBusiness={t.translate_style_business}
            labelStyleSlack={t.translate_style_slack}
            labelStylePolite={t.translate_style_polite}
            labelStyleTechnical={t.translate_style_technical}
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

          {/* Language bar — above the panels */}
          <TranslateLanguageBar
            sourceLang={sourceLang}
            onSourceLangChange={setSourceLang}
            targetLang={targetLang}
            onTargetLangChange={setTargetLang}
            detectedSourceLang={detectedSourceLang}
            canSwap={!!(translatedText && translatedText !== IMAGE_TRANSLATED_SENTINEL && !imageAttachment)}
            isDetectingLang={isDetectingLang}
            onSwap={handleSwapLanguages}
            langNames={t.lang_names}
            swapTitle={t.translate_swap}
          />
          </div>

          {/* Text panels — smaller gap than language bar so panels sit closer together */}
          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">

            {/* ── Source panel card ── */}
            <section
              aria-label={t.image_translate_title}
              className={`flex-1 flex flex-col rounded-2xl border bg-white dark:bg-gray-900 shadow-sm overflow-hidden relative transition-all duration-150
                          ${isDraggingOver
                            ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 ring-2 ring-inset ring-emerald-300 dark:ring-emerald-700'
                            : 'border-gray-200 dark:border-gray-700 focus-within:border-blue-300 dark:focus-within:border-blue-600 focus-within:shadow-md focus-within:shadow-blue-100/50 dark:focus-within:shadow-blue-900/20'}`}
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
                className="flex-1 overflow-auto p-4"
              >
                <textarea
                  value={sourceText}
                  onChange={(e) => handleSourceChange(e.target.value)}
                  placeholder={t.translate_placeholder}
                  className={`w-full h-full bg-transparent outline-none resize-none text-[15px] leading-relaxed text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 ${isVoiceInterim ? 'opacity-50 italic' : ''}`}
                />
              </div>

              {/* Source panel footer — LEFT: icons | RIGHT: char count + translate button */}
              <div className="flex-shrink-0 flex items-center justify-between px-4 h-12 border-t border-gray-200 dark:border-gray-800 relative z-20">
                {/* LEFT: mic, image, (clear, rewrite, speak when content present) */}
                <SourcePanelActions
                  isVoiceActive={isVoiceActive}
                  isVoiceInterim={isVoiceInterim}
                  isRewriting={isRewriting}
                  sourceText={sourceText}
                  sourceLang={sourceLang}
                  hasImage={!!imageAttachment}
                  useWhisper={keyStatus.openai}
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
            <div className="flex-1 flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div ref={translatedScrollRef} className="flex-1 p-4 overflow-auto relative">
                {isTranslating ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <SpinnerIcon className="w-5 h-5 animate-spin text-blue-500" />
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
                    onOpenSettings={() => setActivePage('settings')}
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
                  <p className="text-[15px] text-gray-300 dark:text-gray-700 leading-relaxed select-none">
                    {t.translate_result_placeholder}
                  </p>
                )}
              </div>

              {/* Result panel footer */}
              <div className={PANEL_FOOTER_CLS}>
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
