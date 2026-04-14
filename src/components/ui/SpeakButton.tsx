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
import { SpinnerIcon, StopIcon, SpeakerIcon } from './icons'

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
          <SpinnerIcon />
          <span className="hidden min-[1100px]:inline">{labelSpeak}</span>
        </>
      ) : isThisPanel ? (
        /* Stop icon */
        <>
          <StopIcon />
          <span className="hidden min-[1100px]:inline">{labelStop}</span>
        </>
      ) : (
        /* Speaker icon */
        <>
          <SpeakerIcon />
          <span className="hidden min-[1100px]:inline">{labelSpeak}</span>
        </>
      )}
    </button>
  )
}
