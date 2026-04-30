/**
 * Local HTTP Server — lets the Viezan Chrome Extension communicate with the
 * native Viezan app running on the same machine.
 *
 * Security model:
 *   • Server only listens on 127.0.0.1 (loopback — not reachable from outside)
 *   • Every request must carry the header  X-Viezan-Token: <api-key>
 *   • API keys use the sk-vie-<64 lowercase hex chars> format, named, with configurable TTL
 *   • API key values are returned ONLY at creation or regeneration — never again
 *   • Multiple API keys can coexist (one per device/browser)
 *
 * Endpoints:
 *   GET  /api/status                                 → { success, version }
 *   POST /api/translate  { text, targetLang, sourceLang?, provider?, model? }
 *                        → { success, translatedText } | { success:false, error }
 *   POST /api/tts        { text, lang?, mode? }
 *                        → { success, audioBase64?, mimeType?, provider? } | { success:false, error }
 */
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as http from 'node:http'
import * as path from 'node:path'
import { app } from 'electron'
import { EXT_DEFAULT_GEMINI_MODEL } from './ipcConstants'
import { invalidIpcInput, isNonEmptyString, isRecord } from './ipcValidation'
import { lightweightTranslate } from './lightweightTranslate'
import { isValidProvider } from './providers/types'
import { hasStoredApiKey } from './storage'
import { synthesizeTts, type TtsMode, type TtsParams } from './tts'

// ── Config ────────────────────────────────────────────────────────────────────

export const LOCAL_SERVER_PORT = 39875
/** Multi-API-key file (replaces legacy single-secret file) */
const TOKENS_FILE = 'local-server-tokens.json'
/** Legacy single-secret file — migrated only when it already contains a valid sk-vie API key */
const LEGACY_TOKEN_FILE = 'local-server-token.json'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TokenEntry {
  id: string         // 8-byte random hex
  name: string       // user-given label
  token: string      // sk-vie-<64 lowercase hex chars> — stored but NEVER returned in list
  createdAt: number  // Unix ms
  expiresAt: number  // Unix ms
}

/** What the list endpoint returns — no API key value */
export type TokenInfo = Omit<TokenEntry, 'token'>

// ── State ─────────────────────────────────────────────────────────────────────

let activeTokens: TokenEntry[] = []
let server: http.Server | null = null

/**
 * Active provider/model synced from the renderer (Zustand store).
 * Updated via IPC `localServer:syncConfig` whenever the user changes provider/model.
 * Used by /api/config so the extension always mirrors the app's current selection.
 */
const cachedConfig: {
  provider: string
  model: string
  ttsMode: TtsMode
  ttsVoice: NonNullable<TtsParams['voice']>
} = {
  provider: 'gemini',
  model: EXT_DEFAULT_GEMINI_MODEL,
  ttsMode: 'free',
  ttsVoice: 'nova',
}

const API_KEY_PATTERN = /^sk-vie-[a-f0-9]{64}$/

// ── Persistence ───────────────────────────────────────────────────────────────

function getTokensPath (): string {
  return path.join(app.getPath('userData'), TOKENS_FILE)
}

function getLegacyTokenPath (): string {
  return path.join(app.getPath('userData'), LEGACY_TOKEN_FILE)
}

function saveTokens (tokens: TokenEntry[]): void {
  try { fs.writeFileSync(getTokensPath(), JSON.stringify(tokens), 'utf-8') } catch { /* ignore */ }
}

function loadTokens (): TokenEntry[] {
  // 1. Try current multi-API-key file
  try {
    const p = getTokensPath()
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'))
      if (Array.isArray(data)) {
        const now = Date.now()
        const validTokens = data.filter((t: TokenEntry) =>
          typeof t.id === 'string' &&
          typeof t.name === 'string' &&
          isValidApiKeyValue(t.token) &&
          typeof t.expiresAt === 'number' && t.expiresAt > now
        )
        if (validTokens.length !== data.length) saveTokens(validTokens)
        return validTokens
      }
    }
  } catch { /* fall through */ }

  // 2. Migrate from legacy single-secret file only when it already uses the new format
  try {
    const lp = getLegacyTokenPath()
    if (fs.existsSync(lp)) {
      const data = JSON.parse(fs.readFileSync(lp, 'utf-8'))
      if (isValidApiKeyValue(data.token)) {
        const now = Date.now()
        const expiresAt = typeof data.expiresAt === 'number' && data.expiresAt > now
          ? data.expiresAt
          : now + 30 * 24 * 60 * 60 * 1000
        if (expiresAt > now) {
          const migrated: TokenEntry = {
            id: crypto.randomBytes(8).toString('hex'),
            name: 'Default',
            token: data.token,
            createdAt: now,
            expiresAt,
          }
          saveTokens([migrated])
          return [migrated]
        }
      }
    }
  } catch { /* ignore */ }

  return []
}

function purgeExpired (): void {
  const now = Date.now()
  const before = activeTokens.length
  activeTokens = activeTokens.filter(t => t.expiresAt > now && isValidApiKeyValue(t.token))
  if (activeTokens.length !== before) saveTokens(activeTokens)
}

// ── API key helpers ───────────────────────────────────────────────────────────

function makeTokenId (): string {
  return crypto.randomBytes(8).toString('hex')
}
function makeTokenValue (): string {
  return `sk-vie-${crypto.randomBytes(32).toString('hex')}`
}
function ttlMs (days: number): number {
  return Math.max(1, Math.min(days, 365)) * 24 * 60 * 60 * 1000
}

function isTtsMode(value: unknown): value is TtsMode {
  return value === 'free' || value === 'auto' || value === 'premium'
}

function isTtsVoice(value: unknown): value is NonNullable<TtsParams['voice']> {
  return (
    value === 'alloy' ||
    value === 'echo' ||
    value === 'fable' ||
    value === 'onyx' ||
    value === 'nova' ||
    value === 'shimmer'
  )
}

function isTokenId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{16}$/i.test(value)
}

function normalizeTokenName(value: unknown): string {
  if (typeof value !== 'string') return 'Extension API Key'
  return value.trim().slice(0, 80) || 'Extension API Key'
}

function normalizeTtlDays(value: unknown, fallback = 30): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function tokenMatches(storedToken: string, incomingToken: unknown): boolean {
  if (typeof incomingToken !== 'string') return false
  if (!isValidApiKeyValue(storedToken) || !isValidApiKeyValue(incomingToken)) return false
  const stored = Buffer.from(storedToken)
  const incoming = Buffer.from(incomingToken)
  return stored.length === incoming.length && crypto.timingSafeEqual(stored, incoming)
}

function isValidApiKeyValue(value: unknown): value is string {
  return typeof value === 'string' && API_KEY_PATTERN.test(value)
}

// ── HTTP server helpers ───────────────────────────────────────────────────────

const MAX_LISTEN_RETRIES = 5
const LISTEN_RETRY_DELAY_MS = 500

// ── HTTP server ───────────────────────────────────────────────────────────────

function sendJSON (res: http.ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Viezan-Token',
    // Required for Chrome Private Network Access (PNA) — allows extension pages
    // (chrome-extension://) and local web pages to fetch from 127.0.0.1.
    'Access-Control-Allow-Private-Network': 'true',
  })
  res.end(JSON.stringify(data))
}

function readBody (req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

export async function handleLocalServerRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') { sendJSON(res, 200, {}); return }

  // Validate API key against all active, non-expired API keys
  const incomingToken = req.headers['x-viezan-token']
  const now = Date.now()
  purgeExpired()
  const valid = activeTokens.some(t => tokenMatches(t.token, incomingToken) && t.expiresAt > now)
  if (!valid) {
    sendJSON(res, 401, { success: false, error: 'Unauthorized — API key expired or invalid' })
    return
  }

  const url = req.url ?? ''

  if (req.method === 'GET' && url === '/api/status') {
    sendJSON(res, 200, { success: true, version: app.getVersion(), appName: app.getName() })
    return
  }

  // Returns the app's currently active provider/model so the extension
  // mirrors the user's selection without needing its own provider settings.
  if (req.method === 'GET' && url === '/api/config') {
    sendJSON(res, 200, {
      success: true,
      provider: cachedConfig.provider,
      model: cachedConfig.model,
      availableProviders: {
        gemini: hasStoredApiKey('gemini'),
        openai: hasStoredApiKey('openai'),
        claude: hasStoredApiKey('claude'),
      },
    })
    return
  }

  if (req.method === 'POST' && url === '/api/translate') {
    try {
      const result = await lightweightTranslate(JSON.parse(await readBody(req)))
      sendJSON(res, 200, result)
    } catch (e) {
      sendJSON(res, 400, { success: false, error: String(e) })
    }
    return
  }

  if (req.method === 'POST' && url === '/api/tts') {
    try {
      const body = JSON.parse(await readBody(req))
      const text = typeof body?.text === 'string' ? body.text.trim() : ''
      if (!text) {
        sendJSON(res, 400, { success: false, error: 'Missing text' })
        return
      }
      const result = await synthesizeTts({
        text,
        lang: typeof body?.lang === 'string' ? body.lang : undefined,
        mode: cachedConfig.ttsMode,
        voice: cachedConfig.ttsVoice,
      })
      sendJSON(res, result.success ? 200 : 400, result)
    } catch (e) {
      sendJSON(res, 400, { success: false, error: String(e) })
    }
    return
  }

  sendJSON(res, 404, { success: false, error: 'Not found' })
}

export function createHttpServer (): http.Server {
  return http.createServer(handleLocalServerRequest)
}

/**
 * Attempt to bind the server to LOCAL_SERVER_PORT.
 * On EADDRINUSE (port held by a previous instance that hasn't fully released
 * yet), close the failed socket and retry up to MAX_LISTEN_RETRIES times with
 * a short exponential back-off.  This covers the common crash / hot-reload
 * scenario where the OS reclaims the port within a second or two.
 */
function listenWithRetry (attempt = 0): void {
  // Tear down whatever failed server we had
  if (server) {
    server.removeAllListeners()
    server.close()
  }

  server = createHttpServer()

  server.listen(LOCAL_SERVER_PORT, '127.0.0.1', () => {
    console.log(`[LocalServer] Listening on http://127.0.0.1:${LOCAL_SERVER_PORT}`)
  })

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && attempt < MAX_LISTEN_RETRIES) {
      const delay = LISTEN_RETRY_DELAY_MS * (attempt + 1)
      console.warn(
        `[LocalServer] Port ${LOCAL_SERVER_PORT} in use — retry ${attempt + 1}/${MAX_LISTEN_RETRIES} in ${delay} ms`
      )
      setTimeout(() => listenWithRetry(attempt + 1), delay)
    } else {
      console.error('[LocalServer] Error:', err)
    }
  })
}

export function startLocalServer (ipcMain: Electron.IpcMain): void {
  activeTokens = loadTokens()

  listenWithRetry()

  // ── IPC handlers ─────────────────────────────────────────────────────────

  /**
   * Called by the renderer whenever selectedProvider or selectedModels changes.
   * Keeps cachedConfig in sync so /api/config reflects the app's current state.
   */
  ipcMain.handle('localServer:syncConfig', (_event, rawParams: unknown) => {
    if (!isRecord(rawParams)) {
      return invalidIpcInput('Local server config payload must be an object')
    }

    const { provider, model, ttsMode, ttsVoice } = rawParams
    if (!isNonEmptyString(provider) || !isValidProvider(provider.trim())) {
      return invalidIpcInput('Invalid provider')
    }
    if (!isNonEmptyString(model)) {
      return invalidIpcInput('Invalid model')
    }
    if (ttsMode !== undefined && !isTtsMode(ttsMode)) {
      return invalidIpcInput('Invalid TTS mode')
    }
    if (ttsVoice !== undefined && !isTtsVoice(ttsVoice)) {
      return invalidIpcInput('Invalid TTS voice')
    }

    cachedConfig.provider = provider.trim()
    cachedConfig.model = model.trim()
    if (ttsMode) cachedConfig.ttsMode = ttsMode
    if (ttsVoice) cachedConfig.ttsVoice = ttsVoice
    return { success: true }
  })

  /** Create a new named API key — returns API key value ONCE */
  ipcMain.handle('localServer:createToken', (_event, rawParams: unknown) => {
    if (!isRecord(rawParams)) {
      return invalidIpcInput('Create API key payload must be an object')
    }
    purgeExpired()
    const now = Date.now()
    const ttlDays = normalizeTtlDays(rawParams.ttlDays)
    const entry: TokenEntry = {
      id:        makeTokenId(),
      name:      normalizeTokenName(rawParams.name),
      token:     makeTokenValue(),
      createdAt: now,
      expiresAt: now + ttlMs(ttlDays),
    }
    activeTokens.push(entry)
    saveTokens(activeTokens)
    // Return API key value ONCE — never returned again via listTokens
    return { success: true, token: entry.token, id: entry.id, name: entry.name, createdAt: entry.createdAt, expiresAt: entry.expiresAt }
  })

  /** List all active API keys — API key values are NEVER included */
  ipcMain.handle('localServer:listTokens', () => {
    purgeExpired()
    return {
      success: true,
      port: LOCAL_SERVER_PORT,
      tokens: activeTokens.map(({ id, name, createdAt, expiresAt }) => ({ id, name, createdAt, expiresAt })),
    }
  })

  /** Delete an API key immediately — it stops working at once */
  ipcMain.handle('localServer:deleteToken', (_event, rawParams: unknown) => {
    if (!isRecord(rawParams) || !isTokenId(rawParams.id)) {
      return invalidIpcInput('Invalid API key id')
    }
    const { id } = rawParams
    activeTokens = activeTokens.filter(t => t.id !== id)
    saveTokens(activeTokens)
    return { success: true }
  })

  /** Regenerate the API key value for an existing entry — returns new value ONCE, resets TTL */
  ipcMain.handle('localServer:regenerateToken', (_event, rawParams: unknown) => {
    if (!isRecord(rawParams) || !isTokenId(rawParams.id)) {
      return invalidIpcInput('Invalid API key id')
    }
    purgeExpired()
    const { id } = rawParams
    const idx = activeTokens.findIndex(t => t.id === id)
    if (idx === -1) return { success: false, error: 'API key not found' }
    const old = activeTokens[idx]
    const days = normalizeTtlDays(rawParams.ttlDays, Math.round((old.expiresAt - old.createdAt) / (24 * 60 * 60 * 1000)))
    const now = Date.now()
    activeTokens[idx] = {
      ...old,
      token:     makeTokenValue(),
      createdAt: now,
      expiresAt: now + ttlMs(days),
    }
    saveTokens(activeTokens)
    const updated = activeTokens[idx]
    // Return new API key value ONCE
    return { success: true, token: updated.token, id: updated.id, name: updated.name, createdAt: updated.createdAt, expiresAt: updated.expiresAt }
  })
}

export function stopLocalServer (): void {
  server?.close()
  server = null
}

/** Returns first active API key value for Legacy Assistant bookmarklet */
export function getServerToken (): string {
  purgeExpired()
  return activeTokens[0]?.token ?? ''
}

export function setLocalServerTokensForTest(tokens: TokenEntry[]): void {
  activeTokens = tokens
}

export function createLocalServerApiKeyForTest (): string {
  return makeTokenValue()
}
