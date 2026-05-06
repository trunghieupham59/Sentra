/**
 * HistoryEmptyState — centered empty-state layout with an icon, title, and
 * description. Used in all three history tabs (Chat, Live, Translation).
 *
 * Extracted from src/pages/history/historyUtils.tsx.
 * Reusable: props-only, no business logic, domain-agnostic pattern.
 */
import type { ReactNode } from 'react'

interface HistoryEmptyStateProps {
  icon: ReactNode
  title: string
  desc: string
  tone?: 'neutral' | 'muted'
}

const toneClasses = {
  neutral: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600',
  muted: 'bg-gray-50 text-gray-400 dark:bg-gray-950/30 dark:text-gray-500',
}

export function HistoryEmptyState({ icon, title, desc, tone = 'neutral' }: HistoryEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8 py-12">
      <div className={`w-14 h-14 rounded-lg flex items-center justify-center ${toneClasses[tone]}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">{title}</p>
        <p className="text-xs text-gray-400 dark:text-gray-600 mt-1 max-w-sm">{desc}</p>
      </div>
    </div>
  )
}
