import { FontSizePicker } from '../../components/ui/FontSizePicker'
import { ChevronDownIcon } from '../../components/ui/icons'
import { ToggleSwitch } from '../../components/ui/ToggleSwitch'
import { type AppLocale, LOCALE_NAMES } from '../../i18n'
import { useAppStore, useT } from '../../store/useAppStore'
import { detectSystemLocale } from '../../utils/locale'

/**
 * Apple-style row — label + description on left, control on right
 */
function SettingsRow({
  label,
  description,
  control,
  className = '',
}: {
  label: string
  description?: string
  control: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-center justify-between gap-4 px-4 py-3 min-h-[44px] ${className}`}>
      <div className="min-w-0">
        <p className="text-[15px] leading-[20px]" style={{ color: 'var(--apple-label-primary)' }}>
          {label}
        </p>
        {description && (
          <p className="text-[12px] leading-[16px] mt-0.5" style={{ color: 'var(--apple-label-secondary)' }}>
            {description}
          </p>
        )}
      </div>
      {control}
    </div>
  )
}

export function PreferencesSection() {
  const autoTranslate = useAppStore((state) => state.autoTranslate)
  const setAutoTranslate = useAppStore((state) => state.setAutoTranslate)
  const autoTranslateDelay = useAppStore((state) => state.autoTranslateDelay)
  const setAutoTranslateDelay = useAppStore((state) => state.setAutoTranslateDelay)
  const phoneticMode = useAppStore((state) => state.phoneticMode)
  const setPhoneticMode = useAppStore((state) => state.setPhoneticMode)
  const locale = useAppStore((state) => state.locale)
  const localeAuto = useAppStore((state) => state.localeAuto)
  const setLocale = useAppStore((state) => state.setLocale)
  const setLocaleAuto = useAppStore((state) => state.setLocaleAuto)
  const setLocaleFromSystem = useAppStore((state) => state.setLocaleFromSystem)
  const fontSize = useAppStore((state) => state.fontSize)
  const setFontSize = useAppStore((state) => state.setFontSize)
  const t = useT()

  const handleToggleLocaleAuto = () => {
    if (localeAuto) {
      setLocale(locale)
    } else {
      setLocaleAuto(true)
      setLocaleFromSystem(detectSystemLocale())
    }
  }

  return (
    <section className="space-y-4">
      {/* Section label — Apple caption all-caps style */}
      <h2 className="text-[11px] font-semibold uppercase tracking-wider px-1" style={{ color: 'var(--apple-label-secondary)' }}>
        {t.settings_prefs}
      </h2>

      {/* Apple-style grouped card */}
      <div
        className="rounded-xl overflow-hidden divide-y"
        style={{
          background: 'var(--apple-bg-primary)',
          border: '1px solid var(--apple-separator)',
          '--tw-divide-color': 'var(--apple-separator)',
        } as React.CSSProperties}
      >
        {/* Follow System Language toggle */}
        <SettingsRow
          label={t.settings_locale_auto}
          description={t.settings_locale_auto_desc}
          control={
            <ToggleSwitch
              checked={localeAuto}
              onChange={handleToggleLocaleAuto}
              aria-label={t.settings_locale_auto}
            />
          }
        />

        {/* App Language selector */}
        <SettingsRow
          label={t.settings_app_language}
          description={t.settings_app_language_desc}
          control={
            <div className="relative flex-shrink-0">
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as AppLocale)}
                className={[
                  'h-8 cursor-pointer appearance-none rounded-lg pl-3 pr-7',
                  'text-[13px] font-medium outline-none transition-colors min-w-[130px]',
                  'bg-[var(--apple-fill-tertiary)] hover:bg-[var(--apple-fill-secondary)]',
                  'text-[var(--apple-label-primary)]',
                  'focus:outline-none focus:bg-[var(--apple-fill-secondary)]',
                  'focus:ring-2 focus:ring-[#007AFF]/30',
                ].join(' ')}
              >
                {(Object.entries(LOCALE_NAMES) as [AppLocale, string][]).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--apple-label-tertiary)]" />
            </div>
          }
        />

        {/* Font Size */}
        <SettingsRow
          label={t.settings_font_size}
          description={t.settings_font_size_desc}
          control={
            <FontSizePicker
              value={fontSize}
              onChange={setFontSize}
              labels={{
                small: t.settings_font_size_small,
                medium: t.settings_font_size_medium,
                large: t.settings_font_size_large,
              }}
            />
          }
        />

        {/* Phonetic / Furigana toggle */}
        <SettingsRow
          label={t.settings_furigana}
          description={t.settings_furigana_desc}
          control={
            <ToggleSwitch
              checked={phoneticMode !== 'off'}
              onChange={(v) => setPhoneticMode(v ? 'standard' : 'off')}
              aria-label={t.settings_furigana}
            />
          }
        />

        {/* Auto / Manual translation mode */}
        <SettingsRow
          label={`${t.settings_translate_mode} — ${autoTranslate ? t.settings_mode_auto : t.settings_mode_manual}`}
          description={t.settings_translate_mode_desc}
          control={
            <ToggleSwitch
              checked={autoTranslate}
              onChange={setAutoTranslate}
              aria-label={t.settings_auto_translate}
            />
          }
        />

        {/* Delay slider — only when auto translate is on */}
        {autoTranslate && (
          <SettingsRow
            label={t.settings_translate_delay}
            description={t.settings_translate_delay_desc}
            control={
              <div className="flex items-center gap-3 flex-shrink-0">
                <input
                  type="range"
                  min={300}
                  max={2000}
                  step={100}
                  value={autoTranslateDelay}
                  onChange={(e) => setAutoTranslateDelay(Number(e.target.value))}
                  className="w-24"
                  style={{ accentColor: 'var(--apple-accent)' }}
                />
                <span
                  className="text-[12px] font-mono w-14 text-right tabular-nums"
                  style={{ color: 'var(--apple-label-secondary)' }}
                >
                  {autoTranslateDelay}ms
                </span>
              </div>
            }
          />
        )}
      </div>
    </section>
  )
}
