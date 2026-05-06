import { TARGET_LANGUAGES } from '../../constants/providers'
import { useAppStore, useT } from '../../store/useAppStore'
import { AutoDetectIcon, ChevronDownIcon, SpinnerIcon } from '../ui/icons'
import { getSmartTopLangs } from './langSelectorUtils'

interface SourceLanguageSelectorProps {
  sourceLang: string
  onSourceLangChange: (lang: string) => void
  detectedSourceLang: string | null
  isDetectingLang: boolean
  langNames: Record<string, string>
}

export function SourceLanguageSelector({
  sourceLang,
  onSourceLangChange,
  detectedSourceLang,
  isDetectingLang,
  langNames,
}: SourceLanguageSelectorProps) {
  const { langUsage, recordLangUsage } = useAppStore()
  const t = useT()

  const sourceTopLangs = getSmartTopLangs(langUsage, sourceLang)
  const sourceIsOther = sourceLang !== 'auto' && !sourceTopLangs.includes(sourceLang)

  const pillBase =
    'btn-language-tab relative flex-shrink-0 whitespace-nowrap'
  const pillActive = 'text-gray-700 dark:text-gray-200'
  const pillInactive = 'text-gray-500 dark:text-gray-400'

  const handleSourceChange = (lang: string) => {
    if (lang !== 'auto') recordLangUsage(lang)
    onSourceLangChange(lang)
  }

  return (
    <div className="flex items-center flex-1 min-w-0">
      <div className="flex flex-1 min-w-0 items-center overflow-hidden">
        {/* "Tự động nhận dạng" pill — always first */}
        <button
          type="button"
          onClick={() => onSourceLangChange('auto')}
          className={`${pillBase} flex items-center gap-1.5 ${sourceLang === 'auto' ? pillActive : pillInactive}`}
        >
          {isDetectingLang
            ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
            : <AutoDetectIcon className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />}
          <span>
            {sourceLang === 'auto' && detectedSourceLang
              ? (langNames[detectedSourceLang] ?? detectedSourceLang)
              : t.lang_auto}
          </span>
          {sourceLang === 'auto' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-600 dark:bg-gray-400 rounded-full" />
          )}
        </button>

        {/* Smart top-3 source language pills */}
        {sourceTopLangs.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => handleSourceChange(code)}
            className={`${pillBase} ${sourceLang === code ? pillActive : pillInactive}`}
          >
            {langNames[code] ?? code}
            {sourceLang === code && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-600 dark:bg-gray-400 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ↓ overflow dropdown */}
      <div
        className={`btn-icon relative flex-shrink-0 border-transparent bg-transparent shadow-none
                    ${sourceIsOther ? pillActive : 'text-gray-400 dark:bg-transparent dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
      >
        <ChevronDownIcon className="w-4 h-4" />
        {sourceIsOther && (
          <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-600 dark:bg-gray-400 rounded-full" />
        )}
        <select
          value={sourceIsOther ? sourceLang : ''}
          onChange={(e) => { if (e.target.value) handleSourceChange(e.target.value) }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        >
          <option value="" disabled />
          {TARGET_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {langNames[l.code] ?? l.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
