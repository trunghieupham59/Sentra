import type {
  DictionaryLookupParams,
  DictionaryLookupResult,
  DictionaryResult,
  DictionaryTranslation,
} from '../types'
import { chatService } from './chatService'

export const MAX_DICTIONARY_TERM_CHARS = 120
export const MAX_DICTIONARY_CONTEXT_CHARS = 500

const DICTIONARY_SYSTEM_PROMPT = `You are a precise multilingual dictionary for Viezan.
Return ONLY valid JSON. No markdown fences, no comments, no extra text.
Keep every field concise and useful for translators, BrSEs, PMs, developers, and language learners.
If the input language is "auto", infer it from the term and context.
Use the requested target language for meaning, translations, notes, and example explanations.
The pronunciation field is mandatory and must never be empty. Provide the reading for the headword/source term:
- Japanese: kana reading.
- Chinese: pinyin with tone marks.
- Korean: Revised Romanization.
- Latin-script languages: IPA between slashes, e.g. /ɪkˈstenʃən/.
- Vietnamese: a natural Vietnamese reading or IPA-style pronunciation when useful.
Each translation item must include both the translated text and its pronunciation/reading. A dictionary user may know neither the meaning nor how to read the translated word.
Each translation item must include practical detail fields for a pop-up: partOfSpeech, meaning, usage, nuance, examples, collocations, and notes.
For each translation item, explain how to use that translated word in real contexts, not only a one-line synonym.`

const DICTIONARY_PREVIEW_SYSTEM_PROMPT = `You are a fast multilingual dictionary for Viezan.
Return ONLY valid JSON. No markdown fences, no comments, no extra text.
Optimize for the first useful result: headword, pronunciation, short meaning, and 2-3 translations.
The pronunciation field is mandatory and must never be empty.
Each translation item must include text and pronunciation. Keep optional detail fields brief or omit them.`

const ARRAY_FIELD_LIMIT = 6
const STRING_FIELD_LIMIT = 700

export function normalizeDictionaryTerm(term: string): string {
  return term.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function cleanString(value: unknown, maxLength = STRING_FIELD_LIMIT): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => cleanString(item, 220))
    .filter(Boolean)
    .slice(0, ARRAY_FIELD_LIMIT)
}

function cleanTranslationArray(value: unknown): DictionaryTranslation[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item): DictionaryTranslation | null => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const text = cleanString(record.text, 220)
      const pronunciation = cleanString(record.pronunciation, 220)
      if (!text || !pronunciation) return null
      return {
        text,
        pronunciation,
        partOfSpeech: cleanString(record.partOfSpeech, 80) || undefined,
        meaning: cleanString(record.meaning, 420) || undefined,
        usage: cleanString(record.usage, 420) || undefined,
        nuance: cleanString(record.nuance, 360) || undefined,
        example: cleanString(record.example, 260) || undefined,
        examples: cleanStringArray(record.examples),
        collocations: cleanStringArray(record.collocations),
        notes: cleanStringArray(record.notes),
      }
    })
    .filter((item): item is DictionaryTranslation => item !== null)
    .slice(0, ARRAY_FIELD_LIMIT)
}

function extractJsonObject(reply: string): unknown {
  const trimmed = reply.trim()
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = fenceMatch?.[1] ?? trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('No JSON object found')
  return JSON.parse(candidate.slice(start, end + 1))
}

export function parseDictionaryResponse(reply: string): DictionaryLookupResult {
  let raw: unknown
  try {
    raw = extractJsonObject(reply)
  } catch {
    return { success: false, error: 'Invalid dictionary response', errorCode: 'INVALID_RESPONSE' }
  }

  if (!raw || typeof raw !== 'object') {
    return { success: false, error: 'Invalid dictionary response', errorCode: 'INVALID_RESPONSE' }
  }

  const record = raw as Record<string, unknown>
  const result: DictionaryResult = {
    headword: cleanString(record.headword, 160),
    pronunciation: cleanString(record.pronunciation, 160),
    partOfSpeech: cleanStringArray(record.partOfSpeech),
    meaning: cleanString(record.meaning),
    translations: cleanTranslationArray(record.translations),
    examples: cleanStringArray(record.examples),
    notes: cleanStringArray(record.notes),
  }

  if (!result.headword || !result.pronunciation || !result.meaning || result.translations.length === 0) {
    return { success: false, error: 'Incomplete dictionary response', errorCode: 'INVALID_RESPONSE' }
  }

  return { success: true, result }
}

function buildDictionaryPrompt(params: DictionaryLookupParams): string {
  const contextLine = params.context?.trim()
    ? `Context: ${params.context.trim()}`
    : 'Context:'

  return `Create a dictionary entry.

Term: ${params.term.trim()}
Source language: ${params.sourceLang}
Target language: ${params.targetLang}
${contextLine}

Return exactly this JSON shape:
{
  "headword": "canonical term",
  "pronunciation": "required non-empty reading for the headword/source term",
  "partOfSpeech": ["noun"],
  "meaning": "short definition in the target language",
  "translations": [
    {
      "text": "best translation 1",
      "pronunciation": "required reading for translation 1",
      "partOfSpeech": "noun",
      "meaning": "detailed meaning of this translated word in the target language, 1-2 sentences",
      "usage": "how to use this word naturally, including common grammar or context",
      "nuance": "when to choose this translation instead of the others",
      "examples": ["natural example using this translation -> explanation"],
      "collocations": ["common phrase or collocation"],
      "notes": ["register, domain, or caution"]
    },
    {
      "text": "best translation 2",
      "pronunciation": "required reading for translation 2",
      "partOfSpeech": "verb",
      "meaning": "detailed meaning of this translated word in the target language, 1-2 sentences",
      "usage": "how to use this word naturally, including common grammar or context",
      "nuance": "usage, register, domain, or contrast",
      "examples": ["natural example using this translation -> explanation"],
      "collocations": ["common phrase or collocation"],
      "notes": ["register, domain, or caution"]
    }
  ],
  "examples": ["source example -> target example"],
  "notes": ["usage, nuance, register, or domain note"]
}`
}

function buildDictionaryPreviewPrompt(params: DictionaryLookupParams): string {
  const contextLine = params.context?.trim()
    ? `Context: ${params.context.trim()}`
    : 'Context:'

  return `Create the fastest useful dictionary preview.

Term: ${params.term.trim()}
Source language: ${params.sourceLang}
Target language: ${params.targetLang}
${contextLine}

Return exactly this compact JSON shape:
{
  "headword": "canonical term",
  "pronunciation": "required non-empty reading for the headword/source term",
  "partOfSpeech": ["noun"],
  "meaning": "one short definition in the target language",
  "translations": [
    { "text": "best translation 1", "pronunciation": "required reading for translation 1" },
    { "text": "best translation 2", "pronunciation": "required reading for translation 2" }
  ],
  "examples": ["one short source example -> target example"],
  "notes": ["one short usage note when helpful"]
}`
}

function buildDictionaryDetailsPrompt(params: DictionaryLookupParams, preview: DictionaryResult): string {
  const contextLine = params.context?.trim()
    ? `Context: ${params.context.trim()}`
    : 'Context:'

  return `Expand this dictionary preview into a complete entry.

Term: ${params.term.trim()}
Source language: ${params.sourceLang}
Target language: ${params.targetLang}
${contextLine}

Current preview:
${JSON.stringify(preview)}

Return exactly this JSON shape. Preserve the same headword and core meaning unless they are clearly wrong:
{
  "headword": "canonical term",
  "pronunciation": "required non-empty reading for the headword/source term",
  "partOfSpeech": ["noun"],
  "meaning": "short definition in the target language",
  "translations": [
    {
      "text": "best translation 1",
      "pronunciation": "required reading for translation 1",
      "partOfSpeech": "noun",
      "meaning": "detailed meaning of this translated word in the target language, 1-2 sentences",
      "usage": "how to use this word naturally, including common grammar or context",
      "nuance": "when to choose this translation instead of the others",
      "examples": ["natural example using this translation -> explanation"],
      "collocations": ["common phrase or collocation"],
      "notes": ["register, domain, or caution"]
    },
    {
      "text": "best translation 2",
      "pronunciation": "required reading for translation 2",
      "partOfSpeech": "verb",
      "meaning": "detailed meaning of this translated word in the target language, 1-2 sentences",
      "usage": "how to use this word naturally, including common grammar or context",
      "nuance": "usage, register, domain, or contrast",
      "examples": ["natural example using this translation -> explanation"],
      "collocations": ["common phrase or collocation"],
      "notes": ["register, domain, or caution"]
    }
  ],
  "examples": ["source example -> target example"],
  "notes": ["usage, nuance, register, or domain note"]
}`
}

function validateDictionaryLookupParams(params: DictionaryLookupParams): DictionaryLookupResult | null {
  const term = params.term.trim()
  const context = params.context?.trim() ?? ''

  if (!term) return { success: false, error: 'Term is required', errorCode: 'INVALID_INPUT' }
  if (term.length > MAX_DICTIONARY_TERM_CHARS) {
    return { success: false, error: 'Term is too long', errorCode: 'INVALID_INPUT' }
  }
  if (context.length > MAX_DICTIONARY_CONTEXT_CHARS) {
    return { success: false, error: 'Context is too long', errorCode: 'INVALID_INPUT' }
  }

  return null
}

async function sendDictionaryRequest({
  params,
  systemPrompt,
  userPrompt,
  maxOutputTokens,
}: {
  params: DictionaryLookupParams
  systemPrompt: string
  userPrompt: string
  maxOutputTokens: number
}): Promise<DictionaryLookupResult> {
  const invalid = validateDictionaryLookupParams(params)
  if (invalid) return invalid

  const response = await chatService.send({
    provider: params.provider,
    model: params.model,
    systemPrompt,
    maxOutputTokens,
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: userPrompt }],
      },
    ],
  })

  if (!response.success || !response.reply) {
    return {
      success: false,
      error: response.error ?? 'Dictionary lookup failed',
      errorCode: response.errorCode,
    }
  }

  return parseDictionaryResponse(response.reply)
}

export const dictionaryService = {
  async lookup(params: DictionaryLookupParams): Promise<DictionaryLookupResult> {
    const term = params.term.trim()
    const context = params.context?.trim() ?? ''

    return sendDictionaryRequest({
      params: { ...params, term, context },
      systemPrompt: DICTIONARY_SYSTEM_PROMPT,
      userPrompt: buildDictionaryPrompt({ ...params, term, context }),
      maxOutputTokens: 1800,
    })
  },

  async lookupPreview(params: DictionaryLookupParams): Promise<DictionaryLookupResult> {
    const term = params.term.trim()
    const context = params.context?.trim() ?? ''

    return sendDictionaryRequest({
      params: { ...params, term, context },
      systemPrompt: DICTIONARY_PREVIEW_SYSTEM_PROMPT,
      userPrompt: buildDictionaryPreviewPrompt({ ...params, term, context }),
      maxOutputTokens: 650,
    })
  },

  async lookupDetails(
    params: DictionaryLookupParams,
    preview: DictionaryResult,
  ): Promise<DictionaryLookupResult> {
    const term = params.term.trim()
    const context = params.context?.trim() ?? ''

    return sendDictionaryRequest({
      params: { ...params, term, context },
      systemPrompt: DICTIONARY_SYSTEM_PROMPT,
      userPrompt: buildDictionaryDetailsPrompt({ ...params, term, context }, preview),
      maxOutputTokens: 1600,
    })
  },
}
