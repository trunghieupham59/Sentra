/**
 * Cost-tracking icons.
 * Used in the Cost Tracking dashboard, currency picker, and per-provider stats.
 */
import type { IconProps } from './types'

export function CoinsIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <ellipse cx="9" cy="7" rx="6" ry="2.5" strokeWidth={1.8} />
      <path d="M3 7v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V7" strokeWidth={1.8} />
      <path d="M3 11v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4" strokeWidth={1.8} />
      <ellipse cx="16.5" cy="14" rx="4.5" ry="2" strokeWidth={1.8} />
      <path d="M12 14v3c0 1.1 2 2 4.5 2s4.5-.9 4.5-2v-3" strokeWidth={1.8} />
    </svg>
  )
}

export function ChartBarIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  )
}

export function PulseIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M3 12h4l2-6 4 12 2-6h6" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CalculatorIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" strokeWidth={1.8} />
      <path d="M9 7h6" strokeWidth={1.8} strokeLinecap="round" />
      <circle cx="9" cy="12" r="0.6" fill="currentColor" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
      <circle cx="15" cy="12" r="0.6" fill="currentColor" />
      <circle cx="9" cy="16" r="0.6" fill="currentColor" />
      <circle cx="12" cy="16" r="0.6" fill="currentColor" />
      <circle cx="15" cy="16" r="0.6" fill="currentColor" />
    </svg>
  )
}
