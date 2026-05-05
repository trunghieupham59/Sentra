/**
 * Deep Research Service — Iterative Multi-loop Pipeline
 *
 * True deep research with feedback loops, not a simple 1-pass search:
 *
 *   Phase 1 — Initial Analysis
 *     AI breaks the question into key aspects and research questions.
 *
 *   Phase 2 — First-Pass Research (Breadth)
 *     Web search + AI analysis for each aspect. Builds initial knowledge base.
 *
 *   Phase 3 — Gap Analysis Loop (up to MAX_GAP_ITERATIONS rounds)
 *     AI evaluates all findings and identifies:
 *       • What's still unclear / missing?
 *       • What contradictions need resolution?
 *     Targeted searches fill those gaps. Loops until AI is satisfied or limit reached.
 *
 *   Phase 4 — Cross-Reference & Confidence
 *     AI reviews ALL findings for contradictions and assigns confidence levels
 *     (Confirmed / Uncertain / Contradicted).
 *
 *   Phase 5 — Final Synthesis
 *     Comprehensive answer with source citations and confidence indicators.
 *
 * With Tavily web search: real-time data at every phase.
 * Without Tavily key: AI-knowledge-only with explicit staleness warnings.
 *
 * i18n: All user-facing step labels, error fallbacks and Markdown prefixes
 * are passed in via the {@link DeepResearchUiText} object so the service
 * stays language-agnostic. AI-facing system prompts intentionally remain
 * in English to avoid biasing the model's output language (the AI is told
 * via LANG_RULE to mirror the user's question language).
 */

import type { DeepResearchResumeState } from '../types'
import { tpl } from '../utils/tpl'
import type { ChatMessageContent } from './chatService'
import { chatService } from './chatService'
import { formatWebSearchResults, getCurrentLocaleDateTime, hasWebSearchApi } from './searchResultFormatting'


// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum number of gap-analysis → targeted-search iterations */
const MAX_GAP_ITERATIONS = 2

/** Maximum number of gaps to chase per iteration */
const MAX_GAPS_PER_ROUND = 3

/** Maximum search results per query */
const MAX_SEARCH_RESULTS = 5

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Logical phase identifier passed to {@link DeepResearchCallbacks.onStepStart}.
 * The renderer uses it to group consecutive steps of the same phase into one
 * compact pill (e.g. "Khảo sát · 4 khía cạnh") instead of rendering N rows.
 *
 * Kept loose (`string` union) so the service stays decoupled from renderer
 * types — `src/types/index.ts` defines the matching `ResearchStepPhase`.
 */
export type DeepResearchStepPhase =
  | 'analyze'
  | 'survey'
  | 'gap'
  | 'deep'
  | 'cross'
  | 'synth'

export interface DeepResearchStepMeta {
  /** Phase this step belongs to (drives the grouped pill UI). */
  phase: DeepResearchStepPhase
  /**
   * Optional aspect / sub-question descriptor — surfaced inside the hover
   * info popover so users can see what each grouped step researched. Empty
   * for phase-level steps (analyze / cross / synth).
   */
  aspect?: string
}

export interface DeepResearchCallbacks {
  /** Called when a new step starts. Must return the generated message ID. */
  onStepStart: (label: string, meta: DeepResearchStepMeta) => string
  /** Called when a step completes. `isFinal` = true only for the synthesis step. */
  onStepComplete: (msgId: string, content: string, isFinal: boolean) => void
  /** Called when a step fails with an error. */
  onStepError: (msgId: string, error: string) => void
  /**
   * Persistence hook — fired whenever a phase finishes successfully so the
   * caller can snapshot the in-progress pipeline state. Pass `null` once
   * the synthesis phase completes (or when the whole pipeline succeeds) so
   * the caller can clear the resume snapshot.
   *
   * Optional: callers that don't care about resume can omit this.
   */
  onResumeStateChange?: (state: DeepResearchResumeState | null) => void
}



/**
 * Localized strings rendered into the chat thread by the deep-research pipeline.
 *
 * Keys whose template uses `{name}` placeholders accept variables consumed by
 * {@link tpl}. Callers should map renderer i18n keys → fields here.
 */
export interface DeepResearchUiText {
  stepAnalyze: string
  /** Template `{aspect}` */
  stepRound1: string
  /** Template `{round}` */
  stepGap: string
  /** Template `{aspect}` */
  stepDeep: string
  stepCross: string
  stepSynth: string
  modeRealtime: string
  modeAiOnly: string
  /** Template `{count}` */
  willStudy: string
  /** Template `{context}` */
  imageContext: string
  /** Template `{terms}` */
  imageTerms: string
  imageKbLabel: string
  complete: string
  /** Template `{count}` */
  gapsFound: string
  deeperLabel: string
  /** Template `{error}` */
  cannotAnalyze: string
  /** Template `{error}` */
  cannotResearch: string
  /** Template `{error}` */
  crossFailed: string
  /** Template `{error}` */
  crossFailedInline: string
  /** Template `{error}` */
  synthFailed: string
  /** Template `{error}` */
  errorInline: string
  errorAnalyze: string
  errorGeneric: string
  errorEval: string
  errorCross: string
  errorSynth: string
  errorUnknown: string
  webSummary: string
}

export interface DeepResearchParams {
  provider: string
  model: string
  question: string
  images?: DeepResearchImageAttachment[]
  uiText: DeepResearchUiText
  callbacks: DeepResearchCallbacks
  /**
   * AbortSignal for user-initiated cancellation. The orchestration polls the
   * signal between phases / aspects so the multi-step pipeline can short-
   * circuit cleanly when the user clicks Stop.
   */
  signal?: AbortSignal
  /**
   * Forward the user's "Careful Reasoning" toggle to the synthesis step (the
   * step that produces the user-visible final answer). Intermediate steps
   * (analyze, per-aspect research, gap analysis, deep-dive, cross-reference)
   * intentionally skip the directive — they emit structured JSON or compact
   * notes where the verbose math-discipline preamble is wasted tokens.
   */
  carefulReasoning?: boolean
  /**
   * Optional snapshot of a previous, interrupted run. When supplied, the
   * pipeline resumes from `lastCompletedPhase` instead of starting fresh —
   * skipping all phases the snapshot already finished, restoring the
   * accumulated knowledge base, and continuing with the next phase.
   *
   * Used by the renderer when the user clicks "Tiếp tục nghiên cứu" on a
   * stopped Deep Research run.
   */
  resumeState?: DeepResearchResumeState
}



export interface DeepResearchImageAttachment {
  imageBase64: string
  imageMimeType: string
}

interface GapAnalysisResult {
  isComplete: boolean
  gaps: string[]
  queries: string[]
}

type ChatServiceResult = Awaited<ReturnType<typeof chatService.send>>

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function webSearch(query: string, webSummaryLabel: string): Promise<string> {
  if (!hasWebSearchApi()) return ''
  try {
    const result = await window.api.webSearch({ query: query.slice(0, 200), maxResults: MAX_SEARCH_RESULTS })
    if (result.success && result.results?.length) {
      return formatWebSearchResults(result.results, result.answer, webSummaryLabel)
    }
  } catch { /* ignore */ }
  return ''
}

function getReply(result: ChatServiceResult): string | null {
  const reply = result.reply?.trim()
  return result.success && reply ? reply : null
}

function describeChatFailure(result: ChatServiceResult, fallback: string): string {
  if (result.error?.trim()) return result.error
  if (result.success && !result.reply?.trim()) return fallback
  return fallback
}

function buildResearchContent(text: string, images: DeepResearchImageAttachment[] = []): ChatMessageContent[] {
  const content: ChatMessageContent[] = images.map((image) => ({
    type: 'image',
    imageBase64: image.imageBase64,
    imageMimeType: image.imageMimeType,
  }))

  if (text.trim()) {
    content.push({ type: 'text', text })
  }

  return content.length > 0 ? content : [{ type: 'text', text }]
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
}

function buildSearchQuery(
  topic: string,
  question: string,
  imageContext: string,
  imageSearchTerms: string[],
): string {
  const visualContext = imageSearchTerms.length > 0 ? imageSearchTerms.join(' ') : imageContext
  return [visualContext, topic, question]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
}

// ─── Language rule (prepended to every AI-facing prompt) ─────────────────────

const LANG_RULE = `LANGUAGE RULE — NON-NEGOTIABLE:
1. Detect the language of the user's original question.
2. Write your ENTIRE response in that exact same language.
3. Do NOT switch to Vietnamese, English, or any other language — even if these instructions are written in English.
4. Examples: Japanese question → Japanese answer. Korean question → Korean answer. French question → French answer.

`

// ─── System Prompts (written in English to avoid language bias) ───────────────

const ANALYZE_PROMPT = (date: string, hasImages: boolean) => `${LANG_RULE}You are a research expert. The question was asked at: ${date}.
${hasImages
    ? `The user attached image(s) as part of the research request. Inspect the image(s), identify visible entities/text/context, and use that visual information when choosing research aspects and search terms.

`
    : ''}Analyze the user's question and identify 3-4 most important aspects to research in depth.
Return ONLY valid JSON, no other text:
${hasImages
    ? '{"aspects": ["aspect 1", "aspect 2", "aspect 3"], "imageContext": "concise visual context from the attached image(s)", "searchTerms": ["specific entity or keyword from image 1", "specific entity or keyword from image 2"]}'
    : '{"aspects": ["aspect 1", "aspect 2", "aspect 3"]}'}`

const RESEARCH_PROMPT = (date: string, aspect: string, question: string, webCtx: string, imageContext: string) =>
  webCtx
    ? `${LANG_RULE}You are an expert analyst. Timestamp: ${date}.
Original question: ${question}
Aspect to analyze: ${aspect}
${imageContext ? `Attached image context: ${imageContext}\n` : ''}

━━━ REAL-TIME WEB SEARCH RESULTS ━━━
${webCtx}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Analyze the web data above. Cite sources. Note contradictions if any. Prioritize web data over your training knowledge.`
    : `${LANG_RULE}You are an expert analyst. Timestamp: ${date}.
Original question: ${question}
Aspect to analyze: ${aspect}
${imageContext ? `Attached image context: ${imageContext}\n` : ''}

No web search available — using training data only.
Please: state your training cutoff clearly, and mark information that MAY HAVE CHANGED since then.`

const GAP_ANALYSIS_PROMPT = (date: string) =>
  `${LANG_RULE}You are a research quality evaluator. Timestamp: ${date}.
Evaluate the original question and research findings provided by the user.
Is the research sufficient to answer the original question ACCURATELY and COMPLETELY?
- What important information is still missing?
- Are there any contradictions that need verification?
- Which aspects need deeper investigation?

Return ONLY valid JSON:
{
  "isComplete": true/false,
  "reasoning": "brief reason",
  "gaps": ["gap 1", "gap 2"],
  "queries": ["specific search query 1", "specific search query 2"]
}`

const GAP_ANALYSIS_CONTENT = (question: string, allFindings: string, imageContext: string) =>
  `Original question: ${question}
${imageContext ? `Attached image context: ${imageContext}\n` : ''}

━━━ ALL RESEARCH FINDINGS SO FAR ━━━
${allFindings}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`

const CROSS_REFERENCE_PROMPT = (date: string, hadWeb: boolean) =>
  `${LANG_RULE}You are a research verification expert. Timestamp: ${date}.
${hadWeb ? 'Data was collected from real-time web search.' : 'Data is from AI training data only.'}

The user will provide the original question and all research findings.
Perform cross-reference analysis on those findings:
1. List points CONFIRMED by multiple sources
2. List points UNCERTAIN — from only one source or potentially outdated
3. List points CONTRADICTED across sources and explain

Be concise and well-structured.`

const CROSS_REFERENCE_CONTENT = (question: string, allFindings: string, imageContext: string) =>
  `Original question: ${question}
${imageContext ? `Attached image context: ${imageContext}\n` : ''}

━━━ ALL RESEARCH FINDINGS ━━━
${allFindings}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`

const SYNTHESIS_PROMPT = (date: string, hadWeb: boolean) => {
  const note = hadWeb
    ? 'Data sourced from real-time web search. High accuracy expected.'
    : 'Data from AI training only. Add a "## Accuracy Note" section at the end to warn the user about potential staleness.'
  return `${LANG_RULE}You are a research synthesis expert. Timestamp: ${date}. ${note}

Create a COMPREHENSIVE and ACCURATE final answer with:
## Structure:
- Clear headings (##)
- Bullet points where appropriate
- Source citations where available
- Confidence indicators: Confirmed / Uncertain / Contradicted
- A "## Conclusion" section at the end`
}

// ─── Default aspects (English — neutral, no language bias) ───────────────────

const DEFAULT_ASPECTS = [
  'Background and overview',
  'Detailed analysis and key factors',
  'Latest information and trends',
]

// ─── Main pipeline ────────────────────────────────────────────────────────────

export const deepResearchService = {
  async run({ provider, model, question, images = [], uiText, callbacks, signal, carefulReasoning, resumeState }: DeepResearchParams): Promise<void> {

    const date = getCurrentLocaleDateTime()
    const webAvailable = hasWebSearchApi()
    const { onStepStart, onStepComplete, onStepError, onResumeStateChange } = callbacks
    const hasImages = images.length > 0

    /**
     * Phase ordering helper used to decide whether a given phase should run
     * during a resumed pipeline. We compare the index of `phase` to the index
     * of `resumeState.lastCompletedPhase`; if `phase` is at or before the
     * snapshot's last-completed phase, it has already finished and we skip
     * the work (but still emit a synthetic step bubble so the UI shows the
     * timeline correctly).
     */
    const PHASE_ORDER: DeepResearchStepPhase[] = ['analyze', 'survey', 'gap', 'deep', 'cross', 'synth']
    const phaseIndex = (p: DeepResearchStepPhase): number => PHASE_ORDER.indexOf(p)
    const isPhaseDone = (p: DeepResearchStepPhase): boolean => {
      if (!resumeState) return false
      return phaseIndex(p) <= phaseIndex(resumeState.lastCompletedPhase)
    }


    /**
     * Sentinel error message for Deep Research user cancellation. The
     * orchestration polls `signal.aborted` between phases and throws this
     * to halt the pipeline early. The renderer treats the message as a
     * non-error completion.
     */
    const CANCELLED = 'deep-research-cancelled'
    /** Throws the cancellation sentinel when the user aborted. */
    const throwIfCancelled = () => {
      if (signal?.aborted) throw new Error(CANCELLED)
    }

    /**
     * Wraps `chatService.sendAbortable` so the caller doesn't have to thread
     * `signal` through every `await`. The signal forwards to the streaming
     * IPC under the hood, which lets the user kill the in-flight provider
     * call within milliseconds when they click Stop — instead of waiting for
     * the current step's HTTP response to finish naturally.
     */
    type SendChatParams = Parameters<typeof chatService.sendAbortable>[0]
    const sendChat = (params: SendChatParams) =>
      chatService.sendAbortable(params, { signal })



    // Accumulated state — resumed runs hydrate from `resumeState` so phases
    // already completed in the previous run aren't re-paid for.
    const knowledgeBase: Array<{ label: string; content: string }> = resumeState
      ? [...resumeState.knowledgeBase]
      : []
    let anyWebSearch = resumeState?.anyWebSearch ?? false
    let imageContext = resumeState?.imageContext ?? ''
    let imageSearchTerms: string[] = resumeState?.imageSearchTerms ?? []

    /**
     * Build a fresh snapshot reflecting current pipeline state. Helper exists
     * so each phase can persist its outcome at the right moment without
     * duplicating the field list.
     */
    const buildSnapshot = (
      lastCompletedPhase: DeepResearchStepPhase,
      lastGapIteration: number,
      crossContentValue?: string,
    ): DeepResearchResumeState => ({
      question,
      aspects,
      knowledgeBase: [...knowledgeBase],
      imageContext,
      imageSearchTerms,
      anyWebSearch,
      crossContent: crossContentValue,
      lastCompletedPhase,
      lastGapIteration,
      hasImages,
      carefulReasoning,
    })

    // ── Phase 1: Initial Analysis ─────────────────────────────────────────
    let aspects: string[] = resumeState?.aspects ?? DEFAULT_ASPECTS

    if (!isPhaseDone('analyze')) {
      const analyzeMsgId = onStepStart(uiText.stepAnalyze, { phase: 'analyze' })

      try {
        const result = await sendChat({
          provider, model,
          messages: [{ role: 'user', content: buildResearchContent(question, images) }],
          systemPrompt: ANALYZE_PROMPT(date, hasImages),
        })
        const reply = getReply(result)
        if (reply) {
          const m = reply.match(/\{[\s\S]*\}/)
          if (m) {
            try {
              const p = JSON.parse(m[0])
              const parsedAspects = parseStringArray(p.aspects)
              if (parsedAspects.length >= 2) aspects = parsedAspects.slice(0, 4)
              if (hasImages && typeof p.imageContext === 'string') {
                imageContext = p.imageContext.trim()
              }
              if (hasImages) {
                imageSearchTerms = parseStringArray(p.searchTerms).slice(0, 6)
              }
            } catch { /* use defaults */ }
          }
        }
      } catch (err) {
        onStepError(analyzeMsgId, err instanceof Error ? err.message : uiText.errorAnalyze)
        throw err
      }

      const analyzeContent = [
        webAvailable ? uiText.modeRealtime : uiText.modeAiOnly,
        '',
        tpl(uiText.willStudy, { count: aspects.length }),
        ...aspects.map((a, i) => `${i + 1}. ${a}`),
        ...(imageContext ? ['', tpl(uiText.imageContext, { context: imageContext })] : []),
        ...(imageSearchTerms.length > 0 ? [tpl(uiText.imageTerms, { terms: imageSearchTerms.join(', ') })] : []),
      ].join('\n')
      onStepComplete(analyzeMsgId, analyzeContent, false)
      if (imageContext) {
        knowledgeBase.push({ label: uiText.imageKbLabel, content: imageContext })
      }
      onResumeStateChange?.(buildSnapshot('analyze', 0))
    }


    // ── Phase 2: First-pass research (Breadth) ────────────────────────────
    // The label is intentionally short (just the phase name, e.g. "Khảo sát")
    // because the renderer collapses every survey step into one pill and shows
    // the per-aspect detail inside a hover-info popover. We still pass the
    // `aspect` text via meta so the popover can list what each step researched.
    if (!isPhaseDone('survey')) {
      for (const aspect of aspects) {
        throwIfCancelled()
        const msgId = onStepStart(
          tpl(uiText.stepRound1, { aspect }),
          { phase: 'survey', aspect },
        )

        try {
          const webCtx = await webSearch(
            buildSearchQuery(aspect, question, imageContext, imageSearchTerms),
            uiText.webSummary,
          )
          if (webCtx) anyWebSearch = true

          const result = await sendChat({
            provider, model,
            messages: [{ role: 'user', content: buildResearchContent(`Analyze this aspect: ${aspect}`, images) }],
            systemPrompt: RESEARCH_PROMPT(date, aspect, question, webCtx, imageContext),
          })
          const content = getReply(result) ?? tpl(uiText.cannotAnalyze, {
            error: describeChatFailure(result, uiText.errorUnknown),
          })
          knowledgeBase.push({ label: aspect, content })
          onStepComplete(msgId, content, false)
          // Snapshot after each aspect so a Stop mid-survey can resume
          // from the very next aspect rather than restarting Phase 2.
          onResumeStateChange?.(buildSnapshot('survey', 0))
        } catch (err) {
          const e = err instanceof Error ? err.message : uiText.errorGeneric
          onStepError(msgId, e)
          knowledgeBase.push({ label: aspect, content: tpl(uiText.errorInline, { error: e }) })
        }
      }
    }


    // ── Phase 3: Gap Analysis Loop ────────────────────────────────────────
    // When resuming, skip iterations that already finished. We use the
    // `lastGapIteration` field on the snapshot — `0` means no gap round has
    // run yet, `1` means the first gap round is done, etc.
    const startIteration = (resumeState && (resumeState.lastCompletedPhase === 'gap' || resumeState.lastCompletedPhase === 'deep'))
      ? resumeState.lastGapIteration + 1
      : 1
    for (let iteration = startIteration; iteration <= MAX_GAP_ITERATIONS; iteration++) {
      throwIfCancelled()

      const allFindings = knowledgeBase
        .map((k, i) => `### ${i + 1}. ${k.label}\n${k.content}`)
        .join('\n\n---\n\n')

      // Ask AI: is the research complete? What's missing?
      const gapMsgId = onStepStart(
        tpl(uiText.stepGap, { round: iteration }),
        { phase: 'gap' },
      )
      let gapResult: GapAnalysisResult = { isComplete: true, gaps: [], queries: [] }


      try {
        const result = await sendChat({
          provider, model,
          messages: [{ role: 'user', content: buildResearchContent(GAP_ANALYSIS_CONTENT(question, allFindings, imageContext), images) }],
          systemPrompt: GAP_ANALYSIS_PROMPT(date),
          bypassLengthCheck: true,
        })

        const reply = getReply(result)
        if (reply) {
          const m = reply.match(/\{[\s\S]*\}/)
          if (m) {
            try {
              const p = JSON.parse(m[0])
              gapResult = {
                isComplete: Boolean(p.isComplete),
                gaps: Array.isArray(p.gaps) ? p.gaps.slice(0, MAX_GAPS_PER_ROUND) : [],
                queries: Array.isArray(p.queries) ? p.queries.slice(0, MAX_GAPS_PER_ROUND) : [],
              }
            } catch { gapResult.isComplete = true }
          }
        }

        const gapContent = gapResult.isComplete
          ? uiText.complete
          : [
              tpl(uiText.gapsFound, { count: gapResult.gaps.length }),
              ...gapResult.gaps.map((g, i) => `${i + 1}. ${g}`),
            ].join('\n')

        onStepComplete(gapMsgId, gapContent, false)
        // Snapshot after each gap-evaluation so a Stop here can pick up at
        // the deep-dive sub-phase (or the next iteration) without re-doing
        // the gap analysis call.
        onResumeStateChange?.(buildSnapshot('gap', iteration))
      } catch (err) {
        onStepError(gapMsgId, err instanceof Error ? err.message : uiText.errorEval)
        gapResult.isComplete = true // fall through to synthesis on error
      }

      // If complete, stop the loop
      if (gapResult.isComplete || gapResult.queries.length === 0) break


      // Chase each gap with targeted search + analysis
      for (let g = 0; g < Math.min(gapResult.queries.length, MAX_GAPS_PER_ROUND); g++) {
        const query = gapResult.queries[g]
        const gapLabel = gapResult.gaps[g] ?? query
        const deepMsgId = onStepStart(
          tpl(uiText.stepDeep, { aspect: gapLabel }),
          { phase: 'deep', aspect: gapLabel },
        )


        try {
          const webCtx = await webSearch(
            buildSearchQuery(query, question, imageContext, imageSearchTerms),
            uiText.webSummary,
          )
          if (webCtx) anyWebSearch = true

          const result = await sendChat({
            provider, model,
            messages: [{ role: 'user', content: buildResearchContent(`Deep dive research: ${gapLabel}`, images) }],
            systemPrompt: RESEARCH_PROMPT(date, gapLabel, question, webCtx, imageContext),
          })
          const content = getReply(result) ?? tpl(uiText.cannotResearch, {
            error: describeChatFailure(result, uiText.errorUnknown),
          })
          knowledgeBase.push({ label: `${uiText.deeperLabel} ${gapLabel}`, content })
          onStepComplete(deepMsgId, content, false)
          // Persist after each deep-dive aspect — granular snapshot helps a
          // mid-loop Stop resume from the very next gap instead of redoing
          // the whole gap-iteration.
          onResumeStateChange?.(buildSnapshot('deep', iteration))
        } catch (err) {
          const e = err instanceof Error ? err.message : uiText.errorGeneric
          onStepError(deepMsgId, e)
          knowledgeBase.push({ label: gapLabel, content: tpl(uiText.errorInline, { error: e }) })
        }
      }
    }

    // ── Phase 4: Cross-reference ──────────────────────────────────────────
    // Resumed runs that already produced a cross-reference output reuse it
    // verbatim — we still emit a step bubble so the timeline stays coherent.
    let crossContent = resumeState?.crossContent ?? ''
    if (!isPhaseDone('cross')) {
      const crossMsgId = onStepStart(uiText.stepCross, { phase: 'cross' })

      const allFindingsCross = knowledgeBase
        .map((k, i) => `### ${i + 1}. ${k.label}\n${k.content}`)
        .join('\n\n---\n\n')

      try {
        const result = await sendChat({
          provider, model,
          messages: [{ role: 'user', content: buildResearchContent(CROSS_REFERENCE_CONTENT(question, allFindingsCross, imageContext), images) }],
          systemPrompt: CROSS_REFERENCE_PROMPT(date, anyWebSearch),
          bypassLengthCheck: true,
        })
        crossContent = getReply(result)
          ?? tpl(uiText.crossFailed, { error: describeChatFailure(result, uiText.errorUnknown) })
        onStepComplete(crossMsgId, crossContent, false)
        onResumeStateChange?.(buildSnapshot('cross', resumeState?.lastGapIteration ?? 0, crossContent))
      } catch (err) {
        const e = err instanceof Error ? err.message : uiText.errorCross
        onStepError(crossMsgId, e)
        crossContent = tpl(uiText.crossFailedInline, { error: e })
      }
    }

    // ── Phase 5: Final Synthesis ──────────────────────────────────────────
    // Synth never gets skipped — even when resuming we always re-run it so
    // the user gets a fresh user-facing answer that incorporates the full
    // knowledge base. After it succeeds we clear the resume snapshot so the
    // panel hides the "Tiếp tục" button.
    const synthMsgId = onStepStart(uiText.stepSynth, { phase: 'synth' })

    const allFindingsFinal = knowledgeBase
      .map((k, i) => `### ${i + 1}. ${k.label}\n${k.content}`)
      .join('\n\n---\n\n')

    const synthContext = [
      `## Research Findings (${knowledgeBase.length} sources)`,
      allFindingsFinal,
      '---',
      '## Cross-Reference Analysis',
      crossContent,
    ].join('\n\n')

    try {
      const result = await sendChat({
        provider, model,
        messages: [{
          role: 'user',
          content: buildResearchContent([
            `Original question: ${question}`,
            imageContext ? `Attached image context: ${imageContext}` : '',
            synthContext,
          ].filter(Boolean).join('\n\n'), images),
        }],
        systemPrompt: SYNTHESIS_PROMPT(date, anyWebSearch),
        bypassLengthCheck: true,
        maxOutputTokens: 'model-max',
        carefulReasoning,
      })


      const synthesis = getReply(result)
        ?? tpl(uiText.synthFailed, { error: describeChatFailure(result, uiText.errorUnknown) })

      onStepComplete(synthMsgId, synthesis, true)
      // Pipeline finished — clear the resume snapshot so the renderer hides
      // the "Tiếp tục nghiên cứu" button.
      onResumeStateChange?.(null)
    } catch (err) {
      const e = err instanceof Error ? err.message : uiText.errorSynth
      onStepError(synthMsgId, e)
      throw err
    }
  },
}

