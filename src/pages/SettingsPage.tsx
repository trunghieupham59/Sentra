import { type ComponentType, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChatBubbleIcon,
  GearIcon,
  InfoCircleIcon,
  KeyIcon,
  MicrophoneIcon,
  MonitorIcon,
  RefreshIcon,
  SpeakerIcon,
  UploadIcon,
} from '../components/ui/icons'
import { useT } from '../store/useAppStore'
import { AboutSection } from './settings/AboutSection'
import { ApiKeysSection } from './settings/ApiKeysSection'
import { BrowserIntegrationSection } from './settings/BrowserIntegrationSection'
import { ChatPresetsSection } from './settings/ChatPresetsSection'
import { HotkeySection } from './settings/HotkeySection'
import { PreferencesSection } from './settings/PreferencesSection'
import { SttSection } from './settings/SttSection'
import { TtsSection } from './settings/TtsSection'
import { UpdaterSection } from './settings/UpdaterSection'

type SettingsSectionId =
  | 'preferences'
  | 'api'
  | 'stt'
  | 'tts'
  | 'chat'
  | 'hotkeys'
  | 'browser'
  | 'updates'
  | 'about'

interface SettingsSection {
  id: SettingsSectionId
  label: string
  description: string
  Icon: ComponentType<{ className?: string }>
  Component: ComponentType
}

export function SettingsPage() {
  const t = useT()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const sectionRefs = useRef<Record<SettingsSectionId, HTMLDivElement | null>>({
    api: null,
    preferences: null,
    stt: null,
    tts: null,
    hotkeys: null,
    browser: null,
    chat: null,
    updates: null,
    about: null,
  })
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('preferences')

  const sections = useMemo<SettingsSection[]>(() => ([
    {
      id: 'preferences',
      label: t.settings_prefs,
      description: t.settings_translate_mode_desc,
      Icon: GearIcon,
      Component: PreferencesSection,
    },
    {
      id: 'api',
      label: t.settings_api_keys,
      description: t.settings_subtitle,
      Icon: KeyIcon,
      Component: ApiKeysSection,
    },
    {
      id: 'stt',
      label: t.settings_stt_section,
      description: t.settings_stt_provider_desc,
      Icon: MicrophoneIcon,
      Component: SttSection,
    },
    {
      id: 'tts',
      label: t.settings_tts_section,
      description: t.settings_tts_priority_desc,
      Icon: SpeakerIcon,
      Component: TtsSection,
    },
    {
      id: 'chat',
      label: t.settings_chat_section,
      description: t.settings_chat_section_desc,
      Icon: ChatBubbleIcon,
      Component: ChatPresetsSection,
    },
    {
      id: 'hotkeys',
      label: t.settings_hotkey_section,
      description: t.settings_hotkey_section_desc,
      Icon: UploadIcon,
      Component: HotkeySection,
    },
    {
      id: 'browser',
      label: t.settings_extension_section,
      description: t.settings_extension_section_desc,
      Icon: MonitorIcon,
      Component: BrowserIntegrationSection,
    },
    {
      id: 'updates',
      label: t.settings_update_section,
      description: t.settings_update_section_desc,
      Icon: RefreshIcon,
      Component: UpdaterSection,
    },
    {
      id: 'about',
      label: t.settings_about,
      description: t.settings_about_footer,
      Icon: InfoCircleIcon,
      Component: AboutSection,
    },
  ]), [t])

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]

      const id = visible?.target.getAttribute('data-settings-section') as SettingsSectionId | null
      if (id) setActiveSection(id)
    }, {
      root,
      rootMargin: '-18% 0px -62% 0px',
      threshold: [0.1, 0.3, 0.6],
    })

    sections.forEach((section) => {
      const node = sectionRefs.current[section.id]
      if (node) observer.observe(node)
    })

    return () => observer.disconnect()
  }, [sections])

  const scrollToSection = (id: SettingsSectionId) => {
    setActiveSection(id)
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="settings-shell">
      <aside className="hidden md:flex min-h-0 flex-col border-r border-gray-200/80 bg-white/65 dark:border-white/10 dark:bg-neutral-950/50">
        <nav className="flex-1 overflow-auto p-2" aria-label={t.settings_title}>
          <div className="space-y-1">
            {sections.map(({ id, label, description, Icon }) => {
              const active = activeSection === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollToSection(id)}
                  title={description}
                  className={[
                    'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                    active
                      ? 'bg-blue-50 text-blue-700 shadow-sm shadow-blue-900/5 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-100',
                  ].join(' ')}
                  aria-current={active ? 'true' : undefined}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="min-w-0 truncate">{label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      </aside>

      <div className="flex min-h-0 flex-col">
        <div className="md:hidden border-b border-gray-200 bg-white/90 dark:border-white/10 dark:bg-neutral-950/90">
          <nav className="overflow-x-auto px-3 py-2" aria-label={t.settings_title}>
            <div className="flex gap-1">
              {sections.map(({ id, label, description, Icon }) => {
                const active = activeSection === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => scrollToSection(id)}
                    title={description}
                    className={[
                      'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                      active
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                        : 'text-gray-500 hover:bg-white dark:text-gray-400 dark:hover:bg-white/5',
                    ].join(' ')}
                    aria-current={active ? 'true' : undefined}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {label}
                  </button>
                )
              })}
            </div>
          </nav>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-auto">
          <div className="max-w-3xl mx-auto px-4 py-5 md:px-6 md:py-6 space-y-8">
            {sections.map(({ id, Component }) => (
              <div
                key={id}
                ref={(node) => { sectionRefs.current[id] = node }}
                data-settings-section={id}
                className="scroll-mt-6"
              >
                <Component />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
