import { useEffect, useState } from 'react'

/**
 * useTypewriter — reveals text word-by-word when text first becomes non-empty.
 *
 * Dependency on [text] means:
 *   - On mount with text='': skips (empty), returns ''
 *   - When text changes from '' → actual translation: starts animation
 *   - For SegmentRow where text is non-empty on mount: runs immediately
 *
 * @param text    - The full text to reveal
 * @param msPerWord - Milliseconds between each word appearing (default: 45)
 */
export function useTypewriter(text: string, msPerWord = 45) {
  const [displayed, setDisplayed] = useState('')
  // biome-ignore lint/correctness/useExhaustiveDependencies: msPerWord is a constant at call-site and intentionally excluded
  useEffect(() => {
    if (!text) { setDisplayed(''); return }
    const words = text.split(' ')
    let i = 0
    setDisplayed(words[0] ?? '')
    if (words.length <= 1) { setDisplayed(text); return }
    const timer = setInterval(() => {
      i++
      if (i < words.length) {
        setDisplayed(words.slice(0, i + 1).join(' '))
      } else {
        setDisplayed(text)
        clearInterval(timer)
      }
    }, msPerWord)
    return () => clearInterval(timer)
  }, [text]) // re-run when text changes (e.g. '' → actual translation)
  return displayed
}
