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
 *     Show a small collapsible "🔍 query" step bubble with the sources found.
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

const MAX_SEARCH_RESULTS = 5
const MAX_SEARCH_CONTEXT_CHARS = 4000

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
  onAnswerError: (msgId: string, error: string) => void
}

export interface SmartThinkingParams {
  provider: string
  model: string
  /** Latest user question (the message just sent). */
  question: string
  /**
   * Full IPC-shaped conversation history (including the latest user message).
   * Used for the FINAL streaming answer so multi-turn chat keeps working.
   * The classifier only reads the latest question for speed.
   */
  messages: IpcChatMessage[]
  systemPrompt?: string
  callbacks: SmartThinkingCallbacks
}

interface ClassifyResult {
  needsWeb: boolean
  query: string
  reason: string
}

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
    lines.push(
      `**[${i + 1}] ${r.title}**`,
      `URL: ${r.url}`,
      r.content.slice(0, 700),
      '',
    )
  })
  return lines.join('\n').slice(0, MAX_SEARCH_CONTEXT_CHARS)
}

async function runWebSearch(query: string): Promise<{
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
      const context = formatSearchResults(result.results, result.answer)
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
  `You are a smart routing classifier. Current time: ${date}.
Decide whether the user's latest question REQUIRES a real-time web search to answer accurately.

Return needs_web = TRUE if ANY of these apply:
  • Asks about events, news, prices, weather, sports, releases happening NOW or recently
  • References a year/date that might be AFTER your training cutoff (e.g. 2025, 2026, "this year", "last week")
  • Asks for specific current statistics, rankings, leaderboards, version numbers
  • Asks "what is X?" where X is a brand-new product, person, company, or recent term
  • User explicitly asks to verify a claim or fact
  • Anything time-sensitive: "today", "now", "currently", "latest", "real-time"

Return needs_web = FALSE for:
  • General knowledge that does not change (history, science fundamentals, math)
  • Coding, logic, language tasks (translation, grammar)
  • Opinions, brainstorming, creative writing
  • Concepts that have been stable for years
  • Follow-up questions answered by earlier conversation context

Return ONLY valid JSON, no other text:
{"needs_web": true/false, "query": "concise 1-line web search query in user's language", "reason": "very brief reason (max 1 sentence)"}

If needs_web=false, set query to an empty string.`

const WEB_AUGMENTED_PROMPT_PREFIX = (
  date: string,
  webContext: string,
  userSystemPrompt?: string,
) => `${userSystemPrompt ? `${userSystemPrompt}\n\n---\n\n` : ''}You are a helpful assistant. Current time: ${date}.

I performed a web search for the user's latest message. Use these REAL-TIME results as the primary source — they are more recent than your training data:

━━━ WEB SEARCH RESULTS ━━━
${webContext}
━━━━━━━━━━━━━━━━━━━━━━━━━━

Instructions:
  • Answer the user's question directly and naturally — do NOT preface with "based on the web results".
  • Prioritize the web data over your training knowledge when they conflict.
  • Cite sources inline using [1], [2], etc. matching the numbered results above.
  • At the end, add a short "**Nguồn / Sources**" section listing the URLs you cited.
  • Reply in the same language as the user's latest question.
  • If the search results don't actually answer the question, say so honestly.`

// ─── Main pipeline ────────────────────────────────────────────────────────────

export const smartThinkingService = {
  async run({
    provider,
    model,
    question,
    messages,
    systemPrompt,
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
    let classify: ClassifyResult = { needsWeb: false, query: '', reason: '' }

    if (hasWebSearch()) {
      try {
        const result = await chatService.send({
          provider,
          model,
          messages: [{ role: 'user', content: [{ type: 'text', text: question }] }],
          systemPrompt: CLASSIFY_PROMPT(date),
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

    // ── Step 2a: Web search (if AI asked for one) ───────────────────────────
    let webContext = ''
    let webSourcesMarkdown = ''

    if (classify.needsWeb && classify.query) {
      const stepLabel = `🔍 ${classify.query}`
      const stepMsgId = onStepStart(stepLabel)

      try {
        const { context, sourcesMarkdown } = await runWebSearch(classify.query)
        webContext = context
        webSourcesMarkdown = sourcesMarkdown

        if (context) {
          const stepBody = [
            classify.reason
              ? `_${classify.reason}_`
              : '_AI quyết định cần tìm web để trả lời chính xác._',
            '',
            '**Nguồn tìm được:**',
            sourcesMarkdown || '_(không có)_',
          ].join('\n')
          onStepComplete(stepMsgId, stepBody)
        } else {
          onStepComplete(
            stepMsgId,
            '_Không tìm thấy kết quả web phù hợp — sẽ trả lời từ kiến thức nội tại._',
          )
        }
      } catch (err) {
        onStepError(stepMsgId, err instanceof Error ? err.message : 'Web search lỗi')
      }
    }

    // ── Step 2b: Stream final answer (with full conversation history) ───────
    const answerMsgId = onAnswerStart()
    const finalSystemPrompt = webContext
      ? WEB_AUGMENTED_PROMPT_PREFIX(date, webContext, systemPrompt)
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
        // If we did a web search and the AI didn't already cite sources, append them
        if (webContext && webSourcesMarkdown && !/nguồn|sources/i.test(final.slice(-300))) {
          final = `${final}\n\n---\n**Nguồn / Sources**\n${webSourcesMarkdown}`
        }
        onAnswerComplete(answerMsgId, final)
      } else {
        onAnswerError(answerMsgId, result.error || 'Không nhận được phản hồi')
      }
    } catch (err) {
      onAnswerError(answerMsgId, err instanceof Error ? err.message : 'Lỗi không xác định')
    }
  },
}
