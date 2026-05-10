import { DEFAULT_TTS_FALLBACK_LANG } from '../../constants/providers'
import { ClearButton } from '../ui/ClearButton'
import { ImageTranslateButton } from '../ui/ImageTranslateButton'
import { RewriteButton } from '../ui/RewriteButton'
import type { SpeakPanel } from '../ui/SpeakButton'
import { SpeakButton } from '../ui/SpeakButton'
import { VoiceRecorder } from '../VoiceRecorder'

interface SourcePanelActionsProps {
  // Mode
  isVoiceActive: boolean
  isVoiceInterim: boolean
  isRewriting: 'source' | 'translated' | null
  // Content state
  sourceText: string
  sourceLang: string
  hasImage: boolean
  // TTS state
  speakingPanel: SpeakPanel | null
  speakLoading: boolean
  // Handlers
  onVoiceTranscript: (text: string, isFinal: boolean) => void
  onVoiceRecordingChange: (isRecording: boolean) => void
  onImageButtonClick: () => void
  onSpeak: (text: string, lang: string, panel: SpeakPanel) => void
  onRewrite: (panel: 'source' | 'translated') => void
  onClear: () => void
  // i18n
  labelVoiceRecord: string
  labelVoiceStop: string
  labelVoiceTranscribing: string
  labelImageTranslate: string
  labelSpeak: string
  labelSpeakStop: string
  labelRewrite: string
  labelRewriting: string
  labelClear: string
}

/**
 * Left-section icons for the source panel footer.
 * Order: mic → image → (when text present) clear → rewrite → speak
 */
export function SourcePanelActions({
  isVoiceActive, isVoiceInterim: _isVoiceInterim,
  isRewriting, sourceText, sourceLang,
  hasImage,
  speakingPanel, speakLoading,
  onVoiceTranscript, onVoiceRecordingChange, onImageButtonClick,
  onSpeak, onRewrite, onClear,
  labelVoiceRecord, labelVoiceStop,
  labelVoiceTranscribing, labelImageTranslate,
  labelSpeak, labelSpeakStop,
  labelRewrite, labelRewriting, labelClear,
}: SourcePanelActionsProps) {
  const hasContent = (sourceText.trim().length > 0 || hasImage) && !isVoiceActive

  return (
    <div className="flex items-center gap-1.5">
      {/* Speaker always first — disabled when empty */}
      <SpeakButton
        panel="source"
        text={sourceText}
        lang={sourceLang === 'auto' ? DEFAULT_TTS_FALLBACK_LANG : sourceLang}
        speakingPanel={speakingPanel}
        speakLoading={speakLoading}
        onSpeak={onSpeak}
        labelSpeak={labelSpeak}
        labelStop={labelSpeakStop}
      />
      <VoiceRecorder
        sourceLang={sourceLang}
        onTranscript={onVoiceTranscript}
        onRecordingChange={onVoiceRecordingChange}
        titleRecord={labelVoiceRecord}
        titleStop={labelVoiceStop}
        buttonClassName="btn-ghost btn-xs relative text-gray-500"
        labelTranscribing={labelVoiceTranscribing}
      />
      <ImageTranslateButton
        onClick={onImageButtonClick}
        title={labelImageTranslate}
        className="btn-ghost btn-xs text-gray-500"
      />
      {hasContent && (
        <>
          <ClearButton onClick={onClear} label={labelClear} />
          <RewriteButton
            panel="source"
            isRewriting={isRewriting}
            onRewrite={onRewrite}
            labelRewrite={labelRewrite}
            labelRewriting={labelRewriting}
          />
        </>
      )}
    </div>
  )
}
