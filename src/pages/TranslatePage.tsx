import { useEffect, useRef, useCallback, useState } from 'react'
import { useAppStore, useT } from '../store/useAppStore'
import { LanguageSelector } from '../components/LanguageSelector'
import { ModelSelector } from '../components/ModelSelector'
import { HistoryItem } from '../types'

const MAX_CHARS = 5000

export function TranslatePage() {
  const {
    sourceText, translatedText, sourceLang, targetLang,
    isTranslating, translateError,
    selectedProvider, selectedModels, autoTranslate, autoTranslateDelay, keyStatus,
    setSourceText, setTranslatedText, setSourceLang, setTargetLang,
    swapLanguages, setIsTranslating, setTranslateError, setActivePage, setAutoTranslate, addHistory,
  } = useAppStore()
  const t = useT()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasKey = keyStatus[selectedProvider]
  const charCount = sourceText.length
  const isOverLimit = charCount > MAX_CHARS
  const [copied, setCopied] = useState(false)

  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim() || isTranslating) return
    if (!hasKey) {
      setTranslateError(t.translate_error_no_key)
      return
    }
    setIsTranslating(true)
    setTranslateError(null)
    try {
      const result = await window.api.translate({
        provider: selectedProvider,
        model: selectedModels[selectedProvider],
        sourceText,
        sourceLang,
        targetLang,
      })
      if (result.success && result.translatedText) {
        setTranslatedText(result.translatedText)
        const item: HistoryItem = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          provider: selectedProvider,
          model: selectedModels[selectedProvider],
          sourceLang,
          targetLang,
          sourceText,
          translatedText: result.translatedText,
        }
        addHistory(item)
      } else {
        setTranslateError(result.error || 'Translation failed')
      }
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setIsTranslating(false)
    }
  }, [sourceText, sourceLang, targetLang, selectedProvider, selectedModels, isTranslating, hasKey,
      setIsTranslating, setTranslateError, setTranslatedText, t])

  // Auto-translate debounce (only when autoTranslate is enabled)
  useEffect(() => {
    if (!autoTranslate || !sourceText.trim()) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(handleTranslate, autoTranslateDelay)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [sourceText, sourceLang, targetLang, selectedProvider, selectedModels[selectedProvider], autoTranslate])

  const handleCopy = async () => {
    if (!translatedText) return
    await navigator.clipboard.writeText(translatedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5
                      bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <ModelSelector />
        {/* Auto / Manual toggle switch */}
        <button
          type="button"
          onClick={() => setAutoTranslate(!autoTranslate)}
          title={autoTranslate ? t.translate_auto_indicator : t.translate_manual_indicator}
          className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
                      border transition-all duration-200 select-none cursor-pointer
                      ${autoTranslate
                        ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900'
                        : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'
                      }`}
        >
          {/* Track */}
          <span className={`relative inline-flex items-center w-7 h-4 rounded-full transition-colors duration-200
                            ${autoTranslate ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
            {/* Thumb */}
            <span className={`absolute w-3 h-3 bg-white rounded-full shadow transition-transform duration-200
                              ${autoTranslate ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
          </span>
          <span>{autoTranslate ? t.translate_auto_indicator : t.translate_manual_indicator}</span>
        </button>
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
          disabled={sourceLang === 'auto'}
          title={t.translate_swap}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
                     text-gray-400 hover:text-gray-600 hover:bg-gray-100
                     disabled:opacity-25 disabled:cursor-not-allowed
                     dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 p-4 overflow-auto">
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder={t.translate_placeholder}
              className="textarea-field"
              style={{ minHeight: '100%' }}
            />
          </div>
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2
                          border-t border-gray-100 dark:border-gray-800">
            <span className={`text-xs tabular-nums ${isOverLimit ? 'text-red-500' : 'text-gray-400'}`}>
              {charCount.toLocaleString()}&thinsp;/&thinsp;{MAX_CHARS.toLocaleString()}
            </span>
            {sourceText && (
              <button
                type="button"
                onClick={() => { setSourceText(''); setTranslatedText(''); setTranslateError(null) }}
                className="btn-ghost py-1 px-2 text-xs"
              >
                {t.translate_clear}
              </button>
            )}
          </div>
        </div>

        {/* Result panel */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex-1 p-4 overflow-auto relative">
            {isTranslating ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <svg className="w-5 h-5 spinner text-blue-500" fill="none" viewBox="0 0 24 24">
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
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <p className="textarea-field whitespace-pre-wrap fade-in">{translatedText}</p>
            ) : (
              <p className="text-[15px] text-gray-300 dark:text-gray-700 leading-relaxed select-none">
                {t.translate_result_placeholder}
              </p>
            )}
          </div>

          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2
                          border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-400 tabular-nums">
              {translatedText ? `${translatedText.length.toLocaleString()} ${t.translate_chars}` : ''}
            </span>
            {translatedText && (
              <button type="button" onClick={handleCopy} className={`btn-ghost py-1 px-2 text-xs transition-all ${copied ? 'text-green-600' : ''}`}>
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t.translate_copied}
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    {t.translate_copy}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5
                      bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        {/* Manual mode note */}
        {!autoTranslate && (
          <p className="text-xs text-gray-400">
            {t.translate_manual_indicator} — {t.settings_translate_mode_desc.split(';')[1]?.trim()}
          </p>
        )}
        <div className="ml-auto">
          <button
            type="button"
            onClick={handleTranslate}
            disabled={!sourceText.trim() || isTranslating || isOverLimit}
            className="btn-primary"
          >
            {isTranslating ? (
              <>
                <svg className="w-4 h-4 spinner" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t.translate_btn_loading}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                {t.translate_btn}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
