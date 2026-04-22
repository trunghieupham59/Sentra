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
}

export function HistoryEmptyState({ icon, title, desc }: HistoryEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{desc}</p>
      </div>
    </div>
  )
}
