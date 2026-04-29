import { useCallback } from 'react'
import type { LiveSession, WindowApi } from '../../types'

export type LiveAiHistoryField = 'summary' | 'speakerAnalysis' | 'actionItems' | 'decisions'
export type LiveAiChatRequest = Parameters<WindowApi['chat']>[0]

export interface LiveAiActionConfig {
  setLoading: (loading: boolean) => void
  setOutput: (value: string | null) => void
  historyField: LiveAiHistoryField
  logLabel: string
  fallbackError: string
  request: LiveAiChatRequest
}

export function useLiveAiActions(
  updateLiveSession: (id: string, updates: Partial<LiveSession>) => void,
  getSessionId: () => string | null,
) {
  return useCallback(async ({
    setLoading,
    setOutput,
    historyField,
    logLabel,
    fallbackError,
    request,
  }: LiveAiActionConfig) => {
    setLoading(true)
    setOutput(null)

    try {
      const result = await window.api.chat(request)

      if (result.success && result.reply) {
        setOutput(result.reply)
        const sessionId = getSessionId()
        if (sessionId) {
          updateLiveSession(sessionId, { [historyField]: result.reply } as Partial<LiveSession>)
        }
      } else {
        const errMsg = result.error ?? fallbackError
        console.error(`[${logLabel}] Backend error:`, errMsg)
        setOutput(`Error: ${errMsg}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[${logLabel}] Exception:`, msg)
      setOutput(`Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [getSessionId, updateLiveSession])
}

