// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getVersion: () => '2.0.2',
    isPackaged: true,
    getPath: () => '/tmp',
  },
  net: {
    fetch: vi.fn(),
  },
  shell: {
    openExternal: vi.fn(),
    openPath: vi.fn(),
  },
}))

vi.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    logger: null,
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
  },
}))

import {
  buildMacInstallScript,
  buildMacGithubReleaseFromTag,
  isNewerVersion,
  parseLatestGithubTagFromUrl,
} from '../updater'

describe('updater helpers', () => {
  it('compares newer release versions', () => {
    expect(isNewerVersion('2.0.3', '2.0.2')).toBe(true)
    expect(isNewerVersion('v2.0.2', '2.0.2')).toBe(false)
    expect(isNewerVersion('2.0.1', '2.0.2')).toBe(false)
  })

  it('parses the tag from the public GitHub latest redirect URL', () => {
    expect(parseLatestGithubTagFromUrl('https://github.com/trunghieupham59/viezan/releases/tag/v2.0.3')).toBe('v2.0.3')
    expect(parseLatestGithubTagFromUrl('https://github.com/trunghieupham59/other/releases/tag/v2.0.3')).toBeNull()
    expect(parseLatestGithubTagFromUrl('not a url')).toBeNull()
  })

  it('builds deterministic macOS DMG release metadata from a tag', () => {
    expect(buildMacGithubReleaseFromTag('v2.0.3', 'arm64')).toEqual({
      version: '2.0.3',
      downloadUrl: 'https://github.com/trunghieupham59/viezan/releases/download/v2.0.3/Viezan-2.0.3-arm64.dmg',
      assetName: 'Viezan-2.0.3-arm64.dmg',
    })
    expect(buildMacGithubReleaseFromTag('invalid', 'arm64')).toBeNull()
  })

  it('builds a macOS installer helper that replaces the app after the current process exits', () => {
    const script = buildMacInstallScript()

    expect(script).toContain('hdiutil attach "$DMG_PATH"')
    expect(script).toContain('kill -0 "$APP_PID"')
    expect(script).toContain('ditto "$SOURCE_PATH" "$DEST_PATH"')
    expect(script).toContain('open "$DEST_PATH"')
  })
})
