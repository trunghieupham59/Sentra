import { describe, expect, it } from 'vitest'

import { appendRawTranscript, assembleCompletedSentences, getWhisperParts } from '../transcriptAssembly'

describe('appendRawTranscript', () => {
  it('appends with a space and keeps only the trailing max characters', () => {
    expect(appendRawTranscript('hello', 'world', 20)).toBe('hello world')
    expect(appendRawTranscript('12345', '67890', 7)).toBe('5 67890')
  })
})

describe('getWhisperParts', () => {
  it('uses trimmed verbose segments when Whisper returns multiple parts', () => {
    expect(getWhisperParts('fallback', [' Hello. ', '', ' World. '])).toEqual(['Hello.', 'World.'])
  })

  it('falls back to the raw chunk text for missing or single segments', () => {
    expect(getWhisperParts('raw text')).toEqual(['raw text'])
    expect(getWhisperParts('raw text', ['Only one segment'])).toEqual(['raw text'])
  })
})

describe('assembleCompletedSentences', () => {
  it('extracts complete sentences and keeps the pending tail', () => {
    const result = assembleCompletedSentences(
      ['Hello world. This is pending'],
      { pendingBuffer: '', pendingChunkCount: 0 },
      2,
    )

    expect(result.completedSentences).toEqual(['Hello world.'])
    expect(result.pendingBuffer).toBe('This is pending')
    expect(result.pendingText).toBe('This is pending')
    expect(result.pendingChunkCount).toBe(0)
  })

  it('accumulates pending chunks until the force-flush threshold', () => {
    const pending = assembleCompletedSentences(
      ['partial one'],
      { pendingBuffer: '', pendingChunkCount: 0 },
      2,
    )
    expect(pending.completedSentences).toEqual([])
    expect(pending.pendingBuffer).toBe('partial one')
    expect(pending.pendingChunkCount).toBe(1)

    const flushed = assembleCompletedSentences(
      ['partial two'],
      { pendingBuffer: pending.pendingBuffer, pendingChunkCount: pending.pendingChunkCount },
      2,
    )
    expect(flushed.completedSentences).toEqual(['partial one partial two'])
    expect(flushed.pendingBuffer).toBe('')
    expect(flushed.pendingChunkCount).toBe(0)
  })
})
