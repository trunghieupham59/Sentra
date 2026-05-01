import { isIP } from 'node:net'

const GITHUB_RELEASES_PATH = '/trunghieupham59/viezan/releases'
const MACOS_SCREEN_RECORDING_PREFS =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'

const ALLOWED_SYSTEM_PREFERENCE_URLS = new Set([
  MACOS_SCREEN_RECORDING_PREFS,
])

const BLOCKED_HOST_SUFFIXES = [
  '.example',
  '.home',
  '.internal',
  '.invalid',
  '.lan',
  '.local',
  '.localhost',
  '.test',
  '.example.com',
  '.example.net',
  '.example.org',
]

const BLOCKED_HOSTS = new Set([
  'example.com',
  'example.net',
  'example.org',
  'localhost',
])

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map((part) => Number.parseInt(part, 10))
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true

  const [a, b, c] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  )
}

function isPrivateIpv6(host: string): boolean {
  const embeddedIpv4 = host.match(/(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  if (embeddedIpv4 && isPrivateIpv4(embeddedIpv4)) return true

  const firstHextet = Number.parseInt(host.split(':')[0] || '0', 16)
  return (
    host === '::' ||
    host === '::1' ||
    (firstHextet >= 0xfc00 && firstHextet <= 0xfdff) ||
    (firstHextet >= 0xfe80 && firstHextet <= 0xfebf) ||
    (firstHextet >= 0xff00 && firstHextet <= 0xffff)
  )
}

function isBlockedWebHost(rawHost: string): boolean {
  const host = rawHost.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (!host) return true

  const ipVersion = isIP(host)
  if (ipVersion === 4) return isPrivateIpv4(host)
  if (ipVersion === 6) return isPrivateIpv6(host)

  if (BLOCKED_HOSTS.has(host)) return true
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true

  return !host.includes('.')
}

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
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  if (url.username || url.password) return false

  const host = url.hostname.toLowerCase()
  if (host === 'github.com') {
    const pathname = url.pathname.toLowerCase()
    if (pathname === GITHUB_RELEASES_PATH || pathname.startsWith(`${GITHUB_RELEASES_PATH}/`)) {
      return true
    }
  }

  return !isBlockedWebHost(host)
}
