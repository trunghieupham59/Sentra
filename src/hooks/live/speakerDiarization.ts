export interface SpeakerDiarizationPolicy {
  minSilenceForSpeakerChange: number
  minSpeakerDurationMs: number
  longSilenceChunks: number
  maxSpeakers: number
  turnHistorySize: number
}

export interface SpeakerDiarizationState {
  currentSpeaker: string
  speakerCount: number
  lastSpeakerChangeTime: number
  turnHistory: string[]
}

export const DEFAULT_SPEAKER_DIARIZATION_POLICY: SpeakerDiarizationPolicy = {
  minSilenceForSpeakerChange: 2,
  minSpeakerDurationMs: 2_500,
  longSilenceChunks: 4,
  maxSpeakers: 6,
  turnHistorySize: 10,
}

export const INITIAL_SPEAKER_DIARIZATION_STATE: SpeakerDiarizationState = {
  currentSpeaker: 'Speaker 1',
  speakerCount: 1,
  lastSpeakerChangeTime: 0,
  turnHistory: [],
}

export function resolveSpeakerForCompletedChunk(
  state: SpeakerDiarizationState,
  silenceBefore: number,
  now: number,
  policy: SpeakerDiarizationPolicy = DEFAULT_SPEAKER_DIARIZATION_POLICY,
): SpeakerDiarizationState {
  const prevSpeaker = state.currentSpeaker
  let currentSpeaker = prevSpeaker
  let speakerCount = state.speakerCount
  let lastSpeakerChangeTime = state.lastSpeakerChangeTime
  const history = state.turnHistory

  if (
    silenceBefore >= policy.minSilenceForSpeakerChange &&
    now - state.lastSpeakerChangeTime > policy.minSpeakerDurationMs
  ) {
    if (speakerCount === 1) {
      speakerCount = 2
      currentSpeaker = 'Speaker 2'
    } else if (speakerCount === 2) {
      if (silenceBefore >= policy.longSilenceChunks && history.length >= 4) {
        speakerCount = 3
        currentSpeaker = 'Speaker 3'
      } else {
        currentSpeaker = prevSpeaker === 'Speaker 1' ? 'Speaker 2' : 'Speaker 1'
      }
    } else if (speakerCount < policy.maxSpeakers) {
      const recentOthers = [...history].reverse().filter(s => s !== prevSpeaker)
      const mostRecentOther = recentOthers[0]
      if (silenceBefore >= policy.longSilenceChunks) {
        speakerCount += 1
        currentSpeaker = `Speaker ${speakerCount}`
      } else if (mostRecentOther) {
        currentSpeaker = mostRecentOther
      } else {
        speakerCount += 1
        currentSpeaker = `Speaker ${speakerCount}`
      }
    } else {
      const seen = new Set<string>()
      const lruOrder: string[] = []
      for (const speaker of [...history].reverse()) {
        if (!seen.has(speaker)) {
          seen.add(speaker)
          lruOrder.push(speaker)
        }
      }
      const allLabels = Array.from({ length: policy.maxSpeakers }, (_, i) => `Speaker ${i + 1}`)
      currentSpeaker = allLabels.find(s => !seen.has(s)) ?? lruOrder[lruOrder.length - 1] ?? 'Speaker 1'
    }

    if (currentSpeaker !== prevSpeaker) {
      lastSpeakerChangeTime = now
    }
  }

  return {
    currentSpeaker,
    speakerCount,
    lastSpeakerChangeTime,
    turnHistory: [...history, currentSpeaker].slice(-policy.turnHistorySize),
  }
}
