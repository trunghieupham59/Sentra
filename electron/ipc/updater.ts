import { createWriteStream } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { get } from 'node:https'
import path from 'node:path'
import type { BrowserWindow, IpcMain } from 'electron'
import { app, net, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { isAllowedExternalUrl } from './externalUrl'

// ─── GitHub repo for update checks (macOS fallback) ────────────────────────
// On macOS we build with identity: null (unsigned). Squirrel.Mac — which
// electron-updater uses on macOS — requires a valid code signature and will
// always error on unsigned bundles.  Instead of going through Squirrel, we
// call the GitHub Releases API directly: check the latest tag, compare with
// the running version, then download the DMG directly and open it for the user.
const GITHUB_OWNER = 'trunghieupham59'
const GITHUB_REPO  = 'Viezan'
const MAX_DOWNLOAD_REDIRECTS = 5

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
  /** Release asset filename when a platform installer was found. */
  assetName?: string
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
    return { version, downloadUrl, assetName: dmg?.name }
  } else if (process.platform === 'win32') {
    const exe = data.assets.find(a => a.name.endsWith('.exe'))
    if (exe) downloadUrl = exe.browser_download_url
  } else {
    const appImg = data.assets.find(a => a.name.endsWith('.AppImage'))
    if (appImg) downloadUrl = appImg.browser_download_url
  }

  return { version, downloadUrl }
}

function sanitizeDownloadName(name: string, version: string): string {
  const fallback = `Viezan-${version}-${process.arch}.dmg`
  const clean = name.trim().replace(/[/\\?%*:|"<>]/g, '-')
  return clean.endsWith('.dmg') ? clean : fallback
}

function isTrustedGithubAssetUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    const pathname = url.pathname.toLowerCase()
    return (
      url.protocol === 'https:' &&
      url.hostname.toLowerCase() === 'github.com' &&
      pathname.startsWith(`/${GITHUB_OWNER.toLowerCase()}/${GITHUB_REPO.toLowerCase()}/releases/download/`) &&
      pathname.endsWith('.dmg')
    )
  } catch {
    return false
  }
}

async function downloadFile(
  url: string,
  destination: string,
  onProgress: (progress: {
    percent: number
    bytesPerSecond: number
    transferred: number
    total: number
  }) => void,
  redirectsLeft = MAX_DOWNLOAD_REDIRECTS,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const startedAt = Date.now()
    const request = get(url, {
      headers: {
        'User-Agent': `Viezan/${app.getVersion()}`,
        Accept: 'application/octet-stream',
      },
    }, (response) => {
      const status = response.statusCode ?? 0
      const location = response.headers.location

      if (status >= 300 && status < 400 && location) {
        response.resume()
        if (redirectsLeft <= 0) {
          reject(new Error('Too many redirects while downloading update'))
          return
        }
        const redirectedUrl = new URL(location, url).toString()
        downloadFile(redirectedUrl, destination, onProgress, redirectsLeft - 1).then(resolve, reject)
        return
      }

      if (status < 200 || status >= 300) {
        response.resume()
        reject(new Error(`Download failed with HTTP ${status}`))
        return
      }

      const total = Number.parseInt(String(response.headers['content-length'] ?? '0'), 10) || 0
      let transferred = 0
      const file = createWriteStream(destination)

      response.on('data', (chunk: Buffer) => {
        transferred += chunk.length
        const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.001)
        onProgress({
          percent: total ? Math.min(100, Math.round((transferred / total) * 100)) : 0,
          bytesPerSecond: Math.round(transferred / elapsedSeconds),
          transferred,
          total,
        })
      })

      response.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
      file.on('error', reject)
    })

    request.on('error', reject)
  })
}

// ─── Types ─────────────────────────────────────────────────────────────────
export type UpdaterStatus =
  | { type: 'idle' }
  | { type: 'checking' }
  | { type: 'available';     version: string; downloadUrl?: string }
  | { type: 'not-available'; version: string }
  | { type: 'downloading';   percent: number; bytesPerSecond: number; transferred: number; total: number }
  | { type: 'downloaded';    version: string; installMode?: 'restart' | 'open-installer' }
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
  let latestMacRelease: GithubRelease | null = null
  let downloadedMacInstallerPath: string | null = null

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
          latestMacRelease = release
          push({ type: 'available', version: release.version, downloadUrl: release.downloadUrl })
        } else {
          latestMacRelease = null
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
    if (useMacFallback) {
      try {
        const release = latestMacRelease ?? await fetchLatestGithubRelease()
        if (!release || !isNewerVersion(release.version, app.getVersion())) {
          push({ type: 'not-available', version: app.getVersion() })
          return { success: false, error: 'No update available' }
        }
        if (!release.assetName || !isTrustedGithubAssetUrl(release.downloadUrl)) {
          return { success: false, error: 'No trusted macOS DMG asset found' }
        }

        const filename = sanitizeDownloadName(release.assetName, release.version)
        const downloadsDir = app.getPath('downloads')
        await mkdir(downloadsDir, { recursive: true })
        const destination = path.join(downloadsDir, filename)

        push({ type: 'downloading', percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 })
        try {
          await downloadFile(release.downloadUrl, destination, (progress) => push({ type: 'downloading', ...progress }))
        } catch (err) {
          await rm(destination, { force: true }).catch(() => undefined)
          throw err
        }

        downloadedMacInstallerPath = destination
        push({ type: 'downloaded', version: release.version, installMode: 'open-installer' })

        const openError = await shell.openPath(destination)
        if (openError) {
          push({ type: 'error', error: openError })
          return { success: false, error: openError }
        }
        return { success: true, filePath: destination }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        push({ type: 'error', error: msg })
        return { success: false, error: msg }
      }
    }
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
    if (useMacFallback) {
      if (!downloadedMacInstallerPath) return { success: false, error: 'No downloaded installer found' }
      shell.openPath(downloadedMacInstallerPath).then((openError) => {
        if (openError) push({ type: 'error', error: openError })
      })
      return { success: true }
    }
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
    if (!isAllowedExternalUrl(target)) {
      return { success: false, error: 'Blocked external URL' }
    }
    shell.openExternal(target)
    return { success: true }
  })
}
