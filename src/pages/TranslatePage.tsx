import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FuriganaText } from '../components/FuriganaText'
import { LanguageSelector } from '../components/LanguageSelector'
import { ModelSelector } from '../components/ModelSelector'
import { VoiceRecorder } from '../components/VoiceRecorder'
import { useAppStore, useT } from '../store/useAppStore'
import type { HistoryItem, TranslationStyle } from '../types'

const MAX_CHARS = 5000

/** Map app language codes → BCP-47 tags understood by SpeechSynthesis */
const LANG_TO_BCP47: Record<string, string> = {
  vi: 'vi-VN', en: 'en-US', zh: 'zh-CN', 'zh-TW': 'zh-TW',
  ja: 'ja-JP', ko: 'ko-KR', fr: 'fr-FR', de: 'de-DE',
  es: 'es-ES', pt: 'pt-PT', ru: 'ru-RU', ar: 'ar-SA',
  th: 'th-TH', id: 'id-ID', it: 'it-IT', nl: 'nl-NL',
  pl: 'pl-PL', tr: 'tr-TR', hi: 'hi-IN',
}

export function TranslatePage() {
  const {
    sourceText, translatedText, phoneticText, sourceLang, targetLang,
    isTranslating, translateError,
    selectedProvider, selectedModels, autoTranslate, autoTranslateDelay, keyStatus, showFurigana, translationStyle,
    ttsVoice,
    setSourceText, setTranslatedText, setPhoneticText, setSourceLang, setTargetLang,
    swapLanguages, setIsTranslating, setTranslateError, setActivePage, setShowFurigana, setTranslationStyle, addHistory,
  } = useAppStore()
  const t = useT()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasKey = keyStatus[selectedProvider]
  const charCount = sourceText.length
  const isOverLimit = charCount > MAX_CHARS
  const [copied, setCopied] = useState(false)

  // TTS (text-to-speech) state
  const [speakingPanel, setSpeakingPanel] = useState<'source' | 'translated' | null>(null)
  const [speakLoading, setSpeakLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])

  // Load OS voices — they populate asynchronously on first access (used as fallback)
  useEffect(() => {
    if (!window.speechSynthesis) return
    const load = () => { voicesRef.current = window.speechSynthesis.getVoices() }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  // Stop all audio (AI or OS) and reset state
  const stopSpeak = useCallback(() => {
    audioRef.current?.pause()
    audioRef.current = null
    window.speechSynthesis?.cancel()
    setSpeakingPanel(null)
    setSpeakLoading(false)
  }, [])

  const handleSpeak = useCallback(async (text: string, lang: string, panel: 'source' | 'translated') => {
    // Toggle off if already speaking this panel
    if (speakingPanel === panel || speakLoading) {
      stopSpeak()
      return
    }
    stopSpeak()
    setSpeakingPanel(panel)

    // ── Try AI TTS (OpenAI) — always attempt, let the backend check for the key ──
    try {
      setSpeakLoading(true)
      const result = await window.api.speakText({ text, voice: ttsVoice })
      setSpeakLoading(false)

      if (result.success && result.audioBase64) {
        // Use data URL (base64) — avoids IPC ArrayBuffer serialization issues
        const dataUrl = `data:audio/mpeg;base64,${result.audioBase64}`
        const audio = new Audio(dataUrl)
        audioRef.current = audio
        audio.onended = () => { audioRef.current = null; setSpeakingPanel(null) }
        audio.onerror = () => { audioRef.current = null; setSpeakingPanel(null) }
        audio.play().catch(() => { audioRef.current = null; setSpeakingPanel(null) })
        return
      }
      // result.success is false (e.g. NO_API_KEY) → fall through to OS TTS
    } catch {
      setSpeakLoading(false)
      // Fall through to OS TTS below
    }

    // ── Fallback: OS speech synthesis ─────────────────────────────────────
    if (!window.speechSynthesis) { setSpeakingPanel(null); return }
    const utter = new SpeechSynthesisUtterance(text)
    const bcp47 = LANG_TO_BCP47[lang]
    if (bcp47) {
      utter.lang = bcp47
      const all = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices()
      const local = all.filter(v => v.localService)
      const prefix = bcp47.split('-')[0]
      const best =
        local.find(v => v.lang === bcp47) ??
        all.find(v => v.lang === bcp47) ??
        local.find(v => v.lang.startsWith(prefix)) ??
        all.find(v => v.lang.startsWith(prefix))
      if (best) utter.voice = best
    }
    utter.onend = () => setSpeakingPanel(null)
    utter.onerror = () => setSpeakingPanel(null)
    window.speechSynthesis.speak(utter)
  }, [speakingPanel, speakLoading, ttsVoice, stopSpeak])

  // Voice recording state
  const [isVoiceActive, setIsVoiceActive] = useState(false)
  const [isVoiceInterim, setIsVoiceInterim] = useState(false)
  // Store the text that was in the textarea when recording started, so voice appends to it
  const voicePrefixRef = useRef('')

  const handleVoiceRecordingChange = useCallback((recording: boolean) => {
    if (recording) {
      // Capture the current text as prefix — voice transcript will append after it
      voicePrefixRef.current = sourceText ? `${sourceText.trimEnd()} ` : ''
      setIsVoiceActive(true)
    } else {
      setIsVoiceActive(false)
      setIsVoiceInterim(false)
    }
  }, [sourceText])

  const handleVoiceTranscript = useCallback((transcript: string, isFinal: boolean) => {
    const combined = voicePrefixRef.current + transcript
    setSourceText(combined)
    setIsVoiceInterim(!isFinal)
  }, [setSourceText])

  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim() || isTranslating) return
    if (!hasKey) {
      setTranslateError(t.translate_error_no_key)
      return
    }
    setIsTranslating(true)
    setTranslateError(null)
    setPhoneticText('') // Clear old phonetic while re-translating
    try {
      const baseParams = {
        provider: selectedProvider,
        model: selectedModels[selectedProvider],
        sourceText,
        sourceLang,
        targetLang,
        translationStyle,
      }

      // Step 1: Plain translation first — show result to user immediately
      const plainResult = await window.api.translate({ ...baseParams, showFurigana: false })

      if (plainResult.success && plainResult.translatedText) {
        const plainText = plainResult.translatedText
        setTranslatedText(plainText)
        setIsTranslating(false) // Unblock UI right away

        const item: HistoryItem = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          provider: selectedProvider,
          model: selectedModels[selectedProvider],
          sourceLang,
          targetLang,
          sourceText,
          translatedText: plainText,
        }
        addHistory(item)

        // Step 2: Fetch phonetic silently in the background (non-blocking).
        // Pass the already-translated plainText so the AI only adds phonetic
        // annotations without re-translating — keeping phonetic in sync with
        // the translation shown to the user.
        window.api.translate({
          ...baseParams,
          sourceText: plainText,
          showFurigana: true,
          phoneticOnly: true,
        })
          .then((res) => {
            if (res.success && res.translatedText) {
              setPhoneticText(res.translatedText)
            }
          })
          .catch(() => { /* ignore phonetic errors silently */ })
      } else {
        setTranslateError(plainResult.error || 'Translation failed')
      }
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setIsTranslating(false)
    }
  }, [sourceText, sourceLang, targetLang, selectedProvider, selectedModels, isTranslating, hasKey,
      translationStyle, setIsTranslating, setTranslateError, setTranslatedText, setPhoneticText, addHistory, t])

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

  // Stable refs for effects below (avoids stale closures without re-triggering effects)
  const styleInitRef = useRef(false)
  const langInitRef = useRef(false)
  const handleTranslateRef = useRef(handleTranslate)
  const sourceTextRef = useRef(sourceText)
  handleTranslateRef.current = handleTranslate
  sourceTextRef.current = sourceText

  useLayoutEffect(() => {
    styleInitRef.current = false
    langInitRef.current = false
  }, [])

  // Re-translate when style changes (skip first render)
  // biome-ignore lint/correctness/useExhaustiveDependencies: translationStyle is the intentional trigger; handleTranslate is accessed via a stable ref
  useEffect(() => {
    if (!styleInitRef.current) { styleInitRef.current = true; return }
    handleTranslateRef.current()
  }, [translationStyle])

  // Re-translate when target or source language changes (skip first render)
  // This fires whenever the user switches the target/source language dropdown.
  // biome-ignore lint/correctness/useExhaustiveDependencies: lang changes are the triggers; sourceText/handleTranslate accessed via stable refs
  useEffect(() => {
    if (!langInitRef.current) { langInitRef.current = true; return }
    if (!sourceTextRef.current.trim()) return
    handleTranslateRef.current()
  }, [targetLang, sourceLang])

  const handleCopy = async () => {
    const textToCopy = showFurigana && phoneticText ? phoneticText : translatedText
    if (!textToCopy) return
    await navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

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
                            ${translationStyle !== 'standard'
                              ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400'
                              : 'bg-gray-100 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                            }`}
              >
                <option value="standard">{t.translate_style_standard}</option>
                <option value="casual">{t.translate_style_casual}</option>
                <option value="formal">{t.translate_style_formal}</option>
                <option value="message">{t.translate_style_message}</option>
                <option value="technical">{t.translate_style_technical}</option>
              </select>
              <div className="pointer-events-none absolute right-2 inset-y-0 flex items-center">
                <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Phonetic reading toggle */}
          <button
            type="button"
            onClick={() => setShowFurigana(!showFurigana)}
            title={t.translate_phonetic}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium
                        border transition-all duration-200 select-none cursor-pointer whitespace-nowrap
                        ${showFurigana
                          ? 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-900'
                          : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'
                        }`}
          >
            <span className={`relative inline-flex shrink-0 items-center w-7 h-4 rounded-full transition-colors duration-200
                              ${showFurigana ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <span className={`absolute w-3 h-3 bg-white rounded-full shadow transition-transform duration-200
                                ${showFurigana ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
            </span>
            <span>{t.translate_phonetic}</span>
          </button>
        </div>
      </div>

      {/* Language bar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2
                      bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="flex-1">
          <LanguageSelector value={sourceLang} onChange={setSourceLang} includeAuto={true} />
        </div>

        <button
          type="button"
          onClick={swapLanguages}
          title={t.translate_swap}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
                     text-gray-400 hover:text-gray-600 hover:bg-gray-100
                     dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </button>

        <div className="flex-1">
          <LanguageSelector value={targetLang} onChange={setTargetLang} includeAuto={false} />
        </div>
      </div>

        {/* Text panels */}
      <div className="flex flex-1 min-h-0 divide-x divide-gray-200 dark:divide-gray-800">
        {/* Source panel */}
        <div className="flex-1 flex flex-col min-w-0 relative">

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
                <div className="relative w-16 h-16 rounded-full bg-red-500 dark:bg-red-600 flex items-center justify-center shadow-xl shadow-red-200 dark:shadow-red-900/60">
                  <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" />
                    <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round" />
                  </svg>
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

          {/* Normal text input (hidden behind overlay when voice active) */}
          <div className="flex-1 p-4 overflow-auto">
            <textarea
              value={sourceText}
              onChange={(e) => {
                const val = e.target.value
                setSourceText(val)
                // Clear translation output when source is empty
                if (!val.trim()) {
                  setTranslatedText('')
                  setPhoneticText('')
                }
                // If user types while voice is active, reset prefix
                if (isVoiceActive) voicePrefixRef.current = ''
              }}
              placeholder={t.translate_placeholder}
              className={[
                'textarea-field transition-colors duration-150',
                isVoiceInterim ? 'text-gray-400 dark:text-gray-500 italic' : '',
              ].join(' ')}
              style={{ minHeight: '100%' }}
            />
          </div>

          <div className="flex-shrink-0 flex items-center justify-between px-4 h-12
                          border-t border-gray-100 dark:border-gray-800 relative z-20 bg-white dark:bg-gray-900">
            <div className="flex items-center gap-2">
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
                disabled={isOverLimit}
              />
              {!isVoiceActive && (
                <span className={`text-xs tabular-nums ${isOverLimit ? 'text-red-500' : 'text-gray-400'}`}>
                  {charCount.toLocaleString()}&thinsp;/&thinsp;{MAX_CHARS.toLocaleString()}
                </span>
              )}
            </div>
            {sourceText && !isVoiceActive && (
              <div className="flex items-center gap-2">
                {/* Speak source text */}
                <button
                  type="button"
                  onClick={() => handleSpeak(sourceText, sourceLang === 'auto' ? 'en' : sourceLang, 'source')}
                  title={speakingPanel === 'source' ? t.translate_speak_stop : t.translate_speak}
                  className={[
                    'relative flex items-center justify-center w-8 h-8 rounded-full',
                    'transition-all duration-200 cursor-pointer',
                    speakingPanel === 'source'
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/50 hover:bg-blue-600'
                      : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 dark:hover:text-blue-400',
                  ].join(' ')}
                >
                  {speakLoading && speakingPanel === 'source' ? (
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : speakingPanel === 'source' ? (
                    /* Stop — filled square */
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    /* Speaker wave — filled */
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 01-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
                      <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setSourceText(''); setTranslatedText(''); setPhoneticText(''); setTranslateError(null) }}
                  className="btn-ghost py-1 px-2 text-xs"
                >
                  {t.translate_clear}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Result panel */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex-1 p-4 overflow-auto relative">
            {isTranslating ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <svg className="w-5 h-5 spinner text-blue-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm text-gray-400">{t.translate_btn_loading}</span>
                </div>
              </div>
            ) : translateError ? (
              <div className="fade-in flex flex-col gap-3">
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30
                                border border-red-200 dark:border-red-900 rounded-lg">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-red-700 dark:text-red-300">{translateError}</p>
                </div>
                {(translateError.includes('API key') || translateError.includes('Settings') ||
                  translateError.includes('Cài đặt') || translateError.includes('設定')) && (
                  <button type="button" onClick={() => setActivePage('settings')} className="btn-primary w-fit text-xs">
                    {t.translate_error_open_settings}
                  </button>
                )}
              </div>
            ) : translatedText ? (
              <FuriganaText
                text={showFurigana && phoneticText ? phoneticText : translatedText}
                className="textarea-field fade-in"
              />
            ) : (
              <p className="text-[15px] text-gray-300 dark:text-gray-700 leading-relaxed select-none">
                {t.translate_result_placeholder}
              </p>
            )}
          </div>

          <div className="flex-shrink-0 flex items-center justify-between px-4 h-12
                          border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-400 tabular-nums">
              {translatedText ? `${translatedText.length.toLocaleString()} ${t.translate_chars}` : ''}
            </span>
            {translatedText && (
              <div className="flex items-center gap-2">
                {/* Speak translated text */}
                <button
                  type="button"
                  onClick={() => handleSpeak(translatedText, targetLang, 'translated')}
                  title={speakingPanel === 'translated' ? t.translate_speak_stop : t.translate_speak}
                  className={[
                    'relative flex items-center justify-center w-8 h-8 rounded-full',
                    'transition-all duration-200 cursor-pointer',
                    speakingPanel === 'translated'
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/50 hover:bg-blue-600'
                      : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 dark:hover:text-blue-400',
                  ].join(' ')}
                >
                  {speakLoading && speakingPanel === 'translated' ? (
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : speakingPanel === 'translated' ? (
                    /* Stop — filled square */
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    /* Speaker wave — filled */
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 01-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
                      <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
                    </svg>
                  )}
                </button>
                <button type="button" onClick={handleCopy} className={`btn-ghost py-1 px-2 text-xs transition-all ${copied ? 'text-green-600' : ''}`}>
                  {copied ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t.translate_copied}
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      {t.translate_copy}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
