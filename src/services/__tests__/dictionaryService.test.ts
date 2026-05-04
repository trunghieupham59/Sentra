import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chatService } from '../chatService'
import {
  dictionaryService,
  MAX_DICTIONARY_CONTEXT_CHARS,
  MAX_DICTIONARY_TERM_CHARS,
  normalizeDictionaryTerm,
  parseDictionaryResponse,
} from '../dictionaryService'

vi.mock('../chatService', () => ({
  chatService: {
    send: vi.fn(),
  },
}))

const lookupParams = {
  term: '  工夫  ',
  context: 'Product work',
  sourceLang: 'ja',
  targetLang: 'vi',
  provider: 'local' as const,
  model: 'local-auto',
}

describe('dictionaryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('normalizes terms for dedupe', () => {
    expect(normalizeDictionaryTerm('  Hello   WORLD  ')).toBe('hello world')
  })

  it('parses valid dictionary JSON', () => {
    const result = parseDictionaryResponse(JSON.stringify({
      headword: '工夫',
      pronunciation: 'くふう',
      partOfSpeech: ['noun'],
      meaning: 'Sự cải tiến thực dụng.',
      translations: [
        {
          text: 'cải tiến',
          pronunciation: 'cải tiến',
          partOfSpeech: 'noun',
          meaning: 'Cách làm tốt hơn.',
          usage: 'Dùng khi nói về việc cải thiện cách làm hoặc giải pháp thực tế.',
          nuance: 'Nhấn vào cải thiện thực tế.',
          examples: ['工夫する -> cải tiến cách làm'],
          collocations: ['cải tiến quy trình'],
          notes: ['Trang trọng vừa phải.'],
        },
        {
          text: 'sáng tạo trong công việc',
          pronunciation: 'sáng tạo trong công việc',
          partOfSpeech: 'noun',
          meaning: 'Giải pháp có tính sáng tạo.',
          usage: 'Dùng khi nhấn mạnh tư duy tìm cách làm mới.',
          nuance: 'Dùng khi nhấn mạnh ý tưởng mới.',
          examples: ['工夫が必要です -> cần sáng tạo trong công việc'],
          collocations: ['sáng tạo trong vận hành'],
          notes: ['Tự nhiên trong môi trường công việc.'],
        },
      ],
      examples: ['工夫する -> cải tiến cách làm'],
      notes: ['Hay dùng trong bối cảnh công việc.'],
    }))

    expect(result.success).toBe(true)
    expect(result.result?.headword).toBe('工夫')
    expect(result.result?.translations).toContainEqual(expect.objectContaining({
      text: 'cải tiến',
      pronunciation: 'cải tiến',
      nuance: 'Nhấn vào cải thiện thực tế.',
      usage: 'Dùng khi nói về việc cải thiện cách làm hoặc giải pháp thực tế.',
    }))
  })

  it('rejects malformed or incomplete provider replies', () => {
    expect(parseDictionaryResponse('not json')).toMatchObject({ success: false, errorCode: 'INVALID_RESPONSE' })
    expect(parseDictionaryResponse(JSON.stringify({ headword: 'x' }))).toMatchObject({
      success: false,
      errorCode: 'INVALID_RESPONSE',
    })
    expect(parseDictionaryResponse(JSON.stringify({
      headword: 'extension',
      pronunciation: '',
      partOfSpeech: ['noun'],
      meaning: '拡張。',
      translations: [{ text: '拡張', pronunciation: 'かくちょう' }],
      examples: [],
      notes: [],
    }))).toMatchObject({
      success: false,
      errorCode: 'INVALID_RESPONSE',
    })
    expect(parseDictionaryResponse(JSON.stringify({
      headword: 'extension',
      pronunciation: 'ɪkˈstenʃən',
      partOfSpeech: ['noun'],
      meaning: '拡張。',
      translations: [{ text: '拡張', pronunciation: '' }],
      examples: [],
      notes: [],
    }))).toMatchObject({
      success: false,
      errorCode: 'INVALID_RESPONSE',
    })
    expect(parseDictionaryResponse(JSON.stringify({
      headword: 'extension',
      pronunciation: 'ɪkˈstenʃən',
      partOfSpeech: ['noun'],
      meaning: '拡張。',
      translations: ['拡張'],
      examples: [],
      notes: [],
    }))).toMatchObject({
      success: false,
      errorCode: 'INVALID_RESPONSE',
    })
  })

  it('validates term and context limits before calling chat', async () => {
    await expect(dictionaryService.lookup({ ...lookupParams, term: ' '.repeat(3) })).resolves.toMatchObject({
      success: false,
      errorCode: 'INVALID_INPUT',
    })
    await expect(dictionaryService.lookup({ ...lookupParams, term: 'x'.repeat(MAX_DICTIONARY_TERM_CHARS + 1) })).resolves.toMatchObject({
      success: false,
      errorCode: 'INVALID_INPUT',
    })
    await expect(dictionaryService.lookup({ ...lookupParams, context: 'x'.repeat(MAX_DICTIONARY_CONTEXT_CHARS + 1) })).resolves.toMatchObject({
      success: false,
      errorCode: 'INVALID_INPUT',
    })

    expect(chatService.send).not.toHaveBeenCalled()
  })

  it('builds a chat request with the selected provider and model', async () => {
    vi.mocked(chatService.send).mockResolvedValueOnce({
      success: true,
      reply: JSON.stringify({
        headword: '工夫',
        pronunciation: 'くふう',
        partOfSpeech: ['noun'],
        meaning: 'Cải tiến cách làm.',
        translations: [{
          text: 'cải tiến',
          pronunciation: 'cải tiến',
          partOfSpeech: 'noun',
          meaning: 'Cách làm tốt hơn.',
          usage: 'Dùng khi nói về việc cải thiện cách làm hoặc giải pháp thực tế.',
          nuance: 'Nhấn vào cải thiện thực tế.',
          examples: ['工夫する -> cải tiến cách làm'],
          collocations: ['cải tiến quy trình'],
          notes: ['Trang trọng vừa phải.'],
        }],
        examples: ['工夫する -> cải tiến'],
        notes: ['Practical nuance.'],
      }),
    })

    const result = await dictionaryService.lookup(lookupParams)

    expect(result.success).toBe(true)
    expect(chatService.send).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'local',
      model: 'local-auto',
      maxOutputTokens: 1800,
      systemPrompt: expect.stringContaining('pronunciation field is mandatory'),
      messages: [
        expect.objectContaining({
          role: 'user',
          content: [expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('"nuance": "when to choose this translation instead of the others"'),
          })],
        }),
      ],
    }))
  })

  it('builds a compact preview request for fast first paint', async () => {
    vi.mocked(chatService.send).mockResolvedValueOnce({
      success: true,
      reply: JSON.stringify({
        headword: '工夫',
        pronunciation: 'くふう',
        partOfSpeech: ['noun'],
        meaning: 'Cải tiến cách làm.',
        translations: [{ text: 'cải tiến', pronunciation: 'cải tiến' }],
        examples: ['工夫する -> cải tiến'],
        notes: [],
      }),
    })

    const result = await dictionaryService.lookupPreview(lookupParams)

    expect(result.success).toBe(true)
    expect(chatService.send).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'local',
      model: 'local-auto',
      maxOutputTokens: 650,
      systemPrompt: expect.stringContaining('fast multilingual dictionary'),
      messages: [
        expect.objectContaining({
          role: 'user',
          content: [expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('compact JSON shape'),
          })],
        }),
      ],
    }))
  })

  it('builds a detail enrichment request from an existing preview', async () => {
    const preview = {
      headword: '工夫',
      pronunciation: 'くふう',
      partOfSpeech: ['noun'],
      meaning: 'Cải tiến cách làm.',
      translations: [{ text: 'cải tiến', pronunciation: 'cải tiến' }],
      examples: ['工夫する -> cải tiến'],
      notes: [],
    }
    vi.mocked(chatService.send).mockResolvedValueOnce({
      success: true,
      reply: JSON.stringify({
        ...preview,
        translations: [{
          text: 'cải tiến',
          pronunciation: 'cải tiến',
          partOfSpeech: 'noun',
          meaning: 'Cách làm tốt hơn.',
          usage: 'Dùng khi nói về cải thiện cách làm.',
          nuance: 'Nhấn mạnh giải pháp thực tế.',
          examples: ['工夫する -> cải tiến cách làm'],
          collocations: ['cải tiến quy trình'],
          notes: ['Tự nhiên trong công việc.'],
        }],
        notes: ['Hay dùng trong bối cảnh công việc.'],
      }),
    })

    const result = await dictionaryService.lookupDetails(lookupParams, preview)

    expect(result.success).toBe(true)
    expect(chatService.send).toHaveBeenCalledWith(expect.objectContaining({
      maxOutputTokens: 1600,
      systemPrompt: expect.stringContaining('precise multilingual dictionary'),
      messages: [
        expect.objectContaining({
          content: [expect.objectContaining({
            text: expect.stringContaining('Current preview:'),
          })],
        }),
      ],
    }))
  })
})
