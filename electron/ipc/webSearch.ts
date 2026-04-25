/**
 * Web Search IPC handler — multi-provider with automatic fallback.
 *
 * Provider priority (highest → lowest):
 *   1. Tavily   — AI-optimised, best quality for LLM consumption (requires key)
 *   2. Brave    — Clean structured results, 2,000 free req/month (requires key)
 *   3. Jina AI  — Completely free, no API key required (default fallback)
 *
 * The first provider that has a configured key (or is free) is used.
 * Raw keys NEVER leave the main process; the renderer only receives results.
 *
 * Register keys at:
 *   Tavily → https://app.tavily.com
 *   Brave  → https://api.search.brave.com
 *   Jina   → no registration needed (use https://jina.ai for higher limits)
 */
import type { IpcMain } from 'electron'
import { getStoredApiKey } from './storage'

// ─── Shared response types ────────────────────────────────────────────────────

export interface WebSearchResult {
  title: string
  url: string
  content: string
  score: number
}

export interface WebSearchResponse {
  success: boolean
  results?: WebSearchResult[]
  answer?: string
  error?: string
  /** Which provider actually served the request */
  provider?: 'tavily' | 'brave' | 'jina'
}

const DEFAULT_MAX_RESULTS = 5

// ─── Tavily ───────────────────────────────────────────────────────────────────

const TAVILY_URL = 'https://api.tavily.com/search'

interface TavilyResponse {
  query: string
  answer?: string
  results: Array<{ title: string; url: string; content: string; score: number }>
}

async function searchTavily(
  apiKey: string,
  query: string,
  maxResults: number,
): Promise<WebSearchResponse> {
  const response = await fetch(TAVILY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      max_results: maxResults,
      include_answer: true,
      include_raw_content: false,
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Tavily ${response.status}: ${text || response.statusText}`)
  }

  const data = await response.json() as TavilyResponse
  return {
    success: true,
    provider: 'tavily',
    results: (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
    })),
    answer: data.answer ?? undefined,
  }
}

// ─── Brave Search ─────────────────────────────────────────────────────────────

const BRAVE_URL = 'https://api.search.brave.com/res/v1/web/search'

interface BraveWebResult {
  title: string
  url: string
  description?: string
  extra_snippets?: string[]
}

interface BraveResponse {
  web?: { results?: BraveWebResult[] }
  summarizer?: { key?: string }
}

async function searchBrave(
  apiKey: string,
  query: string,
  maxResults: number,
): Promise<WebSearchResponse> {
  const url = new URL(BRAVE_URL)
  url.searchParams.set('q', query)
  url.searchParams.set('count', String(maxResults))
  url.searchParams.set('result_filter', 'web')

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Brave ${response.status}: ${text || response.statusText}`)
  }

  const data = await response.json() as BraveResponse
  const webResults = data.web?.results ?? []

  return {
    success: true,
    provider: 'brave',
    results: webResults.map((r, i) => ({
      title: r.title,
      url: r.url,
      content: [r.description ?? '', ...(r.extra_snippets ?? [])].filter(Boolean).join('\n'),
      // Brave doesn't provide relevance scores — use position-based descending score
      score: Math.max(0, 1 - i * 0.1),
    })),
  }
}

// ─── Jina AI Search (free fallback) ──────────────────────────────────────────

const JINA_SEARCH_URL = 'https://s.jina.ai/'

interface JinaResult {
  title: string
  url: string
  content?: string
  description?: string
}

interface JinaResponse {
  code?: number
  data?: JinaResult[]
}

async function searchJina(
  query: string,
  maxResults: number,
  apiKey?: string,
): Promise<WebSearchResponse> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'X-Retain-Images': 'none',
  }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const response = await fetch(`${JINA_SEARCH_URL}${encodeURIComponent(query)}`, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Jina ${response.status}: ${text || response.statusText}`)
  }

  const data = await response.json() as JinaResponse
  const results = (data.data ?? []).slice(0, maxResults)

  return {
    success: true,
    provider: 'jina',
    results: results.map((r, i) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      content: r.content ?? r.description ?? '',
      score: Math.max(0, 1 - i * 0.1),
    })),
  }
}

// ─── IPC handler ─────────────────────────────────────────────────────────────

export function registerWebSearchHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    'websearch:search',
    async (_event, params: { query: string; maxResults?: number }): Promise<WebSearchResponse> => {
      const query = params.query.slice(0, 200)
      const maxResults = params.maxResults ?? DEFAULT_MAX_RESULTS

      // 1. Try Tavily (best quality for LLMs)
      const tavilyKey = getStoredApiKey('tavily')
      if (tavilyKey) {
        try {
          return await searchTavily(tavilyKey, query, maxResults)
        } catch (err) {
          console.warn('[webSearch] Tavily failed, trying next provider:', err)
        }
      }

      // 2. Try Brave Search
      const braveKey = getStoredApiKey('brave')
      if (braveKey) {
        try {
          return await searchBrave(braveKey, query, maxResults)
        } catch (err) {
          console.warn('[webSearch] Brave failed, trying next provider:', err)
        }
      }

      // 3. Jina AI Search — free fallback (no key required, but key unlocks higher limits)
      const jinaKey = getStoredApiKey('jina') || undefined
      try {
        return await searchJina(query, maxResults, jinaKey)
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'All web search providers failed',
        }
      }
    },
  )

  /** Check which web search providers are currently configured */
  ipcMain.handle('websearch:status', async (): Promise<{
    tavily: boolean
    brave: boolean
    jina: boolean
    activeProvider: 'tavily' | 'brave' | 'jina'
  }> => {
    const tavily = Boolean(getStoredApiKey('tavily'))
    const brave = Boolean(getStoredApiKey('brave'))
    const jina = true // always available
    const activeProvider = tavily ? 'tavily' : brave ? 'brave' : 'jina'
    return { tavily, brave, jina, activeProvider }
  })

  /**
   * Verify that a web search API key is valid by making a minimal real request.
   * Called BEFORE saving the key to keychain so users get immediate feedback.
   */
  ipcMain.handle(
    'websearch:verify',
    async (_event, params: { provider: 'tavily' | 'brave'; apiKey: string }): Promise<{
      valid: boolean
      error?: string
    }> => {
      const { provider, apiKey } = params
      if (!apiKey?.trim()) return { valid: false, error: 'API key trống' }

      try {
        if (provider === 'tavily') {
          const res = await fetch(TAVILY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: apiKey.trim(),
              query: 'test',
              search_depth: 'basic',
              max_results: 1,
              include_answer: false,
              include_raw_content: false,
            }),
          })
          if (res.ok) return { valid: true }
          const text = await res.text().catch(() => '')
          if (res.status === 401 || res.status === 403) {
            return { valid: false, error: 'API key không hợp lệ' }
          }
          return { valid: false, error: `Tavily lỗi ${res.status}: ${text || res.statusText}` }
        }

        if (provider === 'brave') {
          const url = new URL(BRAVE_URL)
          url.searchParams.set('q', 'test')
          url.searchParams.set('count', '1')
          url.searchParams.set('result_filter', 'web')
          const res = await fetch(url.toString(), {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Accept-Encoding': 'gzip',
              'X-Subscription-Token': apiKey.trim(),
            },
          })
          if (res.ok) return { valid: true }
          const text = await res.text().catch(() => '')
          if (res.status === 401 || res.status === 403) {
            return { valid: false, error: 'API key không hợp lệ' }
          }
          return { valid: false, error: `Brave lỗi ${res.status}: ${text || res.statusText}` }
        }

        return { valid: false, error: 'Provider không hợp lệ' }
      } catch (err) {
        return {
          valid: false,
          error: err instanceof Error ? err.message : 'Lỗi kết nối mạng',
        }
      }
    },
  )
}
