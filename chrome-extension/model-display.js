/**
 * model-display.js — shared helpers for rendering provider / model labels in
 * the Chrome extension. Mirrors src/utils/modelDisplay.ts so the popup,
 * options page, and floating in-page UI all show the same short pretty names
 * (e.g. "GPT 5.5 Mini") instead of the raw IDs the native app exposes.
 *
 * Why this is a separate file (no ES modules):
 *   - popup.html / options.html load it via a plain <script> tag.
 *   - content.js is a content-script and has its own isolated world; we copy
 *     the same logic via `chrome-extension/manifest.json`'s content_scripts
 *     declaration (see manifest update).
 *
 * The helpers are exported on a global `ViezanModelDisplay` object — keep the
 * surface small and additive so future scripts can use it without coupling.
 */
;(function attachToGlobal (root) {
  // ─── Display name formatting ───────────────────────────────────────────────

  /** Provider id → short brand name shown in badges / footer chips. */
  const PROVIDER_DISPLAY_NAMES = {
    openai: 'OpenAI',
    claude: 'Claude',
    gemini: 'Google Gemini',
    local: 'Local AI',
  }

  function getProviderDisplayName (provider) {
    return PROVIDER_DISPLAY_NAMES[provider] || provider || ''
  }

  /**
   * Strip the date / version tail from a model id so tokens that follow can
   * be cleanly humanized.  Mirror of stripVersionSuffix in modelDisplay.ts —
   * keep these regexes in lock-step.
   */
  function stripVersionSuffix (id) {
    return String(id || '')
      .replace(/-\d{4}-\d{2}-\d{2}$/, '')   // OpenAI dated snapshots
      .replace(/-\d{8}$/, '')               // Claude dated snapshots
      .replace(/-latest$/, '')              // "latest" alias
      .replace(/-preview(-\d+)?$/, '')      // Gemini preview tags
      .replace(/-exp(-\d+)?$/, '')          // experimental builds
      .replace(/-\d{3}$/, '')               // numeric build suffix (-001, ...)
  }

  /** Title-case unknown tokens; keep brand-canonical casing for known ones. */
  function prettifyToken (token) {
    const lower = String(token || '').toLowerCase()
    const known = {
      mini: 'Mini', nano: 'Nano', pro: 'Pro', flash: 'Flash', lite: 'Lite',
      ultra: 'Ultra', haiku: 'Haiku', sonnet: 'Sonnet', opus: 'Opus',
      thinking: 'Thinking', reasoning: 'Reasoning', turbo: 'Turbo',
      instant: 'Instant', vision: 'Vision', audio: 'Audio',
      realtime: 'Realtime', omni: 'Omni',
    }
    if (known[lower]) return known[lower]
    if (/^4o$/.test(lower)) return '4o'
    if (/^\d+(\.\d+)?$/.test(lower)) return lower
    if (!token) return ''
    return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()
  }

  function formatProviderModel (provider, id) {
    const stripped = stripVersionSuffix(id)
    const lower = stripped.toLowerCase()

    if (provider === 'openai') {
      if (lower.startsWith('gpt-')) {
        const tokens = stripped.slice(4).split('-').filter(Boolean).map(prettifyToken)
        return ['GPT'].concat(tokens).join(' ')
      }
      if (/^o\d+/.test(lower)) {
        return stripped.split('-').map((tok, idx) => idx === 0 ? tok.toLowerCase() : prettifyToken(tok)).join(' ')
      }
      return null
    }

    if (provider === 'claude') {
      if (lower.startsWith('claude-')) {
        const parts = stripped.slice(7).split('-').filter(Boolean)
        const collapsed = []
        for (let i = 0; i < parts.length; i++) {
          const cur = parts[i]
          const next = parts[i + 1]
          if (/^\d+$/.test(cur) && next && /^\d+$/.test(next)) {
            collapsed.push(cur + '.' + next)
            i++
          } else {
            collapsed.push(cur)
          }
        }
        return ['Claude'].concat(collapsed.map(prettifyToken)).join(' ')
      }
      return null
    }

    if (provider === 'gemini') {
      if (lower.startsWith('gemini-')) {
        const tokens = stripped.slice(7).split('-').filter(Boolean).map(prettifyToken)
        return ['Gemini'].concat(tokens).join(' ')
      }
      return null
    }

    return null
  }

  /**
   * formatModelName(provider, id, fallback?)
   * Returns the short pretty model label — e.g. "GPT 5.5 Mini" — or the raw
   * id / fallback if the provider isn't recognized.
   */
  function formatModelName (provider, modelId, fallbackName) {
    if (!modelId) return fallbackName || ''
    const pretty = formatProviderModel(provider, modelId)
    if (pretty) return pretty
    const fb = (fallbackName || '').trim()
    return fb || modelId
  }

  // ─── Export ────────────────────────────────────────────────────────────────

  root.ViezanModelDisplay = {
    formatModelName,
    getProviderDisplayName,
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)
