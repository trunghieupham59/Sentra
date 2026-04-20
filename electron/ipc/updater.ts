import { app, net, shell } from 'electron'
import type { IpcMain, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

// ─── GitHub repo for update checks (macOS fallback) ────────────────────────
// On macOS we build with identity: null (unsigned). Squirrel.Mac — which
// electron-updater uses on macOS — requires a valid code signature and will
// always error on unsigned bundles.  Instead of going through Squirrel, we
// call the GitHub Releases API directly: check the latest tag, compare with
// the running version, and open the browser for the user to download & install.
const GITHUB_OWNER = 'trunghieupham59'
const GITHUB_REPO  = 'Viezan'

// ─── Error-detection patterns ──────────────────────────────────────────────
// Patterns that indicate the update YAML / metadata file is simply absent on
// the server (e.g. first release, 404 on GitHub, local ENOENT).  We treat
// this as "no update" rather than a hard error.
const YAML_NOT_FOUND_PATTERNS = [
  '404',
  'not found',
  'enoent',
  'cannot find',
  'httperror',
] as const

// Patterns that indicate a macOS code-signature validation failure.
// Kept as a safety-net for non-macOS builds or if the fallback is disabled.
const CODE_SIGNATURE_PATTERNS = [
  'code signature',
  'did not pass validation',
  'code object is not signed',
  'a sealed resource is missing',
  'shipit',
  'codesign',
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────
function errMsg(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).toLowerCase()
}

function matchesPatterns(err: unknown, patterns: readonly string[]): boolean {
  const msg = errMsg(err)
  return patterns.some((p) => msg.includes(p))
}

/**
 * Simple semver comparison.
 * Returns true if `remote` is strictly newer than `current`.
 */
function isNewerVersion(remote: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number)
  const [rMaj = 0, rMin = 0, rPat = 0] = parse(remote)
  const [cMaj = 0, cMin = 0, cPat = 0] = parse(current)
  if (rMaj !== cMaj) return rMaj > cMaj
  if (rMin !== cMin) return rMin > cMin
  return rPat > cPat
}

interface GithubRelease {
  version: string
  /** Direct link to the best asset (DMG on macOS) or the release page. */
  downloadUrl: string
}

/**
 * Fetch the latest release from GitHub Releases API.
 * Picks the most appropriate asset for the running platform/arch.
 */
async function fetchLatestGithubRelease(): Promise<GithubRelease | null> {
  const apiUrl     = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`
  const releasePage = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`

  const response = await net.fetch(apiUrl, {
    headers: {
      'User-Agent': `Viezan/${app.getVersion()}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (!response.ok) return null

  const data = await response.json() as {
    tag_name: string
    html_url: string
    assets: Array<{ name: string; browser_download_url: string }>
  }

  const version = data.tag_name.replace(/^v/, '')

  // Pick the best download asset for the current platform + arch
  let downloadUrl = data.html_url ?? releasePage

  if (process.platform === 'darwin') {
    const arch = process.arch // 'arm64' | 'x64'
    // Prefer arch-specific DMG, then any DMG, then the release page
    const dmg =
      data.assets.find(a => a.name.endsWith('.dmg') && a.name.includes(arch)) ??
      data.assets.find(a => a.name.endsWith('.dmg'))
    if (dmg) downloadUrl = dmg.browser_download_url
  } else if (process.platform === 'win32') {
    const exe = data.assets.find(a => a.name.endsWith('.exe'))
    if (exe) downloadUrl = exe.browser_download_url
  } else {
    const appImg = data.assets.find(a => a.name.endsWith('.AppImage'))
    if (appImg) downloadUrl = appImg.browser_download_url
  }

  return { version, downloadUrl }
}

// ─── Types ─────────────────────────────────────────────────────────────────
export type UpdaterStatus =
  | { type: 'idle' }
  | { type: 'checking' }
  | { type: 'available';     version: string; downloadUrl?: string }
  | { type: 'not-available'; version: string }
  | { type: 'downloading';   percent: number; bytesPerSecond: number; transferred: number; total: number }
  | { type: 'downloaded';    version: string }
  | { type: 'error-codesign' }
  | { type: 'error';         error: string }

// ─── Registration ──────────────────────────────────────────────────────────
export function registerUpdaterHandlers(
  ipc: IpcMain,
  getMainWindow: () => BrowserWindow | null,
) {
  const isDev = !app.isPackaged

  // On macOS, Squirrel.Mac requires code signing.  Since we ship without a
  // Developer ID certificate (identity: null in package.json), we bypass
  // Squirrel entirely and use the GitHub Releases API directly.
  const useMacFallback = process.platform === 'darwin'

  autoUpdater.autoDownload         = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger               = null

  const push = (payload: UpdaterStatus) => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('updater:status', payload)
    }
  }

  // ── electron-updater events (Windows / Linux only) ──────────────────────
  autoUpdater.on('checking-for-update', () => push({ type: 'checking' }))

  autoUpdater.on('update-available', (info) =>
    push({ type: 'available', version: info.version })
  )

  autoUpdater.on('update-not-available', (info) =>
    push({ type: 'not-available', version: info.version })
  )

  autoUpdater.on('download-progress', (progress) =>
    push({
      type: 'downloading',
      percent: Math.round(progress.percent),
      bytesPerSecond: Math.round(progress.bytesPerSecond),
      transferred: progress.transferred,
      total: progress.total,
    })
  )

  autoUpdater.on('update-downloaded', (info) =>
    push({ type: 'downloaded', version: info.version })
  )

  autoUpdater.on('error', (err) => {
    if (matchesPatterns(err, YAML_NOT_FOUND_PATTERNS)) {
      // Metadata file not found → treat as "up to date"
      push({ type: 'not-available', version: app.getVersion() })
    } else if (matchesPatterns(err, CODE_SIGNATURE_PATTERNS)) {
      // Safety net — should not reach here on macOS because we use the
      // GitHub API fallback above, but kept for non-macOS edge cases.
      push({ type: 'error-codesign' })
    } else {
      push({ type: 'error', error: err?.message ?? String(err) })
    }
  })

  // ── IPC handlers ────────────────────────────────────────────────────────

  ipc.handle('updater:check', async () => {
    if (isDev) {
      setTimeout(() => push({ type: 'not-available', version: app.getVersion() }), 800)
      return { success: true }
    }

    // ── macOS: GitHub Releases API (bypasses Squirrel code-signing check) ──
    if (useMacFallback) {
      push({ type: 'checking' })
      try {
        const release = await fetchLatestGithubRelease()
        if (!release) {
          push({ type: 'not-available', version: app.getVersion() })
          return { success: true }
        }
        if (isNewerVersion(release.version, app.getVersion())) {
          push({ type: 'available', version: release.version, downloadUrl: release.downloadUrl })
        } else {
          push({ type: 'not-available', version: app.getVersion() })
        }
        return { success: true }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        push({ type: 'error', error: msg })
        return { success: false, error: msg }
      }
    }

    // ── Windows / Linux: electron-updater (Squirrel / NSIS) ────────────────
    try {
      await autoUpdater.checkForUpdates()
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  ipc.handle('updater:download', async () => {
    if (isDev)          return { success: false, error: 'Not available in development mode' }
    if (useMacFallback) return { success: false, error: 'Use updater:openDownload on macOS' }
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      push({ type: 'error', error: msg })
      return { success: false, error: msg }
    }
  })

  ipc.handle('updater:install', () => {
    if (isDev)          return { success: false, error: 'Not available in development mode' }
    if (useMacFallback) return { success: false, error: 'Use updater:openDownload on macOS' }
    autoUpdater.quitAndInstall(false, true)
    return { success: true }
  })

  ipc.handle('updater:getVersion', () => {
    return { version: app.getVersion() }
  })

  /**
   * Open the download URL in the default system browser.
   * Used on macOS where we can't silently install without code signing.
   * Optionally accepts a specific URL; falls back to the GitHub releases page.
   */
  ipc.handle('updater:openDownload', (_event, url?: string) => {
    const target = url ?? `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`
    shell.openExternal(target)
    return { success: true }
  })
}
