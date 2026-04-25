import { SourceLanguageSelector } from '../translate/SourceLanguageSelector'

interface LiveSourceLangBarProps {
  sourceLang: string
  onSourceLangChange: (lang: string) => void
  detectedSourceLang: string | null
  isDetectingLang: boolean
  langNames: Record<string, string>
}

export function LiveSourceLangBar({
  sourceLang,
  onSourceLangChange,
  detectedSourceLang,
  isDetectingLang,
  langNames,
}: LiveSourceLangBarProps) {
  return (
    <div className="flex-1 min-w-0">
      <SourceLanguageSelector
        sourceLang={sourceLang}
        onSourceLangChange={onSourceLangChange}
        detectedSourceLang={detectedSourceLang}
        isDetectingLang={isDetectingLang}
        langNames={langNames}
      />
    </div>
  )
}
