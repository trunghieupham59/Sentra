/**
 * Local HTTP Server — lets the Lotus Chrome Extension communicate with the
 * native Lotus app running on the same machine.
 *
 * Security model:
 *   • Server only listens on 127.0.0.1 (loopback — not reachable from outside)
 *   • Every request must carry the header  X-Lotus-Token: <secret>
 *   • Tokens are 32-byte random hex strings (64 chars), named, with configurable TTL
 *   • Token values are returned ONLY at creation or regeneration — never again
 *   • Multiple tokens can coexist (one per device/browser)
 *
 * Endpoints:
 *   GET  /api/status                                 → { success, version }
 *   POST /api/translate  { text, targetLang, sourceLang?, provider?, model? }
 *                        → { success, translatedText } | { success:false, error }
 */
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as http from 'node:http'
import * as path from 'node:path'
import { app } from 'electron'
import { lightweightTranslate } from './lightweightTranslate'

// ── Config ────────────────────────────────────────────────────────────────────

export const LOCAL_SERVER_PORT = 39875
/** New multi-token file (replaces legacy single-token file) */
const TOKENS_FILE = 'local-server-tokens.json'
/** Legacy single-token file — migrated on first run */
const LEGACY_TOKEN_FILE = 'local-server-token.json'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TokenEntry {
  id: string         // 8-byte random hex
  name: string       // user-given label
  token: string      // 32-byte random hex (64 chars) — stored but NEVER returned in list
  createdAt: number  // Unix ms
  expiresAt: number  // Unix ms
}

/** What the list endpoint returns — no token value */
export type TokenInfo = Omit<TokenEntry, 'token'>

// ── State ─────────────────────────────────────────────────────────────────────

let activeTokens: TokenEntry[] = []
let server: http.Server | null = null

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
  // 1. Try new multi-token file
  try {
    const p = getTokensPath()
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'))
      if (Array.isArray(data)) {
        const now = Date.now()
        return data.filter((t: TokenEntry) =>
          typeof t.id === 'string' &&
          typeof t.name === 'string' &&
          typeof t.token === 'string' && t.token.length > 0 &&
          typeof t.expiresAt === 'number' && t.expiresAt > now
        )
      }
    }
  } catch { /* fall through */ }

  // 2. Migrate from legacy single-token file
  try {
    const lp = getLegacyTokenPath()
    if (fs.existsSync(lp)) {
      const data = JSON.parse(fs.readFileSync(lp, 'utf-8'))
      if (typeof data.token === 'string' && data.token.length > 0) {
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
  activeTokens = activeTokens.filter(t => t.expiresAt > now)
  if (activeTokens.length !== before) saveTokens(activeTokens)
}

// ── Token helpers ─────────────────────────────────────────────────────────────

function makeTokenId (): string {
  return crypto.randomBytes(8).toString('hex')
}
function makeTokenValue (): string {
  return crypto.randomBytes(32).toString('hex')
}
function ttlMs (days: number): number {
  return Math.max(1, Math.min(days, 365)) * 24 * 60 * 60 * 1000
}

// ── HTTP server ───────────────────────────────────────────────────────────────

function sendJSON (res: http.ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Lotus-Token',
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

export function startLocalServer (ipcMain: Electron.IpcMain): void {
  activeTokens = loadTokens()

  server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { sendJSON(res, 200, {}); return }

    // Validate token against all active, non-expired tokens
    const incomingToken = req.headers['x-lotus-token']
    const now = Date.now()
    purgeExpired()
    const valid = activeTokens.some(t => t.token === incomingToken && t.expiresAt > now)
    if (!valid) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized — token expired or invalid' })
      return
    }

    const url = req.url ?? ''

    if (req.method === 'GET' && url === '/api/status') {
      sendJSON(res, 200, { success: true, version: app.getVersion(), appName: app.getName() })
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
    sendJSON(res, 404, { success: false, error: 'Not found' })
  })

  server.listen(LOCAL_SERVER_PORT, '127.0.0.1', () => {
    console.log(`[LocalServer] Listening on http://127.0.0.1:${LOCAL_SERVER_PORT}`)
  })
  server.on('error', (err) => {
    console.error('[LocalServer] Error:', err)
  })

  // ── IPC handlers ─────────────────────────────────────────────────────────

  /** Create a new named token — returns token value ONCE */
  ipcMain.handle('localServer:createToken', (_event, { name, ttlDays }: { name: string; ttlDays: number }) => {
    purgeExpired()
    const now = Date.now()
    const entry: TokenEntry = {
      id:        makeTokenId(),
      name:      (name || 'Extension Token').trim(),
      token:     makeTokenValue(),
      createdAt: now,
      expiresAt: now + ttlMs(ttlDays),
    }
    activeTokens.push(entry)
    saveTokens(activeTokens)
    // Return token value ONCE — never returned again via listTokens
    return { success: true, token: entry.token, id: entry.id, name: entry.name, createdAt: entry.createdAt, expiresAt: entry.expiresAt }
  })

  /** List all active tokens — token values are NEVER included */
  ipcMain.handle('localServer:listTokens', () => {
    purgeExpired()
    return {
      success: true,
      port: LOCAL_SERVER_PORT,
      tokens: activeTokens.map(({ id, name, createdAt, expiresAt }) => ({ id, name, createdAt, expiresAt })),
    }
  })

  /** Delete a token immediately — it stops working at once */
  ipcMain.handle('localServer:deleteToken', (_event, { id }: { id: string }) => {
    activeTokens = activeTokens.filter(t => t.id !== id)
    saveTokens(activeTokens)
    return { success: true }
  })

  /** Regenerate the token value for an existing entry — returns new value ONCE, resets TTL */
  ipcMain.handle('localServer:regenerateToken', (_event, { id, ttlDays }: { id: string; ttlDays?: number }) => {
    purgeExpired()
    const idx = activeTokens.findIndex(t => t.id === id)
    if (idx === -1) return { success: false, error: 'Token not found' }
    const old = activeTokens[idx]
    const days = ttlDays ?? Math.round((old.expiresAt - old.createdAt) / (24 * 60 * 60 * 1000))
    const now = Date.now()
    activeTokens[idx] = {
      ...old,
      token:     makeTokenValue(),
      createdAt: now,
      expiresAt: now + ttlMs(days),
    }
    saveTokens(activeTokens)
    const updated = activeTokens[idx]
    // Return new token value ONCE
    return { success: true, token: updated.token, id: updated.id, name: updated.name, createdAt: updated.createdAt, expiresAt: updated.expiresAt }
  })
}

export function stopLocalServer (): void {
  server?.close()
  server = null
}

/** Returns first active token value for Legacy Assistant bookmarklet */
export function getServerToken (): string {
  purgeExpired()
  return activeTokens[0]?.token ?? ''
}
