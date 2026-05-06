/**
 * Shared provider badge metadata for extension surfaces.
 * Keep these values aligned with src/constants/providers.ts.
 */
;(() => {
  const PROVIDER_META = Object.freeze({
    gemini: { color: '#4B5563', rgb: '75,85,99' },
    openai: { color: '#4B5563', rgb: '75,85,99' },
    claude: { color: '#4B5563', rgb: '75,85,99' },
    local:  { color: '#4B5563', rgb: '75,85,99' },
  })

  function getProviderMeta (provider, options = {}) {
    const meta = PROVIDER_META[provider]
    if (!meta) return null
    const bgAlpha = options.bgAlpha ?? 0.09
    const borderAlpha = options.borderAlpha ?? 0.22
    return {
      color: meta.color,
      bg: `rgba(${meta.rgb},${bgAlpha})`,
      border: `rgba(${meta.rgb},${borderAlpha})`,
    }
  }

  globalThis.ViezanProviderMeta = {
    getProviderMeta,
  }
})()
