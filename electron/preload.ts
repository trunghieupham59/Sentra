/**
 * Electron Preload — context bridge between main process and renderer.
 *
 * Raw API keys NEVER leave the main process. The renderer only receives
 * typed response objects.
 *
 * Each domain is split into its own module under `./preload/` for maintainability.
 * This file is the single aggregation point — it merges all domain sections into
 * one `window.api` surface so the renderer API contract stays unchanged.
 */
import { contextBridge } from 'electron'
import { keychainSection } from './preload/keychain'
import { translateSection } from './preload/translate'
import { audioSection } from './preload/audio'
import { chatSection } from './preload/chat'
import { subtitleSection } from './preload/subtitle'
import { systemSection } from './preload/system'
import { updaterSection } from './preload/updater'
import { hotkeySection } from './preload/hotkey'
import { legacyAssistantSection } from './preload/legacyAssistant'
import { localServerSection } from './preload/localServer'

contextBridge.exposeInMainWorld('api', {
  ...keychainSection,
  ...translateSection,
  ...audioSection,
  ...chatSection,
  ...subtitleSection,
  ...systemSection,
  ...updaterSection,
  ...hotkeySection,
  ...legacyAssistantSection,
  ...localServerSection,
})
