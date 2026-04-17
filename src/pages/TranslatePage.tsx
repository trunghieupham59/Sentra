import { useEffect, useRef, type MutableRefObject } from 'react'
import { FuriganaText } from '../components/FuriganaText'
import { DragOverlay } from '../components/ui/DragOverlay'
import { ImageAttachmentPreview } from '../components/translate/ImageAttachmentPreview'
import { VoiceOverlay } from '../components/translate/VoiceOverlay'
import { MarkdownEditor } from '../components/MarkdownEditor'
import { MarkdownText } from '../components/MarkdownText'
import { SpinnerIcon } from '../components/ui/icons'
import { TranslateToolbar } from '../components/translate/TranslateToolbar'
import { TranslateLanguageBar } from '../components/translate/TranslateLanguageBar'
import { TranslateError } from '../components/translate/TranslateError'
import { SourcePanelActions, SourcePanelActionsRight } from '../components/translate/SourcePanelActions'
import { ResultPanelActions } from '../components/translate/ResultPanelActions'
import { ImageSwitchToast } from '../components/translate/ImageSwitchToast'
import { ACCEPTED_IMAGE_MIME_TYPES } from '../constants/image'
import { useT } from '../store/useAppStore'
import { IMAGE_TRANSLATED_SENTINEL, useTranslate } from '../hooks/useTranslate'

export function TranslatePage() {
  const t = useT()
  const {
    // Store state
    sourceText, translatedText, phoneticText, sourceLang, targetLang,
    isTranslating, translateError, autoTranslate, showFurigana, translationStyle,
    keyStatus, selectedProvider,
    // Store setters
    setTargetLang, setActivePage, setShowFurigana, setTranslationStyle, setAutoTranslate,
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

  // Prompt 2 — DUP-01: Scroll sync using factory to eliminate near-duplicate handlers
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

  /** Prompt 5 — DUP-02: Shared Tailwind classes for both panel footer bars */
  const PANEL_FOOTER_CLS =
    'flex-shrink-0 flex items-center justify-between px-4 h-12 ' +
    'border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900'

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      {/* Toolbar — Prompt 8: SPLIT-01 */}
      <TranslateToolbar
        translationStyle={translationStyle}
        onStyleChange={setTranslationStyle}
        autoTranslate={autoTranslate}
        onAutoTranslateChange={setAutoTranslate}
        showFurigana={showFurigana}
        onShowFuriganaChange={setShowFurigana}
        isPhoneticLoading={
          showFurigana &&
          !phoneticText &&
          (isTranslating || (!!translatedText && translatedText !== IMAGE_TRANSLATED_SENTINEL))
        }
        labelStyleLabel={t.translate_style_label}
        labelStyleFriendly={t.translate_style_friendly}
        labelStyleNeutral={t.translate_style_neutral}
        labelStyleProfessional={t.translate_style_professional}
        labelStyleBusiness={t.translate_style_business}
        labelStyleSlack={t.translate_style_slack}
        labelStylePolite={t.translate_style_polite}
        labelStyleTechnical={t.translate_style_technical}
        labelPhonetic={t.translate_phonetic}
        titleAutoMode={t.translate_mode_auto_title}
        titleManualMode={t.translate_mode_manual_title}
        labelAutoMode={t.translate_mode_auto}
        labelManualMode={t.translate_mode_manual}
      />

      {/* Language bar — Prompt 7: SPLIT-02 */}
      <TranslateLanguageBar
        targetLang={targetLang}
        onTargetLangChange={setTargetLang}
        detectedSourceLang={detectedSourceLang}
        canSwap={!!(translatedText && translatedText !== IMAGE_TRANSLATED_SENTINEL && !imageAttachment)}
        isDetectingLang={isDetectingLang}
        onSwap={handleSwapLanguages}
        langAutoLabel={t.lang_auto}
        langNames={t.lang_names}
        swapTitle={t.translate_swap}
      />

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
              onRemove={handleRemoveImage}
            />
          )}

          {/* ── Typora-like markdown editor ── */}
          <div
            ref={sourceScrollRef}
            className="flex-1 overflow-auto p-4 min-h-0"
          >
            <MarkdownEditor
              value={sourceText}
              onChange={handleSourceChange}
              placeholder={t.translate_placeholder}
              className={`min-h-full ${isVoiceInterim ? 'opacity-50 italic' : ''}`}
            />
          </div>

          {/* Source panel footer — Prompt 5: DUP-02 + Prompt 9: SPLIT-03 */}
          <div className={`${PANEL_FOOTER_CLS} relative z-20`}>
            <SourcePanelActions
              autoTranslate={autoTranslate}
              isTranslating={isTranslating}
              isVoiceActive={isVoiceActive}
              isVoiceInterim={isVoiceInterim}
              isRewriting={isRewriting}
              sourceText={sourceText}
              sourceLang={sourceLang}
              charCount={charCount}
              hasImage={!!imageAttachment}
              useWhisper={keyStatus.openai}
              speakingPanel={speakingPanel}
              speakLoading={speakLoading}
              onTranslate={handleTranslate}
              onVoiceTranscript={handleVoiceTranscript}
              onVoiceRecordingChange={handleVoiceRecordingChange}
              onImageButtonClick={() => fileInputRef.current?.click()}
              onSpeak={handleSpeak}
              onRewrite={handleRewrite}
              onClear={handleClearSource}
              labelTranslate={t.translate_btn}
              labelTranslating={t.translate_btn_loading}
              labelVoiceRecord={t.voice_record}
              labelVoiceStop={t.voice_stop}
              labelVoiceTranscribing={t.voice_transcribing}
              labelVoiceRecording={t.voice_whisper_mode}
              labelImageTranslate={t.image_translate_title}
              labelCharLimit={t.translate_limit}
              labelChars={t.translate_chars}
              labelSpeak={t.translate_speak}
              labelSpeakStop={t.translate_speak_stop}
              labelRewrite={t.translate_rewrite}
              labelRewriting={t.translate_rewriting}
              labelClear={t.translate_clear}
            />
            {/* Hidden file input — Prompt 3: HC-02 */}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_MIME_TYPES}
              className="hidden"
              onChange={handleFileInputChange}
            />
            {sourceText && !isVoiceActive && (
              <SourcePanelActionsRight
                sourceText={sourceText}
                sourceLang={sourceLang}
                speakingPanel={speakingPanel}
                speakLoading={speakLoading}
                isRewriting={isRewriting}
                onSpeak={handleSpeak}
                onRewrite={handleRewrite}
                onClear={handleClearSource}
                labelSpeak={t.translate_speak}
                labelSpeakStop={t.translate_speak_stop}
                labelRewrite={t.translate_rewrite}
                labelRewriting={t.translate_rewriting}
                labelClear={t.translate_clear}
              />
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
              /* Prompt 6: SPLIT-04 + Prompt 1: HC-01 */
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
              /* Prompt 4: HC-06 — alt uses i18n instead of hardcoded "Translated" */
              <img
                src={editedImageUrl}
                alt={t.image_translate_title}
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

          {/* Result panel footer — Prompt 5: DUP-02 + Prompt 9: SPLIT-05 */}
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

      {/* Prompt 10: SPLIT-06 — Model-switch warning toast as extracted component */}
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
