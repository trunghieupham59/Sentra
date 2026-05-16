import { extractCompleteSentences, splitSentences } from '../../utils/live-translate'

export interface TranscriptAssemblyState {
  pendingBuffer: string
  pendingChunkCount: number
}

export interface TranscriptAssemblyResult extends TranscriptAssemblyState {
  pendingText: string
  completedSentences: string[]
}

export function appendRawTranscript(previous: string, nextText: string, maxChars: number): string {
  const updated = previous ? `${previous} ${nextText}` : nextText
  if (updated.length <= maxChars) return updated
  // Hard-truncate to the last `maxChars`, then advance to the next whitespace
  // so we never resume mid-word. Falls back to the hard cut if no whitespace
  // exists in the truncated window (rare — e.g. one continuous CJK run).
  const sliced = updated.slice(-maxChars)
  const firstSpace = sliced.search(/\s/)
  return firstSpace >= 0 ? sliced.slice(firstSpace + 1) : sliced
}

export function getWhisperParts(newText: string, segmentTexts?: string[]): string[] {
  if ((segmentTexts?.length ?? 0) > 1) {
    const parts = (segmentTexts ?? []).map(s => s.trim()).filter(Boolean)
    if (parts.length > 0) return parts
  }
  return [newText]
}

export function assembleCompletedSentences(
  parts: string[],
  state: TranscriptAssemblyState,
  maxPendingChunks: number,
): TranscriptAssemblyResult {
  let pendingBuffer = state.pendingBuffer
  let pendingText = pendingBuffer
  let pendingChunkCount = state.pendingChunkCount
  const completedSentences: string[] = []

  for (const part of parts) {
    const newBuffer = pendingBuffer ? `${pendingBuffer} ${part}` : part
    pendingText = newBuffer

    const { complete, pending } = extractCompleteSentences(newBuffer)
    if (!complete) {
      pendingBuffer = newBuffer
      continue
    }

    pendingBuffer = pending
    pendingText = pending
    completedSentences.push(...splitSentences(complete))
  }

  if (completedSentences.length === 0) {
    pendingChunkCount += 1
    if (pendingChunkCount >= maxPendingChunks && pendingBuffer) {
      completedSentences.push(...splitSentences(pendingBuffer))
      pendingBuffer = ''
      pendingText = ''
      pendingChunkCount = 0
    }
  } else {
    pendingChunkCount = 0
  }

  return { completedSentences, pendingBuffer, pendingText, pendingChunkCount }
}
