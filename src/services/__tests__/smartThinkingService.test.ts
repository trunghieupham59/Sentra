import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { smartThinkingService } from '../smartThinkingService'

describe('smartThinkingService', () => {
  const originalChatStream = window.api.chatStream
  const originalOnChatStreamEvent = window.api.onChatStreamEvent

  beforeEach(() => {
    vi.mocked(window.api.chat).mockReset()
    window.api.webSearch = vi.fn().mockResolvedValue({ success: false })
    ;(window.api as unknown as { chatStream?: typeof originalChatStream }).chatStream = undefined
    ;(window.api as unknown as {
      onChatStreamEvent?: typeof window.api.onChatStreamEvent
    }).onChatStreamEvent = undefined
  })

  afterEach(() => {
    window.api.chatStream = originalChatStream
    window.api.onChatStreamEvent = originalOnChatStreamEvent
  })

  it('keeps the original question as the search intent and only appends the planned query as context', async () => {
    const classifierReply = JSON.stringify({
      needs_web: true,
      query: 'current leadership roles example agency',
      reason: 'The question asks for current information.',
      answer_focus: 'Identify the current people who hold the requested roles.',
      source_guidance: 'Prefer official or primary sources for current public roles.',
    })
    vi.mocked(window.api.chat)
      .mockResolvedValueOnce({ success: true, reply: classifierReply })
      .mockResolvedValueOnce({ success: true, reply: 'Final answer' })

    const webSearchMock = vi.fn().mockResolvedValue({
      success: true,
      results: [
        {
          title: 'Summary of example agency roles',
          url: 'https://news.example.com/example-agency-roles',
          content: 'A secondary article lists role titles but not current holders.',
          score: 0.99,
        },
        {
          title: 'Example Agency Leadership',
          url: 'https://www.agency.gov/leadership',
          content: 'The official page lists current leaders by name and role.',
          score: 0.75,
        },
      ],
    })
    window.api.webSearch = webSearchMock

    const callbacks = {
      onStepStart: vi.fn(() => 'step-1'),
      onStepComplete: vi.fn(),
      onStepError: vi.fn(),
      onAnswerStart: vi.fn(() => 'answer-1'),
      onAnswerToken: vi.fn(),
      onAnswerComplete: vi.fn(),
      onAnswerError: vi.fn(),
    }

    await smartThinkingService.run({
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      question: 'Who currently holds the senior leadership roles at the example agency?',
      messages: [{
        role: 'user',
        content: [{
          type: 'text',
          text: 'Who currently holds the senior leadership roles at the example agency?',
        }],
      }],
      uiText: {
        webSearchStepLabelPrefix: 'Search',
        webSearchSummaryTitle: 'Summary',
        webSearchDefaultReason: 'Search is needed.',
        webSearchSourcesTitle: 'Sources',
        webSearchNoSources: 'No sources',
        webSearchNoResults: 'No matching web results.',
        webSearchErrorFallback: 'Search failed',
        noResponseError: 'No response',
        unknownError: 'Unknown error',
      },
      callbacks,
    })

    expect(webSearchMock).toHaveBeenCalledWith(expect.objectContaining({
      maxResults: 8,
      query: expect.stringContaining('Who currently holds the senior leadership roles at the example agency?'),
    }))
    expect(webSearchMock.mock.calls[0][0].query).toContain('current leadership roles example agency')
    expect(callbacks.onStepStart).toHaveBeenCalledWith(expect.stringContaining('Search Who currently holds'))
    expect(callbacks.onStepComplete).toHaveBeenCalledWith('step-1', expect.stringContaining('**Sources:**'))

    const finalCall = vi.mocked(window.api.chat).mock.calls[1][0]
    const finalPrompt = finalCall.systemPrompt ?? ''
    expect(finalPrompt).toContain('Answer focus from the routing step: Identify the current people')
    expect(finalPrompt).toContain('Evaluate source credibility')
    expect(finalPrompt).toContain('Answer the exact question')
    expect(callbacks.onAnswerComplete).toHaveBeenCalledWith(
      'answer-1',
      expect.stringContaining('Final answer'),
    )
    expect(callbacks.onAnswerComplete).toHaveBeenCalledWith(
      'answer-1',
      expect.stringContaining('agency.gov'),
    )
  })
})
