import type { Provider } from '../types'
import { ClaudeProviderIcon, GeminiProviderIcon, LocalProviderIcon, OpenAIProviderIcon } from './ui/icons'

// SPLIT-ICON-01: SVG icon definitions moved to src/components/ui/icons/providers.tsx
// ProviderIcon.tsx now only holds the wrapper component and PROVIDER_COLORS map.

interface ProviderIconProps {
  provider: Provider
  size?: number
  className?: string
}

export function ProviderIcon({ provider, size = 20, className = '' }: ProviderIconProps) {
  return (
    <span className={`inline-flex items-center justify-center flex-shrink-0 ${className}`}>
      {provider === 'gemini' && <GeminiProviderIcon size={size} />}
      {provider === 'claude' && <ClaudeProviderIcon size={size} />}
      {provider === 'openai' && <OpenAIProviderIcon size={size} />}
      {provider === 'local' && <LocalProviderIcon size={size} />}
    </span>
  )
}

// Provider color map (flat, no gradients)
export const PROVIDER_COLORS: Record<Provider, {
  bg: string
  bgActive: string
  text: string
  textActive: string
  border: string
  borderActive: string
  dot: string
  iconColor: string
}> = {
  gemini: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    bgActive: 'bg-blue-100 dark:bg-blue-900/60',
    text: 'text-blue-600 dark:text-blue-400',
    textActive: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    borderActive: 'border-blue-400 dark:border-blue-600',
    dot: 'bg-blue-500',
    iconColor: '#1A73E8',
  },
  claude: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    bgActive: 'bg-amber-100 dark:bg-amber-900/60',
    text: 'text-amber-700 dark:text-amber-400',
    textActive: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    borderActive: 'border-amber-400 dark:border-amber-600',
    dot: 'bg-amber-500',
    iconColor: '#D97706',
  },
  openai: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    bgActive: 'bg-emerald-100 dark:bg-emerald-900/60',
    text: 'text-emerald-700 dark:text-emerald-400',
    textActive: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    borderActive: 'border-emerald-400 dark:border-emerald-600',
    dot: 'bg-emerald-500',
    iconColor: '#10A37F',
  },
  local: {
    bg: 'bg-gray-50 dark:bg-gray-800/70',
    bgActive: 'bg-gray-100 dark:bg-gray-700/80',
    text: 'text-gray-700 dark:text-gray-300',
    textActive: 'text-gray-900 dark:text-gray-100',
    border: 'border-gray-200 dark:border-gray-700',
    borderActive: 'border-gray-400 dark:border-gray-500',
    dot: 'bg-gray-500',
    iconColor: '#6B7280',
  },
}
