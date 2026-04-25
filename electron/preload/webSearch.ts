/**
 * Web Search preload — exposes web search providers via contextBridge.
 */
import { ipcRenderer } from 'electron'

export const webSearchSection = {
  /** Search the web (Tavily → Brave → Jina fallback chain). */
  webSearch: (params: { query: string; maxResults?: number }) =>
    ipcRenderer.invoke('websearch:search', params),

  /**
   * Verify an API key by making a real minimal request BEFORE saving it.
   * Returns { valid: true } on success, or { valid: false, error } on failure.
   */
  webSearchVerify: (params: { provider: 'tavily' | 'brave'; apiKey: string }) =>
    ipcRenderer.invoke('websearch:verify', params),
}
