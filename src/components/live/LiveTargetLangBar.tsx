import { TargetLanguageSelector } from '../translate/TargetLanguageSelector'

interface LiveTargetLangBarProps {
  targetLang: string
  onTargetLangChange: (lang: string) => void
  langNames: Record<string, string>
}

export function LiveTargetLangBar({
  targetLang,
  onTargetLangChange,
  langNames,
}: LiveTargetLangBarProps) {
  return (
    <div className="flex-1 min-w-0">
      <TargetLanguageSelector
        targetLang={targetLang}
        onTargetLangChange={onTargetLangChange}
        langNames={langNames}
      />
    </div>
  )
}
