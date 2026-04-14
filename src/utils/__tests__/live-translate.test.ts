import { describe, it, expect } from 'vitest'
import { isHallucination, jaccardSimilarity, extractCompleteSentences } from '../live-translate'

// ─── isHallucination ──────────────────────────────────────────────────────────
describe('isHallucination', () => {
  it('rejects text shorter than 4 chars', () => {
    expect(isHallucination('hi')).toBe(true)
    expect(isHallucination('ok')).toBe(true)
    expect(isHallucination('ab')).toBe(true)
    expect(isHallucination('   ')).toBe(true)
  })

  it('accepts text 4+ chars that is valid speech', () => {
    expect(isHallucination('Hello world')).toBe(false)
    expect(isHallucination('This is a test.')).toBe(false)
  })

  // ── English hallucination patterns ──
  it('rejects "thanks for watching" patterns', () => {
    expect(isHallucination('Thanks for watching!')).toBe(true)
    expect(isHallucination('thank you for watching this video')).toBe(true)
  })

  it('rejects subscribe/like CTAs', () => {
    expect(isHallucination('Please like and subscribe')).toBe(true)
    expect(isHallucination("Don't forget to subscribe")).toBe(true)
  })

  it('rejects bracketed sound effects', () => {
    expect(isHallucination('[Music]')).toBe(true)
    expect(isHallucination('[Applause]')).toBe(true)
    expect(isHallucination('[Silence]')).toBe(true)
    expect(isHallucination('(music)')).toBe(true)
  })

  it('rejects lone punctuation', () => {
    expect(isHallucination('...')).toBe(true)
    expect(isHallucination('—')).toBe(true)
  })

  // ── Japanese patterns ──
  it('rejects Japanese thank you / channel subscription phrases', () => {
    expect(isHallucination('ご視聴ありがとうございました')).toBe(true)
    expect(isHallucination('チャンネル登録をお願いします')).toBe(true)
    expect(isHallucination('ありがとうございます。')).toBe(true)
  })

  it('rejects Japanese sound effect brackets', () => {
    expect(isHallucination('（音楽）')).toBe(true)
    expect(isHallucination('[音楽]')).toBe(true)
    expect(isHallucination('（拍手）')).toBe(true)
  })

  // ── Korean patterns ──
  it('rejects Korean thank you / subscribe patterns', () => {
    expect(isHallucination('시청해 주셔서 감사합니다')).toBe(true)
    expect(isHallucination('구독 좋아요 눌러주세요')).toBe(true)
    expect(isHallucination('감사합니다.')).toBe(true)
  })

  // ── Vietnamese patterns ──
  it('rejects Vietnamese CTA phrases', () => {
    expect(isHallucination('Cảm ơn các bạn đã xem video')).toBe(true)
    expect(isHallucination('Đăng ký kênh nhé')).toBe(true)
    expect(isHallucination('like và đăng ký')).toBe(true)
  })

  it('rejects standalone Vietnamese fillers', () => {
    expect(isHallucination('vâng.')).toBe(true)
    expect(isHallucination('ừ,')).toBe(true)
  })

  // ── Character flooding ──
  it('rejects character flooding (≥4 reps covering >60%)', () => {
    expect(isHallucination('aaaaaaaaaaaaaaaaaaa')).toBe(true)
    expect(isHallucination('.......................')).toBe(true)
  })

  // ── N-gram repetition ──
  it('rejects bigram repetition (≥3 occurrences)', () => {
    expect(isHallucination('hello world hello world hello world extra')).toBe(true)
  })

  it('rejects trigram repetition (≥3 occurrences)', () => {
    expect(isHallucination('a b c a b c a b c d')).toBe(true)
  })

  it('accepts valid non-repetitive speech', () => {
    expect(isHallucination('Today we are going to discuss machine learning techniques.')).toBe(false)
    expect(isHallucination('Hôm nay chúng ta sẽ nói về học máy và trí tuệ nhân tạo.')).toBe(false)
    expect(isHallucination('今日は機械学習について詳しく説明します。')).toBe(false)
  })
})

// ─── jaccardSimilarity ────────────────────────────────────────────────────────
describe('jaccardSimilarity', () => {
  it('returns 1.0 for identical strings', () => {
    expect(jaccardSimilarity('hello world', 'hello world')).toBe(1)
  })

  it('returns 1.0 for two empty strings', () => {
    expect(jaccardSimilarity('', '')).toBe(1)
  })

  it('returns 0 for completely different single-word strings', () => {
    expect(jaccardSimilarity('hello', 'world')).toBe(0)
  })

  it('returns partial similarity for overlapping words', () => {
    const sim = jaccardSimilarity('the cat sat on the mat', 'the dog sat on the mat')
    expect(sim).toBeGreaterThan(0.5)
    expect(sim).toBeLessThan(1)
  })

  it('is case-insensitive', () => {
    expect(jaccardSimilarity('Hello World', 'hello world')).toBe(1)
  })

  it('detects near-duplicate meeting text', () => {
    const sim = jaccardSimilarity(
      'The meeting is scheduled for Monday morning at nine',
      'The meeting is scheduled for Tuesday morning at nine'
    )
    expect(sim).toBeGreaterThanOrEqual(0.8)
  })

  it('returns low similarity for very different text', () => {
    const sim = jaccardSimilarity(
      'We need to discuss the quarterly budget',
      'The weather is nice today outside'
    )
    expect(sim).toBeLessThan(0.2)
  })
})

// ─── extractCompleteSentences ─────────────────────────────────────────────────
describe('extractCompleteSentences', () => {
  it('extracts sentence ending with period', () => {
    const { complete, pending } = extractCompleteSentences('Hello world. How are you')
    expect(complete).toBe('Hello world.')
    expect(pending).toBe('How are you')
  })

  it('extracts sentence ending with exclamation mark', () => {
    const { complete, pending } = extractCompleteSentences('Great! Keep going')
    expect(complete).toBe('Great!')
    expect(pending).toBe('Keep going')
  })

  it('extracts sentence ending with question mark', () => {
    const { complete, pending } = extractCompleteSentences('How are you? Fine')
    expect(complete).toBe('How are you?')
    expect(pending).toBe('Fine')
  })

  it('extracts multiple sentences, keeps remainder as pending', () => {
    const { complete, pending } = extractCompleteSentences('First. Second! Third')
    expect(complete).toBe('First. Second!')
    expect(pending).toBe('Third')
  })

  it('returns empty complete when no sentence boundary', () => {
    const { complete, pending } = extractCompleteSentences('No ending here at all')
    expect(complete).toBe('')
    expect(pending).toBe('No ending here at all')
  })

  it('handles Japanese sentence endings (。)', () => {
    const { complete, pending } = extractCompleteSentences('こんにちは。元気ですか')
    expect(complete).toBe('こんにちは。')
    expect(pending).toBe('元気ですか')
  })

  it('handles Japanese exclamation (！)', () => {
    const { complete, pending } = extractCompleteSentences('すごい！それは面白い')
    expect(complete).toBe('すごい！')
    expect(pending).toBe('それは面白い')
  })

  it('handles ellipsis as sentence boundary', () => {
    const { complete, pending } = extractCompleteSentences('Well… I think')
    expect(complete).toBe('Well…')
    expect(pending).toBe('I think')
  })

  it('returns empty pending when text ends with boundary', () => {
    const { complete, pending } = extractCompleteSentences('Hello world.')
    expect(complete).toBe('Hello world.')
    expect(pending).toBe('')
  })
})
