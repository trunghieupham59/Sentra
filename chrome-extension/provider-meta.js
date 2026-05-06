/**
 * Shared provider badge metadata for extension surfaces.
 * Keep these flat brand colors aligned with src/constants/providers.ts.
 */
;(() => {
  const PROVIDER_META = Object.freeze({
    gemini: { color: '#4285F4', rgb: '66,133,244' },
    openai: { color: '#10A37F', rgb: '16,163,127' },
    claude: { color: '#CC785C', rgb: '204,120,92' },
    local:  { color: '#6B7280', rgb: '107,114,128' },
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
