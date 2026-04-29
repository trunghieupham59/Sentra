import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SPEAKER_DIARIZATION_POLICY,
  INITIAL_SPEAKER_DIARIZATION_STATE,
  resolveSpeakerForCompletedChunk,
} from '../speakerDiarization'

describe('resolveSpeakerForCompletedChunk', () => {
  it('keeps the same speaker when the silence gap is too short', () => {
    const result = resolveSpeakerForCompletedChunk(
      INITIAL_SPEAKER_DIARIZATION_STATE,
      DEFAULT_SPEAKER_DIARIZATION_POLICY.minSilenceForSpeakerChange - 1,
      10_000,
    )

    expect(result.currentSpeaker).toBe('Speaker 1')
    expect(result.speakerCount).toBe(1)
    expect(result.turnHistory).toEqual(['Speaker 1'])
  })

  it('introduces speaker 2 after the first qualifying silence gap', () => {
    const result = resolveSpeakerForCompletedChunk(
      INITIAL_SPEAKER_DIARIZATION_STATE,
      DEFAULT_SPEAKER_DIARIZATION_POLICY.minSilenceForSpeakerChange,
      10_000,
    )

    expect(result.currentSpeaker).toBe('Speaker 2')
    expect(result.speakerCount).toBe(2)
    expect(result.lastSpeakerChangeTime).toBe(10_000)
  })

  it('alternates between two speakers for normal turn-taking gaps', () => {
    const result = resolveSpeakerForCompletedChunk(
      {
        currentSpeaker: 'Speaker 2',
        speakerCount: 2,
        lastSpeakerChangeTime: 1_000,
        turnHistory: ['Speaker 1', 'Speaker 2'],
      },
      DEFAULT_SPEAKER_DIARIZATION_POLICY.minSilenceForSpeakerChange,
      10_000,
    )

    expect(result.currentSpeaker).toBe('Speaker 1')
    expect(result.speakerCount).toBe(2)
  })

  it('adds speaker 3 after a long silence with an established two-speaker pattern', () => {
    const result = resolveSpeakerForCompletedChunk(
      {
        currentSpeaker: 'Speaker 2',
        speakerCount: 2,
        lastSpeakerChangeTime: 1_000,
        turnHistory: ['Speaker 1', 'Speaker 2', 'Speaker 1', 'Speaker 2'],
      },
      DEFAULT_SPEAKER_DIARIZATION_POLICY.longSilenceChunks,
      10_000,
    )

    expect(result.currentSpeaker).toBe('Speaker 3')
    expect(result.speakerCount).toBe(3)
  })

  it('prefers the most recent other speaker for short gaps with three or more speakers', () => {
    const result = resolveSpeakerForCompletedChunk(
      {
        currentSpeaker: 'Speaker 3',
        speakerCount: 3,
        lastSpeakerChangeTime: 1_000,
        turnHistory: ['Speaker 1', 'Speaker 2', 'Speaker 3', 'Speaker 2'],
      },
      DEFAULT_SPEAKER_DIARIZATION_POLICY.minSilenceForSpeakerChange,
      10_000,
    )

    expect(result.currentSpeaker).toBe('Speaker 2')
    expect(result.speakerCount).toBe(3)
  })

  it('recycles least-recently-used labels after the speaker cap is reached', () => {
    const result = resolveSpeakerForCompletedChunk(
      {
        currentSpeaker: 'Speaker 6',
        speakerCount: 6,
        lastSpeakerChangeTime: 1_000,
        turnHistory: ['Speaker 2', 'Speaker 3', 'Speaker 4', 'Speaker 5', 'Speaker 6'],
      },
      DEFAULT_SPEAKER_DIARIZATION_POLICY.longSilenceChunks,
      10_000,
    )

    expect(result.currentSpeaker).toBe('Speaker 1')
    expect(result.speakerCount).toBe(6)
  })
})
