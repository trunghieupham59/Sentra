import { DEFAULT_TTS_FALLBACK_LANG, MAX_INPUT_CHARS } from '../../constants/providers'
import { ClearButton } from '../ui/ClearButton'
import { ImageTranslateButton } from '../ui/ImageTranslateButton'
import { AlertTriangleIcon } from '../ui/icons'
import { RewriteButton } from '../ui/RewriteButton'
import type { SpeakPanel } from '../ui/SpeakButton'
import { SpeakButton } from '../ui/SpeakButton'
import { TranslateButton } from '../ui/TranslateButton'
import { VoiceRecorder } from '../VoiceRecorder'

interface SourcePanelActionsProps {
  // Mode
  autoTranslate: boolean
  isTranslating: boolean
  isVoiceActive: boolean
  isVoiceInterim: boolean
  isRewriting: 'source' | 'translated' | null
  // Content state
  sourceText: string
  sourceLang: string
  charCount: number
  hasImage: boolean
  useWhisper: boolean
  // TTS state
  speakingPanel: SpeakPanel | null
  speakLoading: boolean
  // Handlers
  onTranslate: () => void
  onVoiceTranscript: (text: string, isFinal: boolean) => void
  onVoiceRecordingChange: (isRecording: boolean) => void
  onImageButtonClick: () => void
  onSpeak: (text: string, lang: string, panel: SpeakPanel) => void
  onRewrite: (panel: 'source' | 'translated') => void
  onClear: () => void
  // i18n
  labelTranslate: string
  labelTranslating: string
  labelVoiceRecord: string
  labelVoiceStop: string
  labelVoiceTranscribing: string
  labelVoiceRecording: string
  labelImageTranslate: string
  labelCharLimit: string
  labelChars: string
  labelSpeak: string
  labelSpeakStop: string
  labelRewrite: string
  labelRewriting: string
  labelClear: string
}

export function SourcePanelActions({
  autoTranslate, isTranslating, isVoiceActive, isVoiceInterim: _isVoiceInterim,
  isRewriting: _isRewriting, sourceText, sourceLang, charCount, hasImage, useWhisper,
  speakingPanel: _speakingPanel, speakLoading: _speakLoading,
  onTranslate, onVoiceTranscript, onVoiceRecordingChange, onImageButtonClick,
  onSpeak: _onSpeak, onRewrite: _onRewrite, onClear: _onClear,
  labelTranslate, labelTranslating, labelVoiceRecord, labelVoiceStop,
  labelVoiceTranscribing, labelVoiceRecording, labelImageTranslate,
  labelCharLimit, labelChars, labelSpeak: _labelSpeak, labelSpeakStop: _labelSpeakStop,
  labelRewrite: _labelRewrite, labelRewriting: _labelRewriting, labelClear: _labelClear,
}: SourcePanelActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {!autoTranslate && (
        <TranslateButton
          isTranslating={isTranslating}
          disabled={!sourceText.trim() && !hasImage}
          onClick={onTranslate}
          labelTranslate={labelTranslate}
          labelLoading={labelTranslating}
        />
      )}
      <VoiceRecorder
        sourceLang={sourceLang}
        onTranscript={onVoiceTranscript}
        onRecordingChange={onVoiceRecordingChange}
        titleRecord={labelVoiceRecord}
        titleStop={labelVoiceStop}
        labelTranscribing={labelVoiceTranscribing}
        labelRecording={labelVoiceRecording}
        useWhisper={useWhisper}
      />
      <ImageTranslateButton
        onClick={onImageButtonClick}
        title={labelImageTranslate}
      />
      {!isVoiceActive && (
        charCount > MAX_INPUT_CHARS ? (
          <span className="flex items-center gap-1 text-xs tabular-nums text-amber-500 font-medium" title={labelCharLimit}>
            <AlertTriangleIcon className="w-3 h-3 flex-shrink-0" />
            {charCount.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()}
          </span>
        ) : (
          <span className="text-xs tabular-nums text-gray-400">
            {charCount.toLocaleString()} {labelChars}
          </span>
        )
      )}
    </div>
  )
}

// Right side sub-section — only shown when sourceText is present and not voice active
interface SourcePanelActionsRightProps {
  sourceText: string
  sourceLang: string
  speakingPanel: SpeakPanel | null
  speakLoading: boolean
  isRewriting: 'source' | 'translated' | null
  onSpeak: (text: string, lang: string, panel: SpeakPanel) => void
  onRewrite: (panel: 'source' | 'translated') => void
  onClear: () => void
  labelSpeak: string
  labelSpeakStop: string
  labelRewrite: string
  labelRewriting: string
  labelClear: string
}

export function SourcePanelActionsRight({
  sourceText, sourceLang, speakingPanel, speakLoading, isRewriting,
  onSpeak, onRewrite, onClear,
  labelSpeak, labelSpeakStop, labelRewrite, labelRewriting, labelClear,
}: SourcePanelActionsRightProps) {
  return (
    <div className="flex items-center gap-2">
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
      <RewriteButton
        panel="source"
        isRewriting={isRewriting}
        onRewrite={onRewrite}
        labelRewrite={labelRewrite}
        labelRewriting={labelRewriting}
      />
      <ClearButton
        onClick={onClear}
        label={labelClear}
      />
    </div>
  )
}
