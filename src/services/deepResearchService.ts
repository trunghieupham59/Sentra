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
 */

import type { ChatMessageContent } from './chatService'
import { chatService } from './chatService'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum number of gap-analysis → targeted-search iterations */
const MAX_GAP_ITERATIONS = 2

/** Maximum number of gaps to chase per iteration */
const MAX_GAPS_PER_ROUND = 3

/** Maximum search results per query */
const MAX_SEARCH_RESULTS = 5

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeepResearchCallbacks {
  /** Called when a new step starts. Must return the generated message ID. */
  onStepStart: (label: string) => string
  /** Called when a step completes. `isFinal` = true only for the synthesis step. */
  onStepComplete: (msgId: string, content: string, isFinal: boolean) => void
  /** Called when a step fails with an error. */
  onStepError: (msgId: string, error: string) => void
}

export interface DeepResearchParams {
  provider: string
  model: string
  question: string
  images?: DeepResearchImageAttachment[]
  callbacks: DeepResearchCallbacks
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

const getDate = () =>
  new Date().toLocaleString('vi-VN', { dateStyle: 'full', timeStyle: 'short' })

const hasWebSearch = () =>
  typeof window !== 'undefined' && typeof window.api?.webSearch === 'function'

function formatSearchResults(
  results: Array<{ title: string; url: string; content: string; score: number }>,
  answer?: string,
): string {
  const lines: string[] = []
  if (answer) lines.push(`**Tóm tắt web:** ${answer}`, '')
  results.forEach((r, i) => {
    lines.push(`**[${i + 1}] ${r.title}**`, `URL: ${r.url}`, r.content.slice(0, 700), '')
  })
  return lines.join('\n')
}

async function webSearch(query: string): Promise<string> {
  if (!hasWebSearch()) return ''
  try {
    const result = await window.api.webSearch({ query: query.slice(0, 200), maxResults: MAX_SEARCH_RESULTS })
    if (result.success && result.results?.length) {
      return formatSearchResults(result.results, result.answer)
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
  if (result.success && !result.reply?.trim()) return 'AI trả về nội dung rỗng'
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
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`

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
  async run({ provider, model, question, images = [], callbacks }: DeepResearchParams): Promise<void> {
    const date = getDate()
    const webAvailable = hasWebSearch()
    const { onStepStart, onStepComplete, onStepError } = callbacks
    const hasImages = images.length > 0

    // Accumulated knowledge base (all findings from all phases)
    const knowledgeBase: Array<{ label: string; content: string }> = []
    let anyWebSearch = false
    let imageContext = ''
    let imageSearchTerms: string[] = []

    // ── Phase 1: Initial Analysis ─────────────────────────────────────────
    const analyzeMsgId = onStepStart('Phân tích câu hỏi')
    let aspects = DEFAULT_ASPECTS

    try {
      const result = await chatService.send({
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
      onStepError(analyzeMsgId, err instanceof Error ? err.message : 'Lỗi phân tích')
      throw err
    }

    const analyzeContent = [
      webAvailable ? '**Real-time mode** — Tìm kiếm web thực tế cho mỗi bước' : '**AI-only mode** — Không có Tavily key. Thêm key trong Settings → API Keys để bật web search.',
      '',
      `**Sẽ nghiên cứu ${aspects.length} khía cạnh, qua nhiều vòng lặp:**`,
      ...aspects.map((a, i) => `${i + 1}. ${a}`),
      ...(imageContext ? ['', `**Ngữ cảnh ảnh:** ${imageContext}`] : []),
      ...(imageSearchTerms.length > 0 ? [`**Từ khóa từ ảnh:** ${imageSearchTerms.join(', ')}`] : []),
    ].join('\n')
    onStepComplete(analyzeMsgId, analyzeContent, false)
    if (imageContext) {
      knowledgeBase.push({ label: 'Attached image context', content: imageContext })
    }

    // ── Phase 2: First-pass research (Breadth) ────────────────────────────
    for (const aspect of aspects) {
      const msgId = onStepStart(`Vòng 1 — Nghiên cứu: ${aspect}`)
      try {
        const webCtx = await webSearch(buildSearchQuery(aspect, question, imageContext, imageSearchTerms))
        if (webCtx) anyWebSearch = true

        const result = await chatService.send({
          provider, model,
          messages: [{ role: 'user', content: buildResearchContent(`Analyze this aspect: ${aspect}`, images) }],
          systemPrompt: RESEARCH_PROMPT(date, aspect, question, webCtx, imageContext),
        })
        const content = getReply(result) ?? `[Không thể phân tích: ${describeChatFailure(result, 'Lỗi không xác định')}]`
        knowledgeBase.push({ label: aspect, content })
        onStepComplete(msgId, content, false)
      } catch (err) {
        const e = err instanceof Error ? err.message : 'Lỗi'
        onStepError(msgId, e)
        knowledgeBase.push({ label: aspect, content: `[Lỗi: ${e}]` })
      }
    }

    // ── Phase 3: Gap Analysis Loop ────────────────────────────────────────
    for (let iteration = 1; iteration <= MAX_GAP_ITERATIONS; iteration++) {
      const allFindings = knowledgeBase
        .map((k, i) => `### ${i + 1}. ${k.label}\n${k.content}`)
        .join('\n\n---\n\n')

      // Ask AI: is the research complete? What's missing?
      const gapMsgId = onStepStart(`Đánh giá khoảng trống — Vòng ${iteration}`)
      let gapResult: GapAnalysisResult = { isComplete: true, gaps: [], queries: [] }

      try {
        const result = await chatService.send({
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
          ? `**Nghiên cứu đã đầy đủ** — Không phát hiện khoảng trống đáng kể. Tiến hành tổng hợp.`
          : [
              `**Phát hiện ${gapResult.gaps.length} khoảng trống cần bổ sung:**`,
              ...gapResult.gaps.map((g, i) => `${i + 1}. ${g}`),
            ].join('\n')

        onStepComplete(gapMsgId, gapContent, false)
      } catch (err) {
        onStepError(gapMsgId, err instanceof Error ? err.message : 'Lỗi đánh giá')
        gapResult.isComplete = true // fall through to synthesis on error
      }

      // If complete, stop the loop
      if (gapResult.isComplete || gapResult.queries.length === 0) break

      // Chase each gap with targeted search + analysis
      for (let g = 0; g < Math.min(gapResult.queries.length, MAX_GAPS_PER_ROUND); g++) {
        const query = gapResult.queries[g]
        const gapLabel = gapResult.gaps[g] ?? query
        const deepMsgId = onStepStart(`Nghiên cứu sâu: ${gapLabel}`)

        try {
          const webCtx = await webSearch(buildSearchQuery(query, question, imageContext, imageSearchTerms))
          if (webCtx) anyWebSearch = true

          const result = await chatService.send({
            provider, model,
            messages: [{ role: 'user', content: buildResearchContent(`Deep dive research: ${gapLabel}`, images) }],
            systemPrompt: RESEARCH_PROMPT(date, gapLabel, question, webCtx, imageContext),
          })
          const content = getReply(result) ?? `[Không thể nghiên cứu: ${describeChatFailure(result, 'Lỗi không xác định')}]`
          knowledgeBase.push({ label: `[Sâu hơn] ${gapLabel}`, content })
          onStepComplete(deepMsgId, content, false)
        } catch (err) {
          const e = err instanceof Error ? err.message : 'Lỗi'
          onStepError(deepMsgId, e)
          knowledgeBase.push({ label: gapLabel, content: `[Lỗi: ${e}]` })
        }
      }
    }

    // ── Phase 4: Cross-reference ──────────────────────────────────────────
    const crossMsgId = onStepStart('Kiểm chứng chéo')
    const allFindingsFinal = knowledgeBase
      .map((k, i) => `### ${i + 1}. ${k.label}\n${k.content}`)
      .join('\n\n---\n\n')

    let crossContent = ''
    try {
      const result = await chatService.send({
        provider, model,
        messages: [{ role: 'user', content: buildResearchContent(CROSS_REFERENCE_CONTENT(question, allFindingsFinal, imageContext), images) }],
        systemPrompt: CROSS_REFERENCE_PROMPT(date, anyWebSearch),
        bypassLengthCheck: true,
      })
      crossContent = getReply(result)
        ?? `Không thể thực hiện cross-reference: ${describeChatFailure(result, 'Lỗi không xác định')}.`
      onStepComplete(crossMsgId, crossContent, false)
    } catch (err) {
      const e = err instanceof Error ? err.message : 'Lỗi cross-reference'
      onStepError(crossMsgId, e)
      crossContent = `[Cross-reference thất bại: ${e}]`
    }

    // ── Phase 5: Final Synthesis ──────────────────────────────────────────
    const synthMsgId = onStepStart('Tổng hợp cuối cùng')

    const synthContext = [
      `## Research Findings (${knowledgeBase.length} sources)`,
      allFindingsFinal,
      '---',
      '## Cross-Reference Analysis',
      crossContent,
    ].join('\n\n')

    try {
      const result = await chatService.send({
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
      })

      const synthesis = getReply(result)
        ?? `Không thể tổng hợp (${describeChatFailure(result, 'Lỗi không xác định')}).`

      onStepComplete(synthMsgId, synthesis, true)
    } catch (err) {
      const e = err instanceof Error ? err.message : 'Lỗi tổng hợp'
      onStepError(synthMsgId, e)
      throw err
    }
  },
}
