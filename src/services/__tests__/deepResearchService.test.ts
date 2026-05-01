import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deepResearchService } from '../deepResearchService'

describe('deepResearchService', () => {
  beforeEach(() => {
    vi.mocked(window.api.chat).mockReset()
    window.api.webSearch = vi.fn().mockResolvedValue({ success: false })
  })

  it('includes attached images in research calls and uses visual search terms', async () => {
    const webSearchMock = vi.fn().mockResolvedValue({
      success: true,
      results: [{
        title: 'Acme X100 review',
        url: 'https://example.test/acme-x100',
        content: 'Acme X100 is a compact gadget with recent market coverage.',
        score: 0.9,
      }],
    })
    ;(window.api as typeof window.api & { webSearch: typeof webSearchMock }).webSearch = webSearchMock

    const replies = [
      JSON.stringify({
        aspects: ['Product identity', 'Recent market coverage'],
        imageContext: 'The image shows an Acme X100 gadget box.',
        searchTerms: ['Acme X100 gadget'],
      }),
      'Product identity findings',
      'Market coverage findings',
      JSON.stringify({ isComplete: true, gaps: [], queries: [] }),
      'Cross-reference complete',
      'Final synthesis',
    ]
    vi.mocked(window.api.chat).mockImplementation(async () => ({
      success: true,
      reply: replies.shift() ?? 'Fallback reply',
    }))

    await deepResearchService.run({
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      question: 'Research this image',
      images: [{ imageBase64: 'image-base64', imageMimeType: 'image/png' }],
      callbacks: {
        onStepStart: vi.fn((label: string) => `step-${label}`),
        onStepComplete: vi.fn(),
        onStepError: vi.fn(),
      },
    })

    const chatCalls = vi.mocked(window.api.chat).mock.calls.map(([params]) => params)
    expect(chatCalls[0].messages[0].content).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'image',
        imageBase64: 'image-base64',
        imageMimeType: 'image/png',
      }),
      expect.objectContaining({ type: 'text', text: 'Research this image' }),
    ]))
    expect(chatCalls[1].messages[0].content).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'image',
        imageBase64: 'image-base64',
        imageMimeType: 'image/png',
      }),
    ]))
    expect(chatCalls[chatCalls.length - 1].messages[0].content).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'image',
        imageBase64: 'image-base64',
        imageMimeType: 'image/png',
      }),
    ]))
    expect(webSearchMock).toHaveBeenCalledWith(expect.objectContaining({
      query: expect.stringContaining('Acme X100 gadget'),
    }))
  })

  it('keeps accumulated research context out of cross-reference system prompts', async () => {
    const longFinding = 'Detailed finding. '.repeat(2500).trim()
    const replies = [
      JSON.stringify({ aspects: ['Aspect A', 'Aspect B'] }),
      longFinding,
      longFinding,
      JSON.stringify({ isComplete: true, gaps: [], queries: [] }),
      'Cross-reference complete',
      'Final synthesis',
    ]
    vi.mocked(window.api.chat).mockImplementation(async () => ({
      success: true,
      reply: replies.shift() ?? 'Fallback reply',
    }))

    await deepResearchService.run({
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      question: 'Research a large topic',
      callbacks: {
        onStepStart: vi.fn((label: string) => `step-${label}`),
        onStepComplete: vi.fn(),
        onStepError: vi.fn(),
      },
    })

    const chatCalls = vi.mocked(window.api.chat).mock.calls.map(([params]) => params)
    const gapCall = chatCalls[3]
    const crossReferenceCall = chatCalls[4]

    expect(gapCall.systemPrompt?.length).toBeLessThan(20_000)
    expect(crossReferenceCall.systemPrompt?.length).toBeLessThan(20_000)
    expect(gapCall.systemPrompt).not.toContain(longFinding)
    expect(crossReferenceCall.systemPrompt).not.toContain(longFinding)
    expect(gapCall.messages[0].content.find((item) => item.type === 'text')?.text).toContain(longFinding)
    expect(crossReferenceCall.messages[0].content.find((item) => item.type === 'text')?.text).toContain(longFinding)
    expect(gapCall.bypassLengthCheck).toBe(true)
    expect(crossReferenceCall.bypassLengthCheck).toBe(true)
  })
})
