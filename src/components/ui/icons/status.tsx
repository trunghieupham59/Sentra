/**
 * Status & indicator icons — warnings, selection state, info hints,
 * AI insights, bot/provider fallbacks, and user avatars.
 */
import type { IconProps } from './types'

/** Alert triangle / warning icon — used on error and warning states. */
export function AlertTriangleIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}

/** Circle-check / radio selected icon — used to indicate the active/selected item. */
export function RadioCheckedIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd"
        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
        clipRule="evenodd" />
    </svg>
  )
}

/** Info circle icon — used on informational hints and notices. */
export function InfoCircleIcon({ className = 'w-3.5 h-3.5' }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

/** Sparkles icon — used on Smart Thinking / AI auto-decide features. */
export function SparklesIcon({ className = 'w-3.5 h-3.5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19 14l.7 1.9L21.5 16.5l-1.8.6L19 19l-.7-1.9L16.5 16.5l1.8-.6L19 14z" />
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M5 16l.6 1.6 1.6.6-1.6.6L5 20.4l-.6-1.6-1.6-.6 1.6-.6L5 16z" />
    </svg>
  )
}

/** Lightbulb icon — used on summarize / AI insight buttons. */
export function LightbulbIcon({ className = 'w-3.5 h-3.5' }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  )
}

/** Auto mode icon — used when the app picks the best available provider. */
export function AutoModeIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 7.25H14.5C16.9853 7.25 19 9.26472 19 11.75C19 14.2353 16.9853 16.25 14.5 16.25H9"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 4.75L5.5 7.25L8 9.75"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.75 13.75L18.25 16.25L15.75 18.75"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 10.25L12.15 11.55L13.5 12.25L12.15 12.95L11.5 14.25L10.85 12.95L9.5 12.25L10.85 11.55L11.5 10.25Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Premium mode icon — used for high-quality paid provider preference. */
export function PremiumModeIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.75L14.2 8.35L19.25 9.05L15.6 12.65L16.5 17.7L12 15.3L7.5 17.7L8.4 12.65L4.75 9.05L9.8 8.35L12 3.75Z"
        fill="currentColor"
        opacity="0.16"
      />
      <path
        d="M12 3.75L14.2 8.35L19.25 9.05L15.6 12.65L16.5 17.7L12 15.3L7.5 17.7L8.4 12.65L4.75 9.05L9.8 8.35L12 3.75Z"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 8.7V12.1L14.15 13.25"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Star icon — used for favorites. */
export function StarIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75l2.55 5.17 5.7.83-4.13 4.02.98 5.68L12 16.77l-5.1 2.68.98-5.68-4.13-4.02 5.7-.83L12 3.75z" />
    </svg>
  )
}

/** Check-circle / success icon — used on update-downloaded and success states. */
export function CheckCircleIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

/** User / person icon — used on user avatars. */
export function UserIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd"
        d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
        clipRule="evenodd" />
    </svg>
  )
}

/** Bot / assistant icon — used when no provider-specific icon is available. */
export function BotIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path
        d="M12 3v3m-5 4h10a3 3 0 013 3v4a3 3 0 01-3 3H7a3 3 0 01-3-3v-4a3 3 0 013-3z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
      <path d="M9 15h.01M15 15h.01" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} />
    </svg>
  )
}
