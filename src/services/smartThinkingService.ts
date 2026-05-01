/**
 * Smart Thinking Service — automatic, AI-decides-when-to-search.
 *
 * This is the DEFAULT path for normal chat (text-only, not Deep Research).
 * The user does NOT toggle it on or off — every message just runs through here,
 * and the AI itself decides whether a web search is needed.
 *
 * Pipeline:
 *   Step 1 — Classify (one cheap call, JSON output):
 *     AI looks at the latest user message + recent context, returns
 *     { needs_web, query, reason }.
 *
 *     Heuristics that trigger needs_web=true:
 *       • Time-sensitive: prices, weather, news, sports, "today/now/this week"
 *       • Year/date that may be after training cutoff (e.g. 2025+)
 *       • Specific real-world facts: rankings, statistics, releases, version numbers
 *       • Brand-new products, people, terms
 *       • Verifying claims, recent events
 *
 *     Should NOT trigger: pure logic, code, math, opinions, general explanations,
 *     anything the model already knows confidently.
 *
 *   Step 2a — needs_web=true:
 *     Run ONE web search (existing webSearch IPC, multi-provider with Jina fallback).
 *     Show a small collapsible search step bubble with the sources found.
 *     Stream the final answer with web results injected into the system prompt.
 *
 *   Step 2b — needs_web=false:
 *     Skip the step bubble entirely; just stream a normal answer using full
 *     conversation history. Indistinguishable from a plain chat reply.
 *
 * Compared to Deep Research:
 *   • 1–2 AI calls (vs 6–10+)
 *   • At most 1 web search (vs 4–8)
 *   • Streams the final answer
 *   • Best for everyday questions; Deep Research is opt-in for thorough reports.
 */
import type { ChatMessage as IpcChatMessage } from './chatService'
import { chatService } from './chatService'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SEARCH_RESULTS = 8
const MAX_SEARCH_CONTEXT_CHARS = 8000
const MAX_CLASSIFIER_CONTEXT_MESSAGES = 8
const MAX_CLASSIFIER_CONTEXT_CHARS = 4000

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SmartThinkingCallbacks {
  /** Called only when the AI decides to web-search. Returns the bubble id. */
  onStepStart: (label: string) => string
  /** Called when the search step finishes successfully. */
  onStepComplete: (msgId: string, content: string) => void
  /** Called when the search step errors out. */
  onStepError: (msgId: string, error: string) => void

  /** Called when the FINAL answer bubble is created. Returns the message id. */
  onAnswerStart: () => string
  /** Streamed token callback for the final answer. `content` is the cumulative text. */
  onAnswerToken: (msgId: string, content: string) => void
  /** Called when the final answer completes successfully. */
  onAnswerComplete: (msgId: string, content: string) => void
  /** Called when the final answer errors. */
  onAnswerError: (msgId: string, error: string, errorCode?: string) => void
}

export interface SmartThinkingUiText {
  webSearchStepLabelPrefix: string
  webSearchSummaryTitle: string
  webSearchDefaultReason: string
  webSearchSourcesTitle: string
  webSearchNoSources: string
  webSearchNoResults: string
  webSearchErrorFallback: string
  noResponseError: string
  unknownError: string
}

export interface SmartThinkingParams {
  provider: string
  model: string
  /** Latest user question (the message just sent). */
  question: string
  /**
   * Full IPC-shaped conversation history (including the latest user message).
   * Used for the FINAL streaming answer and the routing classifier so
   * multi-turn references such as "this news" or "tin này" keep their target.
   */
  messages: IpcChatMessage[]
  systemPrompt?: string
  uiText: SmartThinkingUiText
  callbacks: SmartThinkingCallbacks
}

interface ClassifyResult {
  needsWeb: boolean
  query: string
  reason: string
  answerFocus: string
  sourceGuidance: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getDate = () => {
  const locale = typeof navigator !== 'undefined' ? navigator.language : undefined
  return new Date().toLocaleString(locale, { dateStyle: 'full', timeStyle: 'short' })
}

const hasWebSearch = () =>
  typeof window !== 'undefined' && typeof window.api?.webSearch === 'function'

function formatSearchResults(
  results: Array<{ title: string; url: string; content: string; score: number }>,
  answer: string | undefined,
  summaryTitle: string,
): string {
  const lines: string[] = []
  if (answer) lines.push(`**${summaryTitle}:** ${answer}`, '')
  results.forEach((r, i) => {
    lines.push(
      `**[${i + 1}] ${r.title}**`,
      `URL: ${r.url}`,
      r.content.slice(0, 700),
      '',
    )
  })
  return lines.join('\n').slice(0, MAX_SEARCH_CONTEXT_CHARS)
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function composeSearchQuery(question: string, plannedQuery: string): string {
  const normalizedQuestion = normalizeWhitespace(question)
  const normalizedPlan = normalizeWhitespace(plannedQuery)
  if (!normalizedPlan) return normalizedQuestion.slice(0, 200)

  const lowerQuestion = normalizedQuestion.toLowerCase()
  const lowerPlan = normalizedPlan.toLowerCase()
  const query = lowerQuestion.includes(lowerPlan)
    ? normalizedQuestion
    : `${normalizedQuestion} ${normalizedPlan}`
  return query.slice(0, 200)
}

function messageText(message: IpcChatMessage): string {
  return message.content
    .map((content) => {
      if (content.type === 'text') return normalizeWhitespace(content.text ?? '')
      if (content.type === 'image') return '[image]'
      return ''
    })
    .filter(Boolean)
    .join(' ')
}

function formatClassifierContext(messages: IpcChatMessage[], fallbackQuestion: string): string {
  const formatted = messages
    .slice(-MAX_CLASSIFIER_CONTEXT_MESSAGES)
    .map((message) => {
      const text = messageText(message)
      if (!text) return ''
      return `${message.role.toUpperCase()}: ${text}`
    })
    .filter(Boolean)

  if (!formatted.length) return `USER: ${normalizeWhitespace(fallbackQuestion)}`

  const selected: string[] = []
  let total = 0
  for (let i = formatted.length - 1; i >= 0; i--) {
    const line = formatted[i]
    const nextTotal = total + line.length + 1
    if (selected.length > 0 && nextTotal > MAX_CLASSIFIER_CONTEXT_CHARS) break
    selected.unshift(line)
    total = nextTotal
  }

  return selected.join('\n')
}

/**
 * Remove a trailing "Sources / References / <localized title>" section that the
 * AI may have appended despite our instructions. We strip from the last heading-like
 * line that contains one of the known section titles to the end of the message.
 *
 * Recognised triggers (case-insensitive):
 *   - The exact localised sources title (e.g. "Nguồn tìm được", "Sources found")
 *   - English fallbacks: "Sources", "References", "Citations"
 *   - Lines that start with "[1]" / "[2]" markdown reference style at the very end
 */
function stripTrailingSourcesSection(text: string, localizedTitle: string): string {
  if (!text) return text
  const titles = [
    localizedTitle,
    'Sources found',
    'Sources',
    'References',
    'Citations',
    'Nguồn tìm được',
    'Nguồn tham khảo',
    '見つかったソース',
    'ソース',
  ]
    .map((t) => t.trim())
    .filter(Boolean)

  const lines = text.split('\n')
  let cutIndex = -1

  // Walk from the end backwards looking for a heading/bold line that introduces a sources block.
  for (let i = lines.length - 1; i >= 0; i--) {
    const raw = lines[i]
    const stripped = raw.trim().replace(/^[#>\s*_:`-]+|[\s*_:`-]+$/g, '').toLowerCase()
    if (!stripped) continue
    const matched = titles.some((title) => {
      const t = title.toLowerCase()
      return stripped === t || stripped.startsWith(`${t}:`) || stripped === `**${t}**`
    })
    if (matched) {
      cutIndex = i
      // also drop a separator like "---" right above the heading
      if (i > 0 && /^\s*-{3,}\s*$/.test(lines[i - 1])) cutIndex = i - 1
      break
    }
  }

  if (cutIndex >= 0) {
    return lines.slice(0, cutIndex).join('\n').trimEnd()
  }

  // Fallback: strip a tail block that is purely "[N] http..." reference list
  let tailStart = lines.length
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trim()
    if (!t) continue
    if (/^\[\d+\]\s+https?:\/\//i.test(t)) {
      tailStart = i
      continue
    }
    break
  }
  if (tailStart < lines.length) {
    let end = tailStart
    if (end > 0 && /^\s*-{3,}\s*$/.test(lines[end - 1])) end -= 1
    return lines.slice(0, end).join('\n').trimEnd()
  }

  return text
}

async function runWebSearch(query: string, uiText: SmartThinkingUiText): Promise<{
  context: string
  sourcesMarkdown: string
}> {
  if (!hasWebSearch()) return { context: '', sourcesMarkdown: '' }
  try {
    const result = await window.api.webSearch({
      query: query.slice(0, 200),
      maxResults: MAX_SEARCH_RESULTS,
    })
    if (result.success && result.results?.length) {
      const context = formatSearchResults(result.results, result.answer, uiText.webSearchSummaryTitle)
      const sourcesMarkdown = result.results
        .map((r, i) => `${i + 1}. [${r.title || r.url}](${r.url})`)
        .join('\n')
      return { context, sourcesMarkdown }
    }
  } catch {
    /* ignore — empty context returned */
  }
  return { context: '', sourcesMarkdown: '' }
}

// ─── Prompts (English to keep classifier output stable) ──────────────────────

const CLASSIFY_PROMPT = (date: string) =>
  `You are a smart routing and search-planning classifier. Current time: ${date}.
Decide whether the user's latest question REQUIRES a real-time web search to answer accurately.
Before deciding, identify the exact answer target: who, what, when, where, how many, comparison, or explanation.

Return needs_web = TRUE when an accurate answer depends on external information that can change over time,
recent or real-time facts, specific published facts, or verification against current sources.

Return needs_web = FALSE for:
  • General knowledge that does not change (history, science fundamentals, math)
  • Coding, logic, language tasks (translation, grammar)
  • Opinions, brainstorming, creative writing
  • Concepts that have been stable for years
  • Follow-up questions answered by earlier conversation context

Query rules when needs_web=true:
  • Preserve the user's exact intent and requested answer target.
  • Keep the key entity, relationship, requested attribute, and time qualifier.
  • Do not replace the requested attribute with a nearby topic.
  • Resolve pronouns and follow-up references from recent conversation context.
  • If the latest question says "this", "that", "tin này", "việc này", etc.,
    make the query about the concrete topic or claim referenced earlier.
  • State what source quality is needed in source_guidance.

Return ONLY valid JSON, no other text:
{"needs_web": true/false, "query": "concise 1-line web search query in user's language", "reason": "very brief reason (max 1 sentence)", "answer_focus": "what the final answer must directly provide", "source_guidance": "what source quality is needed"}

If needs_web=false, set query to an empty string.`

const WEB_AUGMENTED_PROMPT_PREFIX = (
  date: string,
  webContext: string,
  options: {
    userSystemPrompt?: string
    answerFocus?: string
    sourceGuidance?: string
    sourcesTitle: string
  },
) => {
  const userSystemPrompt = options.userSystemPrompt
  const answerFocus = options.answerFocus?.trim()
  const sourceGuidance = options.sourceGuidance?.trim()
  const sourcesTitle = options.sourcesTitle.trim()

  return `${userSystemPrompt ? `${userSystemPrompt}\n\n---\n\n` : ''}You are a helpful assistant. Current time: ${date}.

I performed a web search for the user's latest message. Use these REAL-TIME results as the primary source — they are more recent than your training data:

━━━ WEB SEARCH RESULTS ━━━
${webContext}
━━━━━━━━━━━━━━━━━━━━━━━━━━

${answerFocus ? `Answer focus from the routing step: ${answerFocus}\n` : ''}${sourceGuidance ? `Source-quality guidance: ${sourceGuidance}\n` : ''}
Instructions:
  • Answer the exact question the user asked. If they ask "who", give names/people; if they ask "what", give entities or facts; do not answer only a nearby topic.
  • Evaluate source credibility from each result's URL, publisher, title, and content. Prefer primary or official sources when the topic needs them.
  • For current public roles, leadership positions, laws, prices, releases, and other time-sensitive facts, include the effective "as of" date when useful.
  • Prioritize the web data over your training knowledge when they conflict.
  • Cite sources inline using [1], [2], etc. matching the numbered results above.
  • DO NOT add a "${sourcesTitle}" / "Sources" / "References" section at the end. Do NOT list raw URLs at the end. The UI will append a clean source list automatically.
  • Reply in the same language as the user's latest question.
  • If the search results don't actually answer the question, say so honestly and state what is missing.`
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export const smartThinkingService = {
  async run({
    provider,
    model,
    question,
    messages,
    systemPrompt,
    uiText,
    callbacks,
  }: SmartThinkingParams): Promise<void> {
    const date = getDate()
    const {
      onStepStart,
      onStepComplete,
      onStepError,
      onAnswerStart,
      onAnswerToken,
      onAnswerComplete,
      onAnswerError,
    } = callbacks

    // ── Step 1: Classify (best-effort; failures fall through to no-search) ──
    let classify: ClassifyResult = {
      needsWeb: false,
      query: '',
      reason: '',
      answerFocus: '',
      sourceGuidance: '',
    }

    if (hasWebSearch()) {
      try {
        const classifierContext = formatClassifierContext(messages, question)
        const result = await chatService.send({
          provider,
          model,
          messages: [{
            role: 'user',
            content: [{
              type: 'text',
              text: [
                'Recent conversation, oldest to newest:',
                classifierContext,
                '',
                'Classify ONLY the latest USER message. Return JSON only.',
              ].join('\n'),
            }],
          }],
          systemPrompt: CLASSIFY_PROMPT(date),
          bypassLengthCheck: true,
        })
        const reply = result.success ? result.reply?.trim() : null
        if (reply) {
          const m = reply.match(/\{[\s\S]*\}/)
          if (m) {
            try {
              const p = JSON.parse(m[0])
              classify = {
                needsWeb: Boolean(p.needs_web),
                query: typeof p.query === 'string' ? p.query.trim() : '',
                reason: typeof p.reason === 'string' ? p.reason.trim() : '',
                answerFocus: typeof p.answer_focus === 'string' ? p.answer_focus.trim() : '',
                sourceGuidance: typeof p.source_guidance === 'string' ? p.source_guidance.trim() : '',
              }
            } catch {
              /* malformed JSON — keep defaults (no search) */
            }
          }
        }
      } catch {
        /* classifier failed — fall through to plain chat */
      }
    }
    if (classify.needsWeb) {
      classify.query = composeSearchQuery(question, classify.query)
    }

    // ── Step 2a: Web search (if AI asked for one) ───────────────────────────
    let webContext = ''
    let webSourcesMarkdown = ''

    if (classify.needsWeb && classify.query) {
      const stepLabel = `${uiText.webSearchStepLabelPrefix} ${classify.query}`.trim()
      const stepMsgId = onStepStart(stepLabel)

      try {
        const { context, sourcesMarkdown } = await runWebSearch(classify.query, uiText)
        webContext = context
        webSourcesMarkdown = sourcesMarkdown

        if (context) {
          const stepBody = [
            `_${uiText.webSearchDefaultReason}_`,
            '',
            `**${uiText.webSearchSourcesTitle}:**`,
            sourcesMarkdown || `_${uiText.webSearchNoSources}_`,
          ].join('\n')
          onStepComplete(stepMsgId, stepBody)
        } else {
          onStepComplete(stepMsgId, `_${uiText.webSearchNoResults}_`)
        }
      } catch (err) {
        onStepError(stepMsgId, err instanceof Error ? err.message : uiText.webSearchErrorFallback)
      }
    }

    // ── Step 2b: Stream final answer (with full conversation history) ───────
    const answerMsgId = onAnswerStart()
    const finalSystemPrompt = webContext
      ? WEB_AUGMENTED_PROMPT_PREFIX(date, webContext, {
          userSystemPrompt: systemPrompt,
          answerFocus: classify.answerFocus,
          sourceGuidance: classify.sourceGuidance,
          sourcesTitle: uiText.webSearchSourcesTitle,
        })
      : systemPrompt || undefined

    let streamed = ''

    try {
      const result = await chatService.stream(
        {
          provider,
          model,
          messages,
          systemPrompt: finalSystemPrompt,
          // Web context can be long — bypass the standard length check
          bypassLengthCheck: Boolean(webContext),
        },
        {
          onToken: (token) => {
            streamed += token
            onAnswerToken(answerMsgId, streamed)
          },
        },
      )

      if (result.success && result.reply) {
        let final = result.reply
        if (webContext && webSourcesMarkdown) {
          // Strip any AI-generated sources/references section (raw URL list)
          // so we always end with a single clean, titled link list.
          final = stripTrailingSourcesSection(final, uiText.webSearchSourcesTitle)
          final = `${final}\n\n---\n**${uiText.webSearchSourcesTitle}**\n${webSourcesMarkdown}`
        }
        onAnswerComplete(answerMsgId, final)
      } else {
        onAnswerError(answerMsgId, result.error || uiText.noResponseError, result.errorCode)
      }
    } catch (err) {
      onAnswerError(answerMsgId, err instanceof Error ? err.message : uiText.unknownError)
    }
  },
}
