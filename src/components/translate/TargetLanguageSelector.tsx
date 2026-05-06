import { TARGET_LANGUAGES } from '../../constants/providers'
import { useAppStore } from '../../store/useAppStore'
import { ChevronDownIcon } from '../ui/icons'
import { getSmartTopLangs } from './langSelectorUtils'

interface TargetLanguageSelectorProps {
  targetLang: string
  onTargetLangChange: (lang: string) => void
  langNames: Record<string, string>
}

export function TargetLanguageSelector({
  targetLang,
  onTargetLangChange,
  langNames,
}: TargetLanguageSelectorProps) {
  const { langUsage, recordLangUsage } = useAppStore()

  const targetTopLangs = getSmartTopLangs(langUsage, targetLang)
  const targetIsOther = !targetTopLangs.includes(targetLang)

  const pillBase =
    'btn-language-tab relative flex-shrink-0 whitespace-nowrap'
  const pillActive = 'text-gray-700 dark:text-gray-200'
  const pillInactive = 'text-gray-500 dark:text-gray-400'

  const handleTargetChange = (lang: string) => {
    recordLangUsage(lang)
    onTargetLangChange(lang)
  }

  return (
    <div className="flex items-center flex-1 min-w-0">

      {/* Smart top-3 target language pills */}
      {targetTopLangs.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => handleTargetChange(code)}
          className={`${pillBase} ${targetLang === code ? pillActive : pillInactive}`}
        >
          {langNames[code] ?? code}
          {targetLang === code && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-600 dark:bg-gray-400 rounded-full" />
          )}
        </button>
      ))}

      {/* ↓ overflow dropdown */}
      <div
        className={`relative flex items-center justify-center w-8 py-2 transition-colors duration-150 cursor-pointer select-none flex-shrink-0
                    ${targetIsOther ? pillActive : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
      >
        <ChevronDownIcon className="w-4 h-4" />
        {targetIsOther && (
          <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-600 dark:bg-gray-400 rounded-full" />
        )}
        <select
          value={targetLang}
          onChange={(e) => handleTargetChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        >
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
