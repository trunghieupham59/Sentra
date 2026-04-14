import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FuriganaText } from '../components/FuriganaText'
import { ImageTranslator } from '../components/ImageTranslator'
import { MarkdownEditor } from '../components/MarkdownEditor'
import { MarkdownText } from '../components/MarkdownText'
import type { ImageAttachment } from '../components/ImageTranslator'
import { LanguageSelector } from '../components/LanguageSelector'
import { ModelSelector } from '../components/ModelSelector'
import { VoiceRecorder } from '../components/VoiceRecorder'
import { useAppStore, useT } from '../store/useAppStore'
import type { HistoryItem, ImageTextRegion, TranslationStyle } from '../types'

// ─── Canvas helpers for image translation overlay ─────────────────────────────

/** Split `text` into lines that fit within `maxWidth` pixels on the given ctx. */
function canvasWrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  if (!text) return []
  // CJK characters have no word boundaries — split per character
  const isCJK = /[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff]/.test(text)
  const tokens = isCJK ? [...text] : text.split(/\s+/)
  const sep = isCJK ? '' : ' '
  const lines: string[] = []
  let cur = ''
  for (const tok of tokens) {
    const candidate = cur ? cur + sep + tok : tok
    if (ctx.measureText(candidate).width <= maxWidth) {
      cur = candidate
    } else {
      if (cur) lines.push(cur)
      cur = tok // even if single token is wider, start a new line
    }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : [text]
}

/**
 * Draw translated-text overlays onto a canvas that already has the source image drawn.
 * Each region rectangle is filled with a fully-opaque background, then the translated
 * text is rendered with automatic multi-line wrapping. */
function renderTranslatedRegions(
  ctx: CanvasRenderingContext2D,
  regions: ImageTextRegion[],
  cw: number,
  ch: number,
) {
  for (const r of regions) {
    const rx = r.x * cw
    const ry = r.y * ch
    const rw = r.width * cw
    const rh = r.height * ch

    // Fully-opaque background so original text is completely hidden
    ctx.globalAlpha = 1.0
    ctx.fillStyle = r.bgColor ?? '#1a1a1a'
    ctx.fillRect(rx, ry, rw, rh)

    if (!r.translatedText) continue

    const maxTextW = rw * 0.92
    ctx.globalAlpha = 1.0
    ctx.fillStyle = r.textColor ?? '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Start with a font size proportional to region height; shrink until lines fit
    let fs = Math.max(10, rh * 0.5)
    ctx.font = `${fs}px sans-serif`
    let lines = canvasWrapText(ctx, r.translatedText, maxTextW)

    // Reduce font size until all lines fit vertically inside the region
    while (fs > 8 && lines.length * fs * 1.3 > rh * 0.92) {
      fs -= 1
      ctx.font = `${fs}px sans-serif`
      lines = canvasWrapText(ctx, r.translatedText, maxTextW)
    }

    const lineH = fs * 1.3
    const totalH = lines.length * lineH
    const startY = ry + rh / 2 - totalH / 2 + lineH / 2

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], rx + rw / 2, startY + i * lineH)
    }
  }
}

/** Map app language codes → BCP-47 tags understood by SpeechSynthesis */
const LANG_TO_BCP47: Record<string, string> = {
  vi: 'vi-VN', en: 'en-US', zh: 'zh-CN', 'zh-TW': 'zh-TW',
  ja: 'ja-JP', ko: 'ko-KR', fr: 'fr-FR', de: 'de-DE',
  es: 'es-ES', pt: 'pt-PT', ru: 'ru-RU', ar: 'ar-SA',
  th: 'th-TH', id: 'id-ID', it: 'it-IT', nl: 'nl-NL',
  pl: 'pl-PL', tr: 'tr-TR', hi: 'hi-IN',
}

export function TranslatePage() {
  const {
    sourceText, translatedText, phoneticText, sourceLang, targetLang,
    isTranslating, translateError,
    selectedProvider, selectedModels, autoTranslate, autoTranslateDelay, keyStatus, showFurigana, translationStyle,
    ttsVoice,
    setSourceText, setTranslatedText, setPhoneticText, setTargetLang,
    setIsTranslating, setTranslateError, setActivePage, setShowFurigana, setTranslationStyle, setAutoTranslate, addHistory,
  } = useAppStore()
  const t = useT()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasKey = keyStatus[selectedProvider]
  const charCount = sourceText.length
  const [copied, setCopied] = useState(false)
  const [isRewriting, setIsRewriting] = useState<'source' | 'translated' | null>(null)

  // TTS (text-to-speech) state
  const [speakingPanel, setSpeakingPanel] = useState<'source' | 'translated' | null>(null)
  const [speakLoading, setSpeakLoading] = useState(false)
  // Web Audio API refs (more robust than HTMLAudioElement for async-loaded audio)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null) // for OS-speechSynthesis fallback cleanup
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])

  // Load OS voices — they populate asynchronously on first access (used as fallback)
  useEffect(() => {
    if (!window.speechSynthesis) return
    const load = () => { voicesRef.current = window.speechSynthesis.getVoices() }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  // Stop all audio (AI or OS) and reset state
  const stopSpeak = useCallback(() => {
    try { audioSourceRef.current?.stop() } catch {}
    try { audioSourceRef.current?.disconnect() } catch {}
    audioSourceRef.current = null
    audioRef.current?.pause()
    audioRef.current = null
    window.speechSynthesis?.cancel()
    setSpeakingPanel(null)
    setSpeakLoading(false)
  }, [])

  const handleSpeak = useCallback(async (text: string, lang: string, panel: 'source' | 'translated') => {
    // ── ENTRY LOG — appears even if we return early ──
    console.log('[tts] handleSpeak called! panel:', panel, '| speakingPanel:', speakingPanel, '| speakLoading:', speakLoading, '| textLen:', text?.length)
    // Toggle off if already speaking this panel
    if (speakingPanel === panel || speakLoading) {
      console.log('[tts] returning early — already speaking or loading')
      stopSpeak()
      return
    }
    stopSpeak()
    setSpeakingPanel(panel)

    // ── Unlock / create AudioContext BEFORE the first await (still in user-gesture context) ──
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContext()
      }
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume()
      }
    } catch (ctxErr) {
      console.warn('[tts] AudioContext init error:', ctxErr)
    }

    // ── Call backend TTS (OpenAI → Gemini fallback) ────────────────────────
    try {
      setSpeakLoading(true)
      console.log('[tts] Calling speakText, panel:', panel, 'voice:', ttsVoice)
      const result = await window.api.speakText({ text, voice: ttsVoice })
      setSpeakLoading(false)
      console.log('[tts] Result:', result.success, 'provider:', result.provider, 'mimeType:', result.mimeType, 'bytes:', result.audioBase64?.length ?? 0, 'error:', result.error)

      if (result.success && result.audioBase64) {
        const audioCtx = audioCtxRef.current
        if (!audioCtx || audioCtx.state === 'closed') {
          console.error('[tts] AudioContext unavailable')
          setSpeakingPanel(null)
          return
        }

        // Decode base64 → ArrayBuffer
        const binaryStr = atob(result.audioBase64)
        const bytes = new Uint8Array(binaryStr.length)
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
        console.log('[tts] Decoded bytes:', bytes.length, 'mimeType:', result.mimeType)

        let audioBuffer: AudioBuffer
        try {
          // decodeAudioData supports MP3, WAV, OGG, AAC, FLAC
          audioBuffer = await audioCtx.decodeAudioData(bytes.buffer.slice(0))
        } catch (decodeErr) {
          console.error('[tts] decodeAudioData failed:', decodeErr)
          // Gemini may return raw PCM (audio/pcm;rate=24000) — decode manually
          if (result.mimeType?.includes('pcm') || result.mimeType?.includes('l16')) {
            const rateMatch = result.mimeType.match(/rate=(\d+)/)
            const sampleRate = rateMatch ? Number.parseInt(rateMatch[1]) : 24000
            const numSamples = bytes.length / 2
            audioBuffer = audioCtx.createBuffer(1, numSamples, sampleRate)
            const channel = audioBuffer.getChannelData(0)
            const view = new DataView(bytes.buffer)
            for (let i = 0; i < numSamples; i++) {
              channel[i] = view.getInt16(i * 2, true) / 32768
            }
            console.log('[tts] PCM decoded manually, samples:', numSamples, 'sampleRate:', sampleRate)
          } else {
            setSpeakingPanel(null)
            return
          }
        }

        const source = audioCtx.createBufferSource()
        source.buffer = audioBuffer
        // Slightly slower for better comprehension (0.9 = 10% slower than default 1.0)
        source.playbackRate.value = 0.9
        source.connect(audioCtx.destination)
        source.onended = () => { audioSourceRef.current = null; setSpeakingPanel(null) }
        audioSourceRef.current = source
        source.start(0)
        console.log('[tts] Audio started playing via Web Audio API, playbackRate:', source.playbackRate.value)
        return
      }

      // result.success is false → fall through to OS TTS
      console.warn('[tts] Backend TTS failed:', result.error, '| code:', result.errorCode)
    } catch (err) {
      setSpeakLoading(false)
      console.error('[tts] speakText IPC exception:', err)
      // Fall through to OS TTS below
    }

    // ── Fallback: OS speech synthesis ─────────────────────────────────────
    if (!window.speechSynthesis) { setSpeakingPanel(null); return }
    const utter = new SpeechSynthesisUtterance(text)
    const bcp47 = LANG_TO_BCP47[lang]
    if (bcp47) {
      utter.lang = bcp47
      const all = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices()
      const local = all.filter(v => v.localService)
      const prefix = bcp47.split('-')[0]
      const best =
        local.find(v => v.lang === bcp47) ??
        all.find(v => v.lang === bcp47) ??
        local.find(v => v.lang.startsWith(prefix)) ??
        all.find(v => v.lang.startsWith(prefix))
      if (best) utter.voice = best
    }
    utter.onend = () => setSpeakingPanel(null)
    utter.onerror = () => setSpeakingPanel(null)
    window.speechSynthesis.speak(utter)
  }, [speakingPanel, speakLoading, ttsVoice, stopSpeak])

  // Image attachment state (set when user uploads an image via the popup)
  const [imageAttachment, setImageAttachment] = useState<ImageAttachment | null>(null)
  // Regions returned by AI when translating an image (fallback approach)
  const [imageRegions, setImageRegions] = useState<ImageTextRegion[] | null>(null)
  // Rendered translated image via canvas (used only for download)
  const [translatedImageUrl, setTranslatedImageUrl] = useState<string | null>(null)
  // Edited image returned directly by Gemini image-edit model
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null)
  // Image translator modal state
  const [showImageTranslator, setShowImageTranslator] = useState(false)
  // Stable ref so lang-change effect can check imageAttachment without re-subscribing
  const imageAttachmentRef = useRef(imageAttachment)
  imageAttachmentRef.current = imageAttachment

  // Voice recording state
  const [isVoiceActive, setIsVoiceActive] = useState(false)
  const [isVoiceInterim, setIsVoiceInterim] = useState(false)
  // Store the text that was in the textarea when recording started, so voice appends to it
  const voicePrefixRef = useRef('')

  const handleVoiceRecordingChange = useCallback((recording: boolean) => {
    if (recording) {
      // Capture the current text as prefix — voice transcript will append after it
      voicePrefixRef.current = sourceText ? `${sourceText.trimEnd()} ` : ''
      setIsVoiceActive(true)
    } else {
      setIsVoiceActive(false)
      setIsVoiceInterim(false)
    }
  }, [sourceText])

  const handleVoiceTranscript = useCallback((transcript: string, isFinal: boolean) => {
    const combined = voicePrefixRef.current + transcript
    setSourceText(combined)
    setIsVoiceInterim(!isFinal)
  }, [setSourceText])

  const handleTranslate = useCallback(async () => {
    if (isTranslating) return
    if (!hasKey) { setTranslateError(t.translate_error_no_key); return }

    setIsTranslating(true)
    setTranslateError(null)
    setPhoneticText('')

    // ── IMAGE mode: translate the attached image ──────────────────────────
    if (imageAttachment) {
      try {
        const result = await window.api.translateImage({
          provider:      selectedProvider,
          model:         selectedModels[selectedProvider],
          imageBase64:   imageAttachment.base64,
          imageMimeType: imageAttachment.mimeType,
          sourceLang,
          targetLang,
        })
        if (result.success && result.editedImageBase64) {
          // ── Gemini image-edit: show the directly edited image ──
          const mimeType = imageAttachment.mimeType
          setEditedImageUrl(`data:${mimeType};base64,${result.editedImageBase64}`)
          setTranslatedText('✓') // non-empty so copy/speak buttons appear
          setImageRegions(null)
        } else if (result.success && result.regions && result.regions.length > 0) {
          // ── Fallback (Claude/OpenAI): compile translated text from regions ──
          const text = result.regions.map(r => r.translatedText).filter(Boolean).join('\n')
          setTranslatedText(text)
          setImageRegions(result.regions)
          setEditedImageUrl(null)
        } else if (result.success) {
          setTranslatedText('')
          setTranslateError('No text found in image')
        } else {
          setTranslateError(result.error || 'Image translation failed')
        }
      } catch (err) {
        setTranslateError(err instanceof Error ? err.message : 'Unexpected error')
      } finally {
        setIsTranslating(false)
      }
      return
    }

    // ── TEXT mode: normal translation ─────────────────────────────────────
    if (!sourceText.trim()) { setIsTranslating(false); return }
    try {
      const baseParams = {
        provider: selectedProvider,
        model: selectedModels[selectedProvider],
        sourceText,
        sourceLang,
        targetLang,
        translationStyle,
      }

      const plainResult = await window.api.translate({ ...baseParams, showFurigana: false })

      if (plainResult.success && plainResult.translatedText) {
        const plainText = plainResult.translatedText
        setTranslatedText(plainText)
        setIsTranslating(false)

        addHistory({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          provider: selectedProvider,
          model: selectedModels[selectedProvider],
          sourceLang,
          targetLang,
          sourceText,
          translatedText: plainText,
        })

        window.api.translate({ ...baseParams, sourceText: plainText, showFurigana: true, phoneticOnly: true })
          .then((res) => { if (res.success && res.translatedText) setPhoneticText(res.translatedText) })
          .catch(() => {})
      } else {
        setTranslateError(plainResult.error || 'Translation failed')
      }
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setIsTranslating(false)
    }
  }, [imageAttachment, sourceText, sourceLang, targetLang, selectedProvider, selectedModels,
      isTranslating, hasKey, translationStyle, setIsTranslating, setTranslateError,
      setTranslatedText, setPhoneticText, addHistory, t])

  /** Download the translated image (original + text regions overlaid) */
  const handleDownloadTranslatedImage = useCallback(async () => {
    if (!imageAttachment || !imageRegions) return
    const canvas  = document.createElement('canvas')
    canvas.width  = imageAttachment.width
    canvas.height = imageAttachment.height
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    img.src = imageAttachment.previewDataUrl
    await new Promise<void>(resolve => { img.onload = () => resolve() })
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    renderTranslatedRegions(ctx, imageRegions, canvas.width, canvas.height)
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `translated_${Date.now()}.png`
    a.click()
  }, [imageAttachment, imageRegions])

  // Auto-translate debounce (only when autoTranslate is enabled)
  // Skip while voice is recording — interim results would spam the API.
  // Use handleTranslateRef (already defined below for style effect) to avoid the infinite loop
  // caused by handleTranslate changing when isTranslating flips true→false after each translation.
  useEffect(() => {
    if (!autoTranslate || !sourceText.trim() || isVoiceActive) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { handleTranslateRef.current() }, autoTranslateDelay)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [autoTranslate, autoTranslateDelay, sourceText, isVoiceActive])

  // Auto-translate when an image is attached — image has no text to debounce on
  // biome-ignore lint/correctness/useExhaustiveDependencies: imageAttachment change is the trigger; handleTranslate via stable ref
  useEffect(() => {
    if (!imageAttachment) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { handleTranslateRef.current() }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [imageAttachment])

  // Stable refs for effects below (avoids stale closures without re-triggering effects)
  const styleInitRef = useRef(false)
  const langInitRef = useRef(false)
  const modelInitRef = useRef(false)
  const handleTranslateRef = useRef(handleTranslate)
  const sourceTextRef = useRef(sourceText)
  const autoTranslateRef = useRef(autoTranslate)
  handleTranslateRef.current = handleTranslate
  sourceTextRef.current = sourceText
  autoTranslateRef.current = autoTranslate

  useLayoutEffect(() => {
    styleInitRef.current = false
    langInitRef.current = false
    modelInitRef.current = false
  }, [])

  // Re-translate when style changes (skip first render, skip manual mode)
  // biome-ignore lint/correctness/useExhaustiveDependencies: translationStyle is the intentional trigger; handleTranslate is accessed via a stable ref
  useEffect(() => {
    if (!styleInitRef.current) { styleInitRef.current = true; return }
    if (!autoTranslateRef.current) return
    handleTranslateRef.current()
  }, [translationStyle])

  // Re-translate when target or source language changes (skip first render, skip manual mode)
  // Also fires when image is attached — imageAttachmentRef accessed via stable ref
  // biome-ignore lint/correctness/useExhaustiveDependencies: lang changes are the triggers; sourceText/imageAttachment/handleTranslate accessed via stable refs
  useEffect(() => {
    if (!langInitRef.current) { langInitRef.current = true; return }
    if (!autoTranslateRef.current) return
    if (!sourceTextRef.current.trim() && !imageAttachmentRef.current) return
    handleTranslateRef.current()
  }, [targetLang, sourceLang])

  // Re-translate when provider or model changes (skip first render, skip manual mode)
  // biome-ignore lint/correctness/useExhaustiveDependencies: provider/model changes are the triggers; handleTranslate via stable ref
  useEffect(() => {
    if (!modelInitRef.current) { modelInitRef.current = true; return }
    if (!autoTranslateRef.current) return
    if (!sourceTextRef.current.trim() && !imageAttachmentRef.current) return
    handleTranslateRef.current()
  }, [selectedProvider, selectedModels[selectedProvider]])

  // Render translated image whenever regions change (image output for result panel)
  // biome-ignore lint/correctness/useExhaustiveDependencies: imageAttachment + imageRegions are the triggers
  useEffect(() => {
    if (!imageAttachment || !imageRegions || imageRegions.length === 0) {
      setTranslatedImageUrl(null)
      return
    }
    let cancelled = false
    const render = async () => {
      const canvas = document.createElement('canvas')
      canvas.width = imageAttachment.width
      canvas.height = imageAttachment.height
      const ctx = canvas.getContext('2d')!
      const img = new Image()
      img.src = imageAttachment.previewDataUrl
      await new Promise<void>(resolve => { img.onload = () => resolve() })
      if (cancelled) return
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      renderTranslatedRegions(ctx, imageRegions, canvas.width, canvas.height)
      if (!cancelled) setTranslatedImageUrl(canvas.toDataURL('image/png'))
    }
    render().catch(() => {})
    return () => { cancelled = true }
  }, [imageAttachment, imageRegions])

  const handleCopy = async () => {
    const textToCopy = showFurigana && phoneticText ? phoneticText : translatedText
    if (!textToCopy) return
    await navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Scroll-sync refs — keeps both panels scrolled to the same relative position
  const sourceScrollRef = useRef<HTMLDivElement | null>(null)
  const translatedScrollRef = useRef<HTMLDivElement | null>(null)
  const isSyncingScrollRef = useRef(false)

  useEffect(() => {
    const source = sourceScrollRef.current
    const translated = translatedScrollRef.current
    if (!source || !translated) return

    const syncFromSource = () => {
      if (isSyncingScrollRef.current) return
      isSyncingScrollRef.current = true
      const maxSrc = source.scrollHeight - source.clientHeight
      const ratio = maxSrc > 0 ? source.scrollTop / maxSrc : 0
      translated.scrollTop = ratio * (translated.scrollHeight - translated.clientHeight)
      requestAnimationFrame(() => { isSyncingScrollRef.current = false })
    }

    const syncFromTranslated = () => {
      if (isSyncingScrollRef.current) return
      isSyncingScrollRef.current = true
      const maxSrc = translated.scrollHeight - translated.clientHeight
      const ratio = maxSrc > 0 ? translated.scrollTop / maxSrc : 0
      source.scrollTop = ratio * (source.scrollHeight - source.clientHeight)
      requestAnimationFrame(() => { isSyncingScrollRef.current = false })
    }

    source.addEventListener('scroll', syncFromSource, { passive: true })
    translated.addEventListener('scroll', syncFromTranslated, { passive: true })

    return () => {
      source.removeEventListener('scroll', syncFromSource)
      translated.removeEventListener('scroll', syncFromTranslated)
    }
  }, [])

  // Rewrite: make text more natural in its own language without changing meaning
  const handleRewrite = useCallback(async (panel: 'source' | 'translated') => {
    if (isRewriting) return
    if (!hasKey) { setTranslateError(t.translate_error_no_key); return }
    const text = panel === 'source' ? sourceText : translatedText
    const lang = panel === 'source'
      ? (sourceLang === 'auto' ? 'the same language as the input text' : sourceLang)
      : targetLang
    if (!text.trim()) return
    setIsRewriting(panel)
    try {
      const result = await window.api.rewriteText({
        provider: selectedProvider,
        model: selectedModels[selectedProvider],
        text,
        lang,
        translationStyle,
      })
      if (result.success && result.translatedText) {
        if (panel === 'source') {
          setSourceText(result.translatedText)
        } else {
          setTranslatedText(result.translatedText)
          setPhoneticText('')
        }
      }
    } catch (err) {
      console.error('[rewrite] error:', err)
    } finally {
      setIsRewriting(null)
    }
  }, [isRewriting, hasKey, sourceText, translatedText, sourceLang, targetLang, translationStyle,
      selectedProvider, selectedModels, setSourceText, setTranslatedText, setPhoneticText, setTranslateError, t])

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      {/* Toolbar — single row, no wrap */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 overflow-hidden
                      bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        {/* ModelSelector takes remaining space, shrinks when needed */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <ModelSelector />
        </div>

        {/* Right controls — never wrap, never shrink */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Style dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 whitespace-nowrap">{t.translate_style_label}</span>
            <div className="relative">
              <select
                value={translationStyle}
                onChange={(e) => setTranslationStyle(e.target.value as TranslationStyle)}
                className={`text-xs font-medium px-2.5 py-1.5 pr-6 rounded-full border appearance-none cursor-pointer
                            transition-colors duration-200 outline-none
                            ${translationStyle !== 'neutral'
                              ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400'
                              : 'bg-gray-100 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                            }`}
              >
                <option value="friendly">{t.translate_style_friendly}</option>
                <option value="neutral">{t.translate_style_neutral}</option>
                <option value="professional">{t.translate_style_professional}</option>
                <option value="business">{t.translate_style_business}</option>
                <option value="slack">{t.translate_style_slack}</option>
                <option value="polite">{t.translate_style_polite}</option>
                <option value="technical">{t.translate_style_technical}</option>
              </select>
              <div className="pointer-events-none absolute right-2 inset-y-0 flex items-center">
                <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Auto / Manual translation mode toggle — fixed width to prevent layout shift */}
          <button
            type="button"
            onClick={() => setAutoTranslate(!autoTranslate)}
            title={autoTranslate ? 'Tự động dịch — click để chuyển sang thủ công' : 'Dịch thủ công — click để chuyển sang tự động'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium
                        border transition-all duration-200 select-none cursor-pointer
                        w-[88px] justify-start
                        ${autoTranslate
                          ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900'
                          : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'
                        }`}
          >
            <span className={`relative inline-flex shrink-0 items-center w-7 h-4 rounded-full transition-colors duration-200
                              ${autoTranslate ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <span className={`absolute w-3 h-3 bg-white rounded-full shadow transition-transform duration-200
                                ${autoTranslate ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
            </span>
            <span>{autoTranslate ? 'Auto' : 'Manual'}</span>
          </button>

          {/* Phonetic reading toggle */}
          <button
            type="button"
            onClick={() => setShowFurigana(!showFurigana)}
            title={t.translate_phonetic}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium
                        border transition-all duration-200 select-none cursor-pointer whitespace-nowrap
                        ${showFurigana
                          ? 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-900'
                          : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'
                        }`}
          >
            <span className={`relative inline-flex shrink-0 items-center w-7 h-4 rounded-full transition-colors duration-200
                              ${showFurigana ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <span className={`absolute w-3 h-3 bg-white rounded-full shadow transition-transform duration-200
                                ${showFurigana ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
            </span>
            <span>{t.translate_phonetic}</span>
          </button>
        </div>
      </div>

      {/* Language bar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2
                      bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        {/* Source: auto-detect badge */}
        <div className="flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                        bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                        text-sm text-gray-500 dark:text-gray-400 select-none">
          <svg className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 8v3m0 0v3m0-3h3m-3 0H8" />
          </svg>
          <span className="truncate">{t.lang_auto}</span>
        </div>

        {/* Arrow separator */}
        <svg className="flex-shrink-0 w-4 h-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>

        {/* Target language selector */}
        <div className="flex-1">
          <LanguageSelector value={targetLang} onChange={setTargetLang} includeAuto={false} />
        </div>
      </div>

        {/* Text panels */}
      <div className="flex flex-1 min-h-0 divide-x divide-gray-200 dark:divide-gray-800">
        {/* Source panel */}
        <div className="flex-1 basis-0 flex flex-col min-w-0 relative">

          {/* ── Listening overlay (shown while voice is active) ── */}
          {isVoiceActive && (
            <div className="absolute inset-x-0 top-0 bottom-12 z-10 flex flex-col items-center justify-center
                            bg-white dark:bg-gray-900 fade-in">
              {/* Animated rings */}
              <div className="relative flex items-center justify-center mb-5">
                <span className="absolute w-28 h-28 rounded-full bg-red-100 dark:bg-red-900/20 animate-ping" style={{ animationDuration: '1.8s' }} />
                <span className="absolute w-20 h-20 rounded-full bg-red-200 dark:bg-red-900/30 animate-ping" style={{ animationDuration: '1.4s', animationDelay: '0.2s' }} />
                <span className="absolute w-14 h-14 rounded-full bg-red-300 dark:bg-red-900/50 animate-ping" style={{ animationDuration: '1.1s', animationDelay: '0.1s' }} />

                {/* Microphone circle */}
                <div className="relative w-16 h-16 rounded-full bg-red-500 dark:bg-red-600 flex items-center justify-center shadow-md">
                  <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" />
                    <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round" />
                  </svg>
                </div>
              </div>

              {/* Status label */}
              <p className="text-sm font-semibold text-red-500 dark:text-red-400 animate-pulse tracking-wide mb-3">
                {t.voice_listening}
              </p>

              {/* Sound-wave bars */}
              <div className="flex items-end gap-[3px] h-6 mb-4">
                {[1,2,3,4,5,6,7].map((i) => (
                  <span
                    key={i}
                    className="w-1 rounded-full bg-red-400 dark:bg-red-500 animate-bounce"
                    style={{
                      height: `${8 + (i % 3) * 6 + (i % 2) * 4}px`,
                      animationDuration: `${0.6 + i * 0.08}s`,
                      animationDelay: `${i * 0.07}s`,
                    }}
                  />
                ))}
              </div>

              {/* Interim / final transcript preview */}
              {sourceText ? (
                <p className={`max-w-[80%] text-center text-[13px] leading-relaxed line-clamp-3
                               ${isVoiceInterim
                                 ? 'text-gray-400 dark:text-gray-500 italic'
                                 : 'text-gray-700 dark:text-gray-300 font-medium'}`}>
                  {sourceText}
                </p>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-600 select-none">
                  {t.voice_record}…
                </p>
              )}
            </div>
          )}

          {/* ── Image attachment preview (shown when an image is attached) ── */}
          {imageAttachment && !isVoiceActive && (
            <div className="flex-shrink-0 mx-4 mt-3 relative rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800
                            border border-gray-200 dark:border-gray-700 max-h-48 flex items-center justify-center">
              <img
                src={imageAttachment.previewDataUrl}
                alt={imageAttachment.fileName}
                className="max-w-full max-h-48 object-contain"
              />
              {/* × to remove image */}
              <button
                type="button"
                onClick={() => {
                  setImageAttachment(null)
                  setImageRegions(null)
                  setEditedImageUrl(null)
                  setTranslatedText('')
                  setPhoneticText('')
                  setTranslateError(null)
                }}
                title="Remove image"
                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center
                           rounded-full bg-black/50 hover:bg-black/70 text-white cursor-pointer z-10"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {/* File name */}
              <div className="absolute bottom-0 inset-x-0 px-2 py-1
                              bg-black/40 text-white text-[10px] truncate">
                {imageAttachment.fileName}
              </div>
            </div>
          )}

          {/* ── Typora-like markdown editor (line being edited = raw, others = rendered) ── */}
          <div
            ref={sourceScrollRef}
            className="flex-1 overflow-auto p-4 min-h-0"
          >
            <MarkdownEditor
              value={sourceText}
              onChange={(val) => {
                setSourceText(val)
                stopSpeak()
                if (!val.trim()) {
                  setTranslatedText('')
                  setPhoneticText('')
                }
                if (isVoiceActive) voicePrefixRef.current = ''
              }}
              placeholder={t.translate_placeholder}
              className={`min-h-full ${isVoiceInterim ? 'opacity-50 italic' : ''}`}
            />
          </div>

          <div className="flex-shrink-0 flex items-center justify-between px-4 h-12
                          border-t border-gray-100 dark:border-gray-800 relative z-20 bg-white dark:bg-gray-900">
            <div className="flex items-center gap-2">
              {/* Manual translate button — in source panel bottom bar when in manual mode */}
              {!autoTranslate && (
                <button
                  type="button"
                  onClick={handleTranslate}
                  disabled={isTranslating || (!sourceText.trim() && !imageAttachment)}
                  className={[
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold',
                    'bg-blue-600 text-white shadow-sm transition-all duration-200 cursor-pointer select-none',
                    'hover:bg-blue-700 active:scale-95',
                    'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
                  ].join(' ')}
                >
                  {isTranslating ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>{t.translate_btn_loading}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <span>{t.translate_btn ?? 'Dịch'}</span>
                    </>
                  )}
                </button>
              )}
              {/* Voice recorder — shows its own inline status labels */}
              <VoiceRecorder
                sourceLang={sourceLang}
                onTranscript={handleVoiceTranscript}
                onRecordingChange={handleVoiceRecordingChange}
                titleRecord={t.voice_record}
                titleStop={t.voice_stop}
                labelTranscribing={t.voice_transcribing}
                labelRecording={t.voice_whisper_mode}
                useWhisper={keyStatus.openai}
              />

              {/* Image translation button */}
              <button
                type="button"
                onClick={() => setShowImageTranslator(true)}
                title={t.image_translate_title}
                className="relative flex items-center justify-center w-8 h-8 rounded-full
                           transition-all duration-200 cursor-pointer
                           text-gray-400 hover:text-emerald-500 hover:bg-emerald-50
                           dark:hover:bg-emerald-950 dark:hover:text-emerald-400"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </button>

              {!isVoiceActive && (
                <span className="text-xs tabular-nums text-gray-400">
                  {charCount.toLocaleString()} {t.translate_chars}
                </span>
              )}
            </div>
            {sourceText && !isVoiceActive && (
              <div className="flex items-center gap-2">
                {/* Speak source text */}
                <button
                  type="button"
                  onClick={() => handleSpeak(sourceText, sourceLang === 'auto' ? 'en' : sourceLang, 'source')}
                  title={speakingPanel === 'source' ? t.translate_speak_stop : t.translate_speak}
                  className={[
                    'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
                    'transition-all duration-200 cursor-pointer',
                    speakingPanel === 'source'
                      ? 'bg-blue-500 text-white shadow-sm hover:bg-blue-600'
                      : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 dark:hover:text-blue-400',
                  ].join(' ')}
                >
                  {speakLoading && speakingPanel === 'source' ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="hidden min-[1100px]:inline">{t.translate_speak}</span>
                    </>
                  ) : speakingPanel === 'source' ? (
                    <>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
                      </svg>
                      <span className="hidden min-[1100px]:inline">{t.translate_speak_stop}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 01-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
                        <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
                      </svg>
                      <span className="hidden min-[1100px]:inline">{t.translate_speak}</span>
                    </>
                  )}
                </button>

                {/* Rewrite source text */}
                <button
                  type="button"
                  onClick={() => handleRewrite('source')}
                  title={t.translate_rewrite}
                  disabled={!!isRewriting}
                  className={[
                    'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
                    'transition-all duration-200 cursor-pointer',
                    isRewriting === 'source'
                      ? 'bg-violet-500 text-white shadow-sm'
                      : 'text-gray-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950 dark:hover:text-violet-400',
                    !!isRewriting && isRewriting !== 'source' ? 'opacity-40 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  {isRewriting === 'source' ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="hidden min-[1100px]:inline">{t.translate_rewriting}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                      </svg>
                      <span className="hidden min-[1100px]:inline">{t.translate_rewrite}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { stopSpeak(); setSourceText(''); setTranslatedText(''); setPhoneticText(''); setTranslateError(null) }}
                  className="btn-ghost py-1 px-2 text-xs flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span className="hidden min-[1100px]:inline">{t.translate_clear}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Result panel */}
        <div className="flex-1 basis-0 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900/50">
          <div ref={translatedScrollRef} className="flex-1 p-4 overflow-auto relative">
            {isTranslating ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <svg className="w-5 h-5 spinner text-blue-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm text-gray-400">{t.translate_btn_loading}</span>
                </div>
              </div>
            ) : translateError ? (
              <div className="fade-in flex flex-col gap-3">
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30
                                border border-red-200 dark:border-red-900 rounded-lg">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-red-700 dark:text-red-300">{translateError}</p>
                </div>
                {(translateError.includes('API key') || translateError.includes('Settings') ||
                  translateError.includes('Cài đặt') || translateError.includes('設定')) && (
                  <button type="button" onClick={() => setActivePage('settings')} className="btn-primary w-fit text-xs">
                    {t.translate_error_open_settings}
                  </button>
                )}
              </div>
            ) : editedImageUrl ? (
              /* ── Gemini image-edit result: show the translated image directly ── */
              <img
                src={editedImageUrl}
                alt="Translated"
                className="max-w-full rounded-lg fade-in"
              />
            ) : translatedText ? (
              showFurigana && phoneticText
                ? <FuriganaText text={phoneticText} className="textarea-field fade-in" />
                : <MarkdownText text={translatedText} className="textarea-field fade-in" />
            ) : (
              <p className="text-[15px] text-gray-300 dark:text-gray-700 leading-relaxed select-none">
                {t.translate_result_placeholder}
              </p>
            )}
          </div>

          <div className="flex-shrink-0 flex items-center justify-between px-4 h-12
                          border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
            <span className="text-xs text-gray-400 tabular-nums">
              {translatedText && !editedImageUrl ? `${translatedText.length.toLocaleString()} ${t.translate_chars}` : ''}
            </span>
            {(translatedText || editedImageUrl) && (
              <div className="flex items-center gap-2">
                {/* Speak translated text — hide when showing Gemini-edited image */}
                {!editedImageUrl && <button
                  type="button"
                  onClick={() => handleSpeak(translatedText, targetLang, 'translated')}
                  title={speakingPanel === 'translated' ? t.translate_speak_stop : t.translate_speak}
                  className={[
                    'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
                    'transition-all duration-200 cursor-pointer',
                    speakingPanel === 'translated'
                      ? 'bg-blue-500 text-white shadow-sm hover:bg-blue-600'
                      : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 dark:hover:text-blue-400',
                  ].join(' ')}
                >
                  {speakLoading && speakingPanel === 'translated' ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="hidden min-[1100px]:inline">{t.translate_speak}</span>
                    </>
                  ) : speakingPanel === 'translated' ? (
                    <>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
                      </svg>
                      <span className="hidden min-[1100px]:inline">{t.translate_speak_stop}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 01-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
                        <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
                      </svg>
                      <span className="hidden min-[1100px]:inline">{t.translate_speak}</span>
                    </>
                  )}
                </button>}
                {/* Download edited image (Gemini image-edit result) */}
                {editedImageUrl && (
                  <button
                    type="button"
                    title={t.image_translate_download}
                    onClick={() => {
                      const a = document.createElement('a')
                      a.href = editedImageUrl
                      a.download = `translated_${Date.now()}.png`
                      a.click()
                    }}
                    className="relative flex items-center justify-center w-8 h-8 rounded-full
                               transition-all duration-200 cursor-pointer
                               text-gray-400 hover:text-emerald-500 hover:bg-emerald-50
                               dark:hover:bg-emerald-950 dark:hover:text-emerald-400"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                )}
                {/* Download canvas-overlay image (regions fallback) */}
                {imageRegions && imageAttachment && !editedImageUrl && (
                  <button
                    type="button"
                    onClick={handleDownloadTranslatedImage}
                    title={t.image_translate_download}
                    className="relative flex items-center justify-center w-8 h-8 rounded-full
                               transition-all duration-200 cursor-pointer
                               text-gray-400 hover:text-emerald-500 hover:bg-emerald-50
                               dark:hover:bg-emerald-950 dark:hover:text-emerald-400"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                )}
                {/* Rewrite translated text */}
                {!editedImageUrl && (
                  <button
                    type="button"
                    onClick={() => handleRewrite('translated')}
                    title={t.translate_rewrite}
                    disabled={!!isRewriting}
                    className={[
                      'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
                      'transition-all duration-200 cursor-pointer',
                      isRewriting === 'translated'
                        ? 'bg-violet-500 text-white shadow-sm'
                        : 'text-gray-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950 dark:hover:text-violet-400',
                      !!isRewriting && isRewriting !== 'translated' ? 'opacity-40 cursor-not-allowed' : '',
                    ].join(' ')}
                  >
                    {isRewriting === 'translated' ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="hidden min-[1100px]:inline">{t.translate_rewriting}</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                        </svg>
                        <span className="hidden min-[1100px]:inline">{t.translate_rewrite}</span>
                      </>
                    )}
                  </button>
                )}
                {!editedImageUrl && <button type="button" onClick={handleCopy} className={`btn-ghost py-1 px-2 text-xs transition-all ${copied ? 'text-green-600' : ''}`}>
                  {copied ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="hidden min-[1100px]:inline">{t.translate_copied}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      <span className="hidden min-[1100px]:inline">{t.translate_copy}</span>
                    </>
                  )}
                </button>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image translator modal — opens popup, resizes image, attaches to translate area */}
      {showImageTranslator && (
        <ImageTranslator
          onImageReady={(attachment) => {
            setImageAttachment(attachment)
            setImageRegions(null)
            setEditedImageUrl(null)
            setTranslatedText('')
            setPhoneticText('')
            setTranslateError(null)
          }}
          onClose={() => setShowImageTranslator(false)}
        />
      )}
    </div>
  )
}
