/**
 * modelDisplay — shared utilities for turning long, raw provider model IDs
 * (e.g. `gpt-5.4-mini-2026-03-17`, `claude-opus-4-1-20250805`) into short,
 * humanized display names like `GPT 5.4 Mini`, `Claude Opus 4.1`.
 *
 * Also exposes `dedupeModelsByFamily()` which collapses the many
 * date-stamped / `-latest` variants a provider exposes per family down to
 * a single representative entry (the newest one in each family).
 *
 * Why both live here:
 *  - The dropdown UI never wants to show 5 different `gpt-5-mini-*` rows.
 *  - The status footer in the Quick Chat popup wants the short pretty name.
 *  - Keeping it provider-agnostic means new providers only update the
 *    `formatModelName` switch, not five call sites.
 */
import type { FetchedModel, Provider } from '../types'

// ─── Display name formatting ──────────────────────────────────────────────────

/** Provider id → human display name fragment used in the footer (e.g. "OpenAI"). */
const PROVIDER_DISPLAY_NAMES: Record<Provider, string> = {
  openai: 'OpenAI',
  claude: 'Claude',
  gemini: 'Google Gemini',
  local: 'Local AI',
}

export function getProviderDisplayName(provider: Provider): string {
  return PROVIDER_DISPLAY_NAMES[provider] ?? provider
}

/**
 * Strip date / version tail from a model id so we can compare what's left.
 * Matches:
 *   - `-YYYY-MM-DD`        (OpenAI dated snapshots e.g. `gpt-5.4-mini-2026-03-17`)
 *   - `-YYYYMMDD`          (Claude dated snapshots e.g. `claude-sonnet-4-20250514`)
 *   - `-latest`            (any provider's "latest" alias)
 *   - `-preview` / `-exp`  (Gemini preview / experimental tags)
 *   - trailing `-\d+`      (numeric build suffix, e.g. `-001`, `-002`)
 */
function stripVersionSuffix(id: string): string {
  return id
    .replace(/-\d{4}-\d{2}-\d{2}$/, '')
    .replace(/-\d{8}$/, '')
    .replace(/-latest$/, '')
    .replace(/-preview(-\d+)?$/, '')
    .replace(/-exp(-\d+)?$/, '')
    .replace(/-\d{3}$/, '')
}

/**
 * Capitalize known model family tokens.
 * Falls back to title-case for unknowns so unrecognized models still look OK.
 */
function prettifyToken(token: string): string {
  const lower = token.toLowerCase()
  // Known model variant words — keep the canonical brand casing.
  const known: Record<string, string> = {
    mini: 'Mini',
    nano: 'Nano',
    pro: 'Pro',
    flash: 'Flash',
    lite: 'Lite',
    ultra: 'Ultra',
    haiku: 'Haiku',
    sonnet: 'Sonnet',
    opus: 'Opus',
    thinking: 'Thinking',
    reasoning: 'Reasoning',
    turbo: 'Turbo',
    instant: 'Instant',
    vision: 'Vision',
    audio: 'Audio',
    realtime: 'Realtime',
    omni: 'Omni',
  }
  if (known[lower]) return known[lower]
  // GPT-4o keeps lowercase 'o' — surface it correctly.
  if (/^4o$/.test(lower)) return '4o'
  // Pure version tokens like "4.1", "2.5", "5", "5.4" — keep as-is.
  if (/^\d+(\.\d+)?$/.test(lower)) return lower
  // Unknown alphanumeric token → Title Case.
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()
}

/**
 * Try to produce a short pretty name for the given model id.
 * Returns `null` if the id doesn't match a known provider pattern — caller
 * should fall back to the raw model name in that case.
 */
function formatProviderModel(provider: Provider, id: string): string | null {
  const stripped = stripVersionSuffix(id)
  const lower = stripped.toLowerCase()

  if (provider === 'openai') {
    // OpenAI ids look like `gpt-5.4-mini`, `gpt-4o`, `o1-mini`, `gpt-5-thinking`.
    if (lower.startsWith('gpt-')) {
      const rest = stripped.slice(4) // drop "gpt-"
      const tokens = rest.split('-').filter(Boolean).map(prettifyToken)
      return ['GPT', ...tokens].join(' ')
    }
    // Reasoning models: o1, o3, o4, possibly with -mini etc.
    if (/^o\d+/.test(lower)) {
      const tokens = stripped.split('-').map((tok, idx) =>
        idx === 0 ? tok.toLowerCase() : prettifyToken(tok),
      )
      return tokens.join(' ')
    }
    return null
  }

  if (provider === 'claude') {
    // Claude ids: `claude-sonnet-4`, `claude-opus-4-1`, `claude-3-5-sonnet`.
    if (lower.startsWith('claude-')) {
      const rest = stripped.slice(7) // drop "claude-"
      const parts = rest.split('-').filter(Boolean)
      // Collapse adjacent numeric tokens like ["4","1"] → "4.1" or ["3","5"] → "3.5".
      const collapsed: string[] = []
      for (let i = 0; i < parts.length; i++) {
        const cur = parts[i]
        const next = parts[i + 1]
        if (/^\d+$/.test(cur) && next && /^\d+$/.test(next)) {
          collapsed.push(`${cur}.${next}`)
          i++
        } else {
          collapsed.push(cur)
        }
      }
      const tokens = collapsed.map(prettifyToken)
      return ['Claude', ...tokens].join(' ')
    }
    return null
  }

  if (provider === 'gemini') {
    // Gemini ids: `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-1.5-pro`.
    if (lower.startsWith('gemini-')) {
      const rest = stripped.slice(7)
      const tokens = rest.split('-').filter(Boolean).map(prettifyToken)
      return ['Gemini', ...tokens].join(' ')
    }
    return null
  }

  return null
}

/**
 * Public — format a model id for display.
 *
 * @param provider Provider id used to pick a humanizer.
 * @param modelId  Raw id from the provider API (e.g. `gpt-5.4-mini-2026-03-17`).
 * @param fallbackName Optional pre-existing display name (e.g. `m.name`) used
 *                    when the id doesn't match a known pattern.
 */
export function formatModelName(
  provider: Provider,
  modelId: string,
  fallbackName?: string,
): string {
  if (!modelId) return fallbackName ?? ''
  const pretty = formatProviderModel(provider, modelId)
  if (pretty) return pretty
  return fallbackName?.trim() || modelId
}

// ─── De-duplication ───────────────────────────────────────────────────────────

/**
 * Build a stable "family key" so all variants of e.g. `gpt-5-mini` collapse
 * to a single bucket. We strip date stamps + `-latest` suffixes and lowercase
 * the rest.
 */
export function getModelFamilyKey(_provider: Provider, id: string): string {
  return stripVersionSuffix(id).toLowerCase()
}

/**
 * Reduce a list of provider models to one entry per family — the *newest* one
 * (assumed to be the lexicographically-largest id within the family, which
 * matches the date-stamped / numeric-suffixed conventions every supported
 * provider uses today).
 *
 * Local AI is exempt: users hand-pick which on-disk models to keep, so we
 * never deduplicate that list.
 */
export function dedupeModelsByFamily<T extends FetchedModel>(
  provider: Provider,
  models: T[],
): T[] {
  if (provider === 'local') return models
  if (!Array.isArray(models) || models.length === 0) return models

  // Bucket by family key, keeping the best representative per bucket.
  // Preference order:
  //   1. A dated snapshot (`-YYYY-MM-DD` / `-YYYYMMDD`) over a `-latest` alias
  //      — `latest` lex-sorts higher than digits, so naive lex compare is wrong.
  //   2. Among dated snapshots, the lexicographically-larger id (newest wins).
  const isLatestAlias = (id: string) => /-latest$/i.test(id)
  const buckets = new Map<string, T>()
  const order: string[] = []
  for (const model of models) {
    const key = getModelFamilyKey(provider, model.id)
    const existing = buckets.get(key)
    if (!existing) {
      buckets.set(key, model)
      order.push(key)
      continue
    }
    const existingIsLatest = isLatestAlias(existing.id)
    const candidateIsLatest = isLatestAlias(model.id)
    if (existingIsLatest && !candidateIsLatest) {
      buckets.set(key, model)
    } else if (!existingIsLatest && candidateIsLatest) {
      // keep existing dated snapshot
    } else if (model.id.localeCompare(existing.id) > 0) {
      buckets.set(key, model)
    }
  }
  return order.map((key) => buckets.get(key) as T)
}
