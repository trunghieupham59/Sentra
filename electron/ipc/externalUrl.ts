const GITHUB_RELEASES_PATH = '/trunghieupham59/viezan/releases'

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
])

export function isAllowedExternalUrl(rawUrl: string): boolean {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return false
  }

  if (url.protocol === 'x-apple.systempreferences:') return true
  if (url.protocol !== 'https:') return false

  const host = url.hostname.toLowerCase()
  if (host === 'github.com') {
    return url.pathname.toLowerCase().startsWith(GITHUB_RELEASES_PATH)
  }

  return ALLOWED_HTTPS_HOSTS.has(host)
}

