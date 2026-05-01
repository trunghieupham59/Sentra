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

  it('keeps overlapping planned web queries concise without dropping answer focus', async () => {
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
      query: 'current leadership roles example agency',
    }))
    expect(callbacks.onStepStart).toHaveBeenCalledWith('Search current leadership roles example agency')
    expect(callbacks.onStepComplete).toHaveBeenCalledWith('step-1', expect.stringContaining('**Sources:**'))

    const finalCall = vi.mocked(window.api.chat).mock.calls[1][0]
    const finalPrompt = finalCall.systemPrompt ?? ''
    expect(finalPrompt).toContain('Answer focus from the routing step: Identify the current people')
    expect(finalPrompt).toContain('Do not invent or complete facts')
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

  it('uses recent chat context for follow-up web queries and hides classifier reasoning', async () => {
    const classifierReply = JSON.stringify({
      needs_web: true,
      query: 'Tô Lâm Tổng Bí thư Việt Nam hiện nay',
      reason: 'The question is a direct check and I must inspect the prior turn under the strict rule.',
      answer_focus: 'Verify whether the prior claim about the current Vietnamese party leader is still current.',
      source_guidance: 'Prefer official Vietnamese government or party sources.',
    })
    vi.mocked(window.api.chat)
      .mockResolvedValueOnce({ success: true, reply: classifierReply })
      .mockResolvedValueOnce({ success: true, reply: 'Tin này vẫn đúng theo nguồn hiện tại [1].' })

    const webSearchMock = vi.fn().mockResolvedValue({
      success: true,
      results: [{
        title: 'Đồng chí Tô Lâm được bầu giữ chức Tổng Bí thư',
        url: 'https://dangcongsan.vn/to-lam-tong-bi-thu',
        content: 'Thông tin chính thức về Tổng Bí thư Tô Lâm.',
        score: 0.98,
      }],
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
      question: 'tin này đã đúng với thời điểm hiện tại chưa?',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'tổng bí thư đảng cộng sản Việt Nam là ai?' }],
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Tổng Bí thư hiện nay là ông Tô Lâm.' }],
        },
        {
          role: 'user',
          content: [{ type: 'text', text: 'tin này đã đúng với thời điểm hiện tại chưa?' }],
        },
      ],
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

    const classifierCall = vi.mocked(window.api.chat).mock.calls[0][0]
    const classifierText = classifierCall.messages[0].content[0].text ?? ''
    expect(classifierText).toContain('Tổng Bí thư hiện nay là ông Tô Lâm.')
    expect(classifierText).toContain('tin này đã đúng với thời điểm hiện tại chưa?')
    expect(classifierCall.bypassLengthCheck).toBe(true)

    expect(webSearchMock).toHaveBeenCalledWith(expect.objectContaining({
      query: 'Tô Lâm Tổng Bí thư Việt Nam hiện nay',
    }))
    expect(callbacks.onStepComplete).toHaveBeenCalledWith(
      'step-1',
      expect.not.stringContaining('strict rule'),
    )
    expect(callbacks.onStepComplete).toHaveBeenCalledWith(
      'step-1',
      expect.stringContaining('Search is needed.'),
    )
  })

  it('uses the classifier query as canonical search input and applies generic source grounding', async () => {
    const classifierReply = JSON.stringify({
      needs_web: true,
      query: 'example policy notice exact wording',
      reason: 'The user asks for source-backed wording.',
      answer_focus: 'Find the exact wording in retrieved source material.',
      source_guidance: 'Prefer primary source pages that contain the requested wording.',
    })
    vi.mocked(window.api.chat)
      .mockResolvedValueOnce({ success: true, reply: classifierReply })
      .mockResolvedValueOnce({ success: true, reply: 'The retrieved snippet confirms only part of the wording [1].' })

    const webSearchMock = vi.fn().mockResolvedValue({
      success: true,
      results: [{
        title: 'Example Policy Notice',
        url: 'https://docs.example.com/policy-notice',
        content: 'A source snippet with only partial notice wording.',
        score: 0.95,
      }],
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
      question: 'show the exact wording of the example policy notice',
      messages: [{
        role: 'user',
        content: [{ type: 'text', text: 'show the exact wording of the example policy notice' }],
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
      query: 'example policy notice exact wording',
    }))
    expect(callbacks.onStepStart).toHaveBeenCalledWith('Search example policy notice exact wording')

    const finalCall = vi.mocked(window.api.chat).mock.calls[1][0]
    const finalPrompt = finalCall.systemPrompt ?? ''
    expect(finalPrompt).toContain('requested answer depends on exact wording')
    expect(finalPrompt).toContain('If the retrieved results are snippets or incomplete')
    expect(finalPrompt).not.toContain('Verbatim-content guard')
  })

  it('applies the Smart Thinking contract even when web search is not needed', async () => {
    const classifierReply = JSON.stringify({
      needs_web: false,
      query: '',
      reason: 'The answer can be reasoned from the current conversation.',
      answer_focus: 'Provide a practical decision framework.',
      source_guidance: '',
    })
    vi.mocked(window.api.chat)
      .mockResolvedValueOnce({ success: true, reply: classifierReply })
      .mockResolvedValueOnce({ success: true, reply: 'Use the option with the best risk-adjusted payoff.' })

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
      question: 'How should I decide between these two implementation options?',
      messages: [{
        role: 'user',
        content: [{ type: 'text', text: 'How should I decide between these two implementation options?' }],
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

    expect(window.api.webSearch).not.toHaveBeenCalled()
    expect(callbacks.onStepStart).not.toHaveBeenCalled()

    const classifierCall = vi.mocked(window.api.chat).mock.calls[0][0]
    expect(classifierCall.systemPrompt).toContain('Identify the real problem')
    expect(classifierCall.systemPrompt).toContain('external, source-specific, or verifiable facts')

    const finalCall = vi.mocked(window.api.chat).mock.calls[1][0]
    const finalPrompt = finalCall.systemPrompt ?? ''
    expect(finalPrompt).toContain('You are Smart Thinking')
    expect(finalPrompt).toContain('Find the real problem')
    expect(finalPrompt).toContain('Trace root causes')
    expect(finalPrompt).toContain('Challenge weak assumptions')
    expect(finalPrompt).toContain('multiple perspectives')
    expect(finalPrompt).toContain("Occam's razor")
    expect(finalPrompt).toContain('feedback loops')
    expect(finalPrompt).toContain('Scale depth to the task')
  })
})
