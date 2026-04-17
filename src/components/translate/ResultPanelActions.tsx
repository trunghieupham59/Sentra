import { CopyButton } from '../ui/CopyButton'
import { DownloadImageButton } from '../ui/DownloadImageButton'
import { RewriteButton } from '../ui/RewriteButton'
import { SpeakButton } from '../ui/SpeakButton'
import type { SpeakPanel } from '../ui/SpeakButton'

interface ResultPanelActionsProps {
  translatedText: string
  targetLang: string
  editedImageUrl: string | null
  hasImageRegions: boolean
  hasImageAttachment: boolean
  copied: boolean
  isRewriting: 'source' | 'translated' | null
  speakingPanel: SpeakPanel | null
  speakLoading: boolean
  onSpeak: (text: string, lang: string, panel: SpeakPanel) => void
  onDownloadEdited: () => void
  onDownloadTranslated: () => void
  onRewrite: (panel: 'source' | 'translated') => void
  onCopy: () => void
  labelChars: string
  labelSpeak: string
  labelSpeakStop: string
  labelDownload: string
  labelRewrite: string
  labelRewriting: string
  labelCopy: string
  labelCopied: string
}

export function ResultPanelActions({
  translatedText, targetLang, editedImageUrl,
  hasImageRegions, hasImageAttachment,
  copied, isRewriting, speakingPanel, speakLoading,
  onSpeak, onDownloadEdited, onDownloadTranslated, onRewrite, onCopy,
  labelChars, labelSpeak, labelSpeakStop, labelDownload,
  labelRewrite, labelRewriting, labelCopy, labelCopied,
}: ResultPanelActionsProps) {
  return (
    <>
      <span className="text-xs text-gray-400 tabular-nums">
        {translatedText && !editedImageUrl
          ? `${translatedText.length.toLocaleString()} ${labelChars}`
          : ''}
      </span>
      {(translatedText || editedImageUrl) && (
        <div className="flex items-center gap-2">
          {!editedImageUrl && (
            <SpeakButton
              panel="translated"
              text={translatedText}
              lang={targetLang}
              speakingPanel={speakingPanel}
              speakLoading={speakLoading}
              onSpeak={onSpeak}
              labelSpeak={labelSpeak}
              labelStop={labelSpeakStop}
            />
          )}
          {editedImageUrl && (
            <DownloadImageButton
              title={labelDownload}
              onClick={onDownloadEdited}
            />
          )}
          {hasImageRegions && hasImageAttachment && !editedImageUrl && (
            <DownloadImageButton
              title={labelDownload}
              onClick={onDownloadTranslated}
            />
          )}
          {!editedImageUrl && (
            <RewriteButton
              panel="translated"
              isRewriting={isRewriting}
              onRewrite={onRewrite}
              labelRewrite={labelRewrite}
              labelRewriting={labelRewriting}
            />
          )}
          {!editedImageUrl && (
            <CopyButton
              copied={copied}
              onClick={onCopy}
              labelCopy={labelCopy}
              labelCopied={labelCopied}
            />
          )}
        </div>
      )}
    </>
  )
}
