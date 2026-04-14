/**
 * SpeakButton — reusable speak/stop button for TranslatePage panels.
 *
 * Encapsulates the three-state icon logic (loading → speaking → idle) that
 * was previously duplicated for the source and translated text panels.
 *
 * @example
 * <SpeakButton
 *   panel="source"
 *   text={sourceText}
 *   lang={sourceLang === 'auto' ? 'en' : sourceLang}
 *   speakingPanel={speakingPanel}
 *   speakLoading={speakLoading}
 *   onSpeak={handleSpeak}
 *   labelSpeak={t.translate_speak}
 *   labelStop={t.translate_speak_stop}
 * />
 */

export type SpeakPanel = 'source' | 'translated'

interface SpeakButtonProps {
  /** Which panel this button controls */
  panel: SpeakPanel
  text: string
  lang: string
  /** Currently speaking panel (null if not speaking) */
  speakingPanel: SpeakPanel | null
  /** True while the TTS audio is being fetched/decoded */
  speakLoading: boolean
  onSpeak: (text: string, lang: string, panel: SpeakPanel) => void
  labelSpeak: string
  labelStop: string
}

export function SpeakButton({
  panel,
  text,
  lang,
  speakingPanel,
  speakLoading,
  onSpeak,
  labelSpeak,
  labelStop,
}: SpeakButtonProps) {
  const isThisPanel = speakingPanel === panel
  const isLoading = speakLoading && isThisPanel

  return (
    <button
      type="button"
      onClick={() => onSpeak(text, lang, panel)}
      title={isThisPanel ? labelStop : labelSpeak}
      className={[
        'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
        'transition-all duration-200 cursor-pointer',
        isThisPanel
          ? 'bg-blue-500 text-white shadow-sm hover:bg-blue-600'
          : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 dark:hover:text-blue-400',
      ].join(' ')}
    >
      {isLoading ? (
        /* Loading spinner */
        <>
          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="hidden min-[1100px]:inline">{labelSpeak}</span>
        </>
      ) : isThisPanel ? (
        /* Stop icon */
        <>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
          </svg>
          <span className="hidden min-[1100px]:inline">{labelStop}</span>
        </>
      ) : (
        /* Speaker icon */
        <>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 01-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
            <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
          </svg>
          <span className="hidden min-[1100px]:inline">{labelSpeak}</span>
        </>
      )}
    </button>
  )
}
