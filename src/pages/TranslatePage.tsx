import { useEffect, useRef } from 'react'
import { FuriganaText } from '../components/FuriganaText'
import { DragOverlay } from '../components/ui/DragOverlay'
import { ImageAttachmentPreview } from '../components/translate/ImageAttachmentPreview'
import { VoiceOverlay } from '../components/translate/VoiceOverlay'
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
import { MAX_INPUT_CHARS } from '../constants/providers'
import { useT } from '../store/useAppStore'
import type { TranslationStyle } from '../types'
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
    // TTS
    speakingPanel, speakLoading, handleSpeak,
    // Voice
    isVoiceActive, isVoiceInterim, handleVoiceRecordingChange, handleVoiceTranscript,
    // Refs
    fileInputRef,
    // Handlers
    handleTranslate, handleRewrite, handleSwapLanguages, handleCopy,
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

          {/* Phonetic reading toggle — show spinner while phonetic pass is in flight */}
          <PhoneticToggle
            showFurigana={showFurigana}
            onChange={setShowFurigana}
            label={t.translate_phonetic}
            isLoading={
              showFurigana &&
              !phoneticText &&
              (isTranslating || (!!translatedText && translatedText !== IMAGE_TRANSLATED_SENTINEL))
            }
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
              onRemove={handleRemoveImage}
            />
          )}


          {/* ── Typora-like markdown editor (line being edited = raw, others = rendered) ── */}
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
                  onClick={handleClearSource}
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
                    onClick={handleDownloadEditedImage}
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
