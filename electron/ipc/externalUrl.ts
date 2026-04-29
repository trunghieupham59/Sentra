const GITHUB_RELEASES_PATH = '/trunghieupham59/viezan/releases'
const MACOS_SCREEN_RECORDING_PREFS =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'

const ALLOWED_SYSTEM_PREFERENCE_URLS = new Set([
  MACOS_SCREEN_RECORDING_PREFS,
])

const ALLOWED_HTTPS_HOSTS = new Set([
  'platform.openai.com',
  'console.anthropic.com',
  'aistudio.google.com',
  'jina.ai',
  'www.jina.ai',
  'elevenlabs.io',
  'www.elevenlabs.io',
  'console.groq.com',
  'app.tavily.com',
  'api.search.brave.com',
  'ollama.com',
  'www.ollama.com',
])

export function isAllowedExternalUrl(rawUrl: string): boolean {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return false
  }

  if (url.protocol === 'x-apple.systempreferences:') {
    return ALLOWED_SYSTEM_PREFERENCE_URLS.has(rawUrl.trim())
  }
  if (url.protocol !== 'https:') return false

  const host = url.hostname.toLowerCase()
  if (host === 'github.com') {
    const pathname = url.pathname.toLowerCase()
    return pathname === GITHUB_RELEASES_PATH || pathname.startsWith(`${GITHUB_RELEASES_PATH}/`)
  }

  return ALLOWED_HTTPS_HOSTS.has(host)
}
