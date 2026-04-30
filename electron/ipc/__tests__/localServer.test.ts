// @vitest-environment node
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ttsMock = vi.hoisted(() => ({
  synthesizeTts: vi.fn(),
}))

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/viezan-test',
    getVersion: () => '1.0.0',
    getName: () => 'Viezan',
  },
}))

vi.mock('../lightweightTranslate', () => ({
  lightweightTranslate: vi.fn(),
}))

vi.mock('../storage', () => ({
  hasStoredApiKey: vi.fn(() => false),
}))

vi.mock('../tts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../tts')>()
  return {
    ...actual,
    synthesizeTts: ttsMock.synthesizeTts,
  }
})

import {
  createLocalServerApiKeyForTest,
  handleLocalServerRequest,
  setLocalServerTokensForTest,
} from '../localServer'

const VALID_EXTENSION_API_KEY = `sk-vie-${'a'.repeat(64)}`

function makeReq({
  method,
  url,
  token,
  body,
}: {
  method: string
  url: string
  token?: string
  body?: unknown
}) {
  const payload = body === undefined ? '' : JSON.stringify(body)
  const req = new Readable({
    read() {
      this.push(payload)
      this.push(null)
    },
  })
  Object.assign(req, {
    method,
    url,
    headers: {
      ...(token ? { 'x-viezan-token': token } : {}),
    },
  })
  return req
}

function makeRes(): Promise<{ statusCode: number; data: unknown }> & {
  res: {
    writeHead: (statusCode: number) => void
    end: (chunk: string) => void
  }
} {
  let statusCode = 0
  let resolveResult!: (value: { statusCode: number; data: unknown }) => void
  const promise = new Promise<{ statusCode: number; data: unknown }>((resolve) => {
    resolveResult = resolve
  }) as Promise<{ statusCode: number; data: unknown }> & {
    res: {
      writeHead: (statusCode: number) => void
      end: (chunk: string) => void
    }
  }
  promise.res = {
    writeHead: (code: number) => { statusCode = code },
    end: (chunk: string) => {
      resolveResult({ statusCode, data: JSON.parse(chunk) })
    },
  }
  return promise
}

async function request(params: {
  method: string
  url: string
  token?: string
  body?: unknown
}) {
  const response = makeRes()
  await handleLocalServerRequest(
    // biome-ignore lint/suspicious/noExplicitAny: focused HTTP handler unit test
    makeReq(params) as any,
    // biome-ignore lint/suspicious/noExplicitAny: focused HTTP handler unit test
    response.res as any,
  )
  return response
}

describe('localServer /api/tts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ttsMock.synthesizeTts.mockResolvedValue({
      success: true,
      audioBase64: 'ZmFrZS1hdWRpbw==',
      mimeType: 'audio/mpeg',
      provider: 'edge',
    })
    setLocalServerTokensForTest([{
      id: 'token-id',
      name: 'Test API key',
      token: VALID_EXTENSION_API_KEY,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    }])
  })

  afterEach(() => {
    setLocalServerTokensForTest([])
  })

  it('generates extension API keys with the sk-vie prefix', () => {
    expect(createLocalServerApiKeyForTest()).toMatch(/^sk-vie-[a-f0-9]{64}$/)
  })

  it('rejects unauthorized TTS requests', async () => {
    const response = await request({
      method: 'POST',
      url: '/api/tts',
      body: { text: 'Hello', lang: 'en' },
    })

    expect(response.statusCode).toBe(401)
    expect(ttsMock.synthesizeTts).not.toHaveBeenCalled()
  })

  it('rejects legacy API key values without the sk-vie prefix', async () => {
    setLocalServerTokensForTest([{
      id: 'legacy-id',
      name: 'Legacy API key',
      token: 'valid-token',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    }])

    const response = await request({
      method: 'POST',
      url: '/api/tts',
      token: 'valid-token',
      body: { text: 'Hello', lang: 'en' },
    })

    expect(response.statusCode).toBe(401)
    expect(ttsMock.synthesizeTts).not.toHaveBeenCalled()
  })

  it('calls shared TTS synthesis using the cached settings mode', async () => {
    const response = await request({
      method: 'POST',
      url: '/api/tts',
      token: VALID_EXTENSION_API_KEY,
      body: { text: 'Hello', lang: 'en', mode: 'premium' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.data).toMatchObject({
      success: true,
      audioBase64: 'ZmFrZS1hdWRpbw==',
      mimeType: 'audio/mpeg',
      provider: 'edge',
    })
    expect(ttsMock.synthesizeTts).toHaveBeenCalledWith({
      text: 'Hello',
      lang: 'en',
      mode: 'free',
      voice: 'nova',
    })
  })
})
