import { useT } from '../store/useAppStore'
import { AboutSection } from './settings/AboutSection'
import { ApiKeysSection } from './settings/ApiKeysSection'
import { BrowserIntegrationSection } from './settings/BrowserIntegrationSection'
import { ChatPresetsSection } from './settings/ChatPresetsSection'
import { HotkeySection } from './settings/HotkeySection'
import { PreferencesSection } from './settings/PreferencesSection'
import { TtsSection } from './settings/TtsSection'
import { UpdaterSection } from './settings/UpdaterSection'

export function SettingsPage() {
  const t = useT()

  return (
    <div className="h-full overflow-auto bg-gray-50 dark:bg-gray-950">
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-50">{t.settings_title}</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{t.settings_subtitle}</p>
        </div>

        <ApiKeysSection />
        <PreferencesSection />
        <TtsSection />
        <HotkeySection />
        <BrowserIntegrationSection />
        <ChatPresetsSection />
        <UpdaterSection />
        <AboutSection />

      </div>
    </div>
  )
}
