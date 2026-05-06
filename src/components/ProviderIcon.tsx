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

// Provider color map (neutral app tone)
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
    bg: 'bg-gray-50 dark:bg-neutral-800/70',
    bgActive: 'bg-gray-100 dark:bg-neutral-700/80',
    text: 'text-gray-700 dark:text-gray-300',
    textActive: 'text-gray-900 dark:text-gray-100',
    border: 'border-gray-200 dark:border-gray-700',
    borderActive: 'border-gray-400 dark:border-gray-500',
    dot: 'bg-gray-500',
    iconColor: '#4B5563',
  },
  claude: {
    bg: 'bg-gray-50 dark:bg-neutral-800/70',
    bgActive: 'bg-gray-100 dark:bg-neutral-700/80',
    text: 'text-gray-700 dark:text-gray-300',
    textActive: 'text-gray-900 dark:text-gray-100',
    border: 'border-gray-200 dark:border-gray-700',
    borderActive: 'border-gray-400 dark:border-gray-500',
    dot: 'bg-gray-500',
    iconColor: '#4B5563',
  },
  openai: {
    bg: 'bg-gray-50 dark:bg-neutral-800/70',
    bgActive: 'bg-gray-100 dark:bg-neutral-700/80',
    text: 'text-gray-700 dark:text-gray-300',
    textActive: 'text-gray-900 dark:text-gray-100',
    border: 'border-gray-200 dark:border-gray-700',
    borderActive: 'border-gray-400 dark:border-gray-500',
    dot: 'bg-gray-500',
    iconColor: '#4B5563',
  },
  local: {
    bg: 'bg-gray-50 dark:bg-gray-800/70',
    bgActive: 'bg-gray-100 dark:bg-gray-700/80',
    text: 'text-gray-700 dark:text-gray-300',
    textActive: 'text-gray-900 dark:text-gray-100',
    border: 'border-gray-200 dark:border-gray-700',
    borderActive: 'border-gray-400 dark:border-gray-500',
    dot: 'bg-gray-500',
    iconColor: '#4B5563',
  },
}
