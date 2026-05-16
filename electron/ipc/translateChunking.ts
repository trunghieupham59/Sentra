import {
  TRANSLATE_CHUNK_CHAR_LIMIT,
  TRANSLATE_CHUNK_CONCURRENCY,
  TRANSLATE_CHUNK_TIMEOUT_MS,
  TRANSLATE_CONTEXT_TAIL_CHARS,
} from './ipcConstants'
import { withRetry } from './retry'

export const CHUNK_CHAR_LIMIT = TRANSLATE_CHUNK_CHAR_LIMIT

const CONTEXT_TAIL_CHARS = TRANSLATE_CONTEXT_TAIL_CHARS
const CHUNK_TIMEOUT_MS = TRANSLATE_CHUNK_TIMEOUT_MS
const CHUNK_CONCURRENCY = TRANSLATE_CHUNK_CONCURRENCY

export function splitIntoChunks(text: string, maxChars = CHUNK_CHAR_LIMIT): string[] {
  if (text.length <= maxChars) return [text]

  const chunks: string[] = []
  let pos = 0

  while (pos < text.length) {
    const remaining = text.length - pos
    if (remaining <= maxChars) {
      chunks.push(text.slice(pos))
      break
    }

    const window = text.slice(pos, pos + maxChars)
    let splitAt = maxChars

    const para = window.lastIndexOf('\n\n')
    if (para > maxChars * 0.35) {
      splitAt = para + 2
    } else {
      const line = window.lastIndexOf('\n')
      if (line > maxChars * 0.35) {
        splitAt = line + 1
      } else {
        const ends = ['. ', '! ', '? ', '。', '！', '？', '…']
        let best = -1
        for (const e of ends) {
          const idx = window.lastIndexOf(e)
          if (idx > best && idx > maxChars * 0.35) best = idx
        }
        if (best > 0) splitAt = best + 2
      }
    }

    chunks.push(text.slice(pos, pos + splitAt).trimEnd())
    pos += splitAt
  }

  return chunks.filter(c => c.trim().length > 0)
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Chunk translation timed out after ${ms / 1000}s (${label})`)),
      ms,
    )
    promise.then(
      (val) => { clearTimeout(timer); resolve(val) },
      (err) => { clearTimeout(timer); reject(err) },
    )
  })
}

export async function promisePool<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let next = 0

  async function worker(): Promise<void> {
    while (next < tasks.length) {
      const i = next++
      results[i] = await tasks[i]()
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker(),
  )
  await Promise.all(workers)
  return results
}

export async function translateChunked(
  translateFn: (text: string) => Promise<string>,
  sourceText: string,
  chunkLimit = CHUNK_CHAR_LIMIT,
): Promise<string> {
  const chunks = splitIntoChunks(sourceText, chunkLimit)
  if (chunks.length === 1) {
    // Wrap with retry so transient network errors don't fail the whole single-chunk translation.
    return withRetry(() => withTimeout(translateFn(sourceText), CHUNK_TIMEOUT_MS, 'single chunk'))
  }

  const tasks: Array<() => Promise<string>> = chunks.map((chunk, idx) => () => {
    let text: string
    if (idx === 0) {
      text =
        `[NOTE: This is part 1 of ${chunks.length} of a larger document. ` +
        `Translate only this part; more will follow. Maintain consistent terminology and style.]\n\n` +
        chunk
    } else {
      const prevTail = chunks[idx - 1].slice(-CONTEXT_TAIL_CHARS).trim()
      text =
        `[NOTE: This is part ${idx + 1} of ${chunks.length} of a larger document. ` +
        `The immediately preceding source text (already translated separately) was:\n` +
        `"${prevTail}"\n` +
        `Translate ONLY the text below this note. Use consistent terminology and style ` +
        `with the rest of the document. Output only the translation — no notes or prefix.]\n\n` +
        chunk
    }
    // Per-chunk retry: a transient network blip on one chunk no longer kills the whole document.
    return withRetry(() => withTimeout(translateFn(text), CHUNK_TIMEOUT_MS, `chunk ${idx + 1}/${chunks.length}`))
  })

  const results = await promisePool(tasks, CHUNK_CONCURRENCY)
  return results.join('\n')
}
