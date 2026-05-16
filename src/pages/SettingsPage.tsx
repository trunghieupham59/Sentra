import { type ElementType, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  Icon: ElementType<{ className?: string }>
  Component: ElementType
}

const MemoPreferencesSection = memo(PreferencesSection)
const MemoApiKeysSection = memo(ApiKeysSection)
const MemoSttSection = memo(SttSection)
const MemoTtsSection = memo(TtsSection)
const MemoChatPresetsSection = memo(ChatPresetsSection)
const MemoHotkeySection = memo(HotkeySection)
const MemoBrowserIntegrationSection = memo(BrowserIntegrationSection)
const MemoUpdaterSection = memo(UpdaterSection)
const MemoAboutSection = memo(AboutSection)

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
  const activeSectionRef = useRef<SettingsSectionId>('preferences')

  const updateActiveSection = useCallback((id: SettingsSectionId) => {
    if (activeSectionRef.current === id) return
    activeSectionRef.current = id
    setActiveSection(id)
  }, [])

  const sections = useMemo<SettingsSection[]>(() => ([
    {
      id: 'preferences',
      label: t.settings_prefs,
      description: t.settings_translate_mode_desc,
      Icon: GearIcon,
      Component: MemoPreferencesSection,
    },
    {
      id: 'api',
      label: t.settings_api_keys,
      description: t.settings_subtitle,
      Icon: KeyIcon,
      Component: MemoApiKeysSection,
    },
    {
      id: 'stt',
      label: t.settings_stt_section,
      description: t.settings_stt_provider_desc,
      Icon: MicrophoneIcon,
      Component: MemoSttSection,
    },
    {
      id: 'tts',
      label: t.settings_tts_section,
      description: t.settings_tts_priority_desc,
      Icon: SpeakerIcon,
      Component: MemoTtsSection,
    },
    {
      id: 'chat',
      label: t.settings_chat_section,
      description: t.settings_chat_section_desc,
      Icon: ChatBubbleIcon,
      Component: MemoChatPresetsSection,
    },
    {
      id: 'hotkeys',
      label: t.settings_hotkey_section,
      description: t.settings_hotkey_section_desc,
      Icon: UploadIcon,
      Component: MemoHotkeySection,
    },
    {
      id: 'browser',
      label: t.settings_extension_section,
      description: t.settings_extension_section_desc,
      Icon: MonitorIcon,
      Component: MemoBrowserIntegrationSection,
    },
    {
      id: 'updates',
      label: t.settings_update_section,
      description: t.settings_update_section_desc,
      Icon: RefreshIcon,
      Component: MemoUpdaterSection,
    },
    {
      id: 'about',
      label: t.settings_about,
      description: t.settings_about_footer,
      Icon: InfoCircleIcon,
      Component: MemoAboutSection,
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
      if (id) updateActiveSection(id)
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
  }, [sections, updateActiveSection])

  const scrollToSection = (id: SettingsSectionId) => {
    updateActiveSection(id)
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="settings-shell">
      <aside className="hidden md:flex min-h-0 flex-col" style={{ borderRight: '1px solid var(--vzn-border)', background: 'var(--vzn-surface-muted)' }}>
        <nav className="flex-1 overflow-auto p-2.5" aria-label={t.settings_title}>
          <div className="space-y-0.5">
            {sections.map(({ id, label, description, Icon }) => {
              const active = activeSection === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollToSection(id)}
                  title={description}
                  className="btn-nav-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all"
                  style={{
                    background: active ? 'var(--vzn-accent-soft)' : 'transparent',
                    color: active ? 'var(--vzn-accent)' : 'var(--vzn-text-muted)',
                    border: active ? '1px solid var(--vzn-accent-border)' : '1px solid transparent',
                    boxShadow: active ? 'var(--vzn-shadow-glow)' : 'none',
                  }}
                  aria-current={active ? 'true' : undefined}
                  onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'var(--vzn-surface-subtle)'; e.currentTarget.style.color = 'var(--vzn-text)'; } }}
                  onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--vzn-text-muted)'; } }}
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
        <div className="md:hidden" style={{ borderBottom: '1px solid var(--vzn-border)', background: 'var(--vzn-surface-muted)' }}>
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
                    className="btn-sm whitespace-nowrap rounded-lg flex items-center gap-1.5"
                    style={{
                      background: active ? 'var(--vzn-accent-soft)' : 'transparent',
                      color: active ? 'var(--vzn-accent)' : 'var(--vzn-text-muted)',
                      border: active ? '1px solid var(--vzn-accent-border)' : '1px solid transparent',
                    }}
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

        <div ref={scrollRef} className="settings-scroll-viewport flex-1 min-h-0 overflow-auto">
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
