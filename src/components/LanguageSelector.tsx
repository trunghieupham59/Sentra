import { LANGUAGES, TARGET_LANGUAGES } from '../constants/providers'
import { useT } from '../store/useAppStore'

interface LanguageSelectorProps {
  value: string
  onChange: (lang: string) => void
  includeAuto?: boolean
  label?: string
  disabled?: boolean
}

export function LanguageSelector({
  value,
  onChange,
  includeAuto = false,
  label,
  disabled = false,
}: LanguageSelectorProps) {
  const t = useT()
  const options = includeAuto ? LANGUAGES : TARGET_LANGUAGES

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</label>}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="select-field pr-8 text-sm"
        >
          {options.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {t.lang_names[lang.code] ?? lang.name}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  )
}
