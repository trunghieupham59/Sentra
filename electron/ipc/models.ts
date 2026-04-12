import { IpcMain } from 'electron'

const KEYCHAIN_SERVICE = 'TranslateApp'

interface FetchedModel {
  id: string
  name: string
  description: string
}

async function getApiKey(provider: string): Promise<string | null> {
  try {
    const keytar = await import('keytar')
    return await keytar.default.getPassword(KEYCHAIN_SERVICE, provider)
  } catch {
    return null
  }
}

/**
 * Scores a model for translation suitability.
 * Higher score = better balance of speed + quality for translation.
 * This runs after every model fetch so new models are automatically evaluated.
 */
function scoreModelForTranslation(provider: string, modelId: string): number {
  const id = modelId.toLowerCase()
  let score = 0

  if (provider === 'gemini') {
    // Flash = fast + good quality for translation
    if (id.includes('flash')) score += 200
    else if (id.includes('pro')) score += 80
    else if (id.includes('ultra')) score += 60
    // Prefer newer generation numbers  (gemini-2 > gemini-1.5 > gemini-1)
    const gen = id.match(/gemini-(\d+)\.?(\d*)/)
    if (gen) score += parseFloat(`${gen[1]}.${gen[2] || 0}`) * 20
    // Avoid experimental / lite variants
    if (id.includes('lite') || id.includes('nano')) score -= 50
  } else if (provider === 'claude') {
    // Haiku = fastest + great for translation
    if (id.includes('haiku')) score += 200
    else if (id.includes('sonnet')) score += 100
    else if (id.includes('opus')) score += 40   // too slow/expensive
    // Version bonus: claude-3-5 > claude-3
    const ver = id.match(/claude-(\d+)-?(\d*)/)
    if (ver) score += parseFloat(`${ver[1]}.${ver[2] || 0}`) * 15
    // Date bonus: newer release date = higher score
    const date = id.match(/(\d{8})$/)
    if (date) score += parseInt(date[1]) / 2000000
  } else if (provider === 'openai') {
    // Mini models: fast + good translation quality
    if (id.includes('mini')) score += 200
    else if (id.includes('4o')) score += 120
    else if (id.includes('4')) score += 80
    else if (id.includes('3.5')) score += 50
    // Version bonus: 4o > 4 > 3.5
    if (id.includes('4o')) score += 30
    if (id.includes('4')) score += 10
    // Avoid reasoning models
    if (id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4')) score = 0
  }

  return score
}

function describeModel(id: string): string {
  const lower = id.toLowerCase()
  if (lower.includes('flash')) return 'Fast'
  if (lower.includes('ultra')) return 'Most powerful'
  if (lower.includes('pro')) return 'Powerful'
  if (lower.includes('haiku')) return 'Fast'
  if (lower.includes('opus')) return 'Most powerful'
  if (lower.includes('sonnet')) return 'Balanced'
  if (lower.includes('mini')) return 'Fast & affordable'
  if (lower.includes('4o')) return 'Most capable'
  if (lower.includes('3.5')) return 'Economy'
  if (lower.startsWith('o1') || lower.startsWith('o3')) return 'Reasoning'
  return ''
}

// ─── Gemini: REST API ──────────────────────────────────────────────────────────
async function fetchGeminiModels(apiKey: string): Promise<FetchedModel[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=50`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${body}`)
  }
  const data = await res.json() as { models: Array<{ name: string; displayName: string; supportedGenerationMethods: string[] }> }
  return (data.models || [])
    .filter((m) => {
      const id = m.name.replace('models/', '')
      return (
        m.supportedGenerationMethods?.includes('generateContent') &&
        id.startsWith('gemini-') &&
        !id.includes('embedding') &&
        !id.includes('aqa') &&
        !id.includes('exp') &&
        // Allow preview models — they include newer vision-capable variants (e.g. Gemini 2.5 Flash)
        !id.includes('thinking') &&
        !id.includes('learnlm')
      )
    })
    .map((m) => {
      const id = m.name.replace('models/', '')
      return { id, name: m.displayName || id, description: describeModel(id) }
    })
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, 10)
}

// ─── Claude: REST API ──────────────────────────────────────────────────────────
async function fetchClaudeModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch('https://api.anthropic.com/v1/models?limit=20', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Claude API error ${res.status}: ${body}`)
  }
  const data = await res.json() as { data: Array<{ id: string; display_name: string }> }
  return (data.data || [])
    .filter((m) => m.id.startsWith('claude'))
    .map((m) => ({
      id: m.id,
      name: m.display_name || m.id,
      description: describeModel(m.id),
    }))
    .slice(0, 8)
}

// ─── OpenAI: SDK (has proper .models.list()) ──────────────────────────────────
async function fetchOpenAIModels(apiKey: string): Promise<FetchedModel[]> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })
  const response = await client.models.list()
  const excluded = [
    'embedding', 'tts', 'whisper', 'dall-e', 'davinci-002',
    'babbage', 'moderation', 'text-search', 'text-similarity', 'code-search',
    'instruct', 'realtime', 'audio', 'transcribe',
    // Image generation models — do NOT support chat/completions endpoint
    'image',
    // Codex — completions-only, not chat
    'codex',
  ]
  return response.data
    .filter((m) => {
      const id = m.id.toLowerCase()
      // Only GPT chat models
      const isGpt = id.startsWith('gpt-')
      const notExcluded = !excluded.some((e) => id.includes(e))
      return isGpt && notExcluded
    })
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, 12)
    .map((m) => ({ id: m.id, name: m.id, description: describeModel(m.id) }))
}

export function registerModelsHandlers(ipcMain: IpcMain) {
  ipcMain.handle('models:fetch', async (_event, provider: string) => {
    const apiKey = await getApiKey(provider)
    if (!apiKey) {
      return { success: false, errorCode: 'NO_API_KEY', models: [] }
    }
    try {
      let models: FetchedModel[] = []
      switch (provider) {
        case 'gemini': models = await fetchGeminiModels(apiKey); break
        case 'claude': models = await fetchClaudeModels(apiKey); break
        case 'openai': models = await fetchOpenAIModels(apiKey); break
        default: return { success: false, error: `Unknown provider: ${provider}`, models: [] }
      }
      // Score each model and pick the best one for translation
      const recommendedModel = models.length > 0
        ? models.reduce((best, m) =>
            scoreModelForTranslation(provider, m.id) > scoreModelForTranslation(provider, best.id) ? m : best
          , models[0]).id
        : undefined
      return { success: true, models, recommendedModel }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg, models: [] }
    }
  })
}
