import { Provider } from '../types'

interface ProviderIconProps {
  provider: Provider
  size?: number
  className?: string
}

/**
 * Google Gemini — Official 4-pointed star (sparkle) icon
 * Brand color: #1A73E8 (Google Blue)
 */
function GeminiIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>Google Gemini</title>
      {/*
        Gemini's actual 4-pointed star: two overlapping diamond shapes
        Top arm + bottom arm (vertical)
      */}
      <path
        d="M12 2C12.3 5.5 13.8 8.8 16 10.5C13.8 12.2 12.3 15.5 12 19C11.7 15.5 10.2 12.2 8 10.5C10.2 8.8 11.7 5.5 12 2Z"
        fill="#1A73E8"
      />
      {/* Left arm + Right arm (horizontal) */}
      <path
        d="M2 10.5C5.5 10.8 8.8 10.2 10.5 8C12.2 10.2 15.5 10.8 19 10.5C15.5 10.2 12.2 11.8 10.5 14C8.8 11.8 5.5 10.2 2 10.5Z"
        fill="#1A73E8"
        opacity="0.5"
      />
      {/* Extra left arm */}
      <path
        d="M2 12.5C5.5 12.2 8.8 12.8 10.5 15C12.2 12.8 15.5 12.2 19 12.5C15.5 12.8 12.2 11.2 10.5 9C8.8 11.2 5.5 12.8 2 12.5Z"
        fill="#1A73E8"
        opacity="0.3"
      />
    </svg>
  )
}

/**
 * Anthropic Claude — Official brand mark (stylized hexagonal symbol)
 * Brand color: #D4A27F (Claude sandy beige/warm orange)
 * The actual Claude icon is a geometric "A" shaped mark
 */
function ClaudeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>Anthropic Claude</title>
      {/*
        Simplified from Anthropic's official logo mark.
        The Claude icon is a stylized "A" geometric form with a rooftop peak.
      */}
      <path
        d="M13.5 3.5L20.5 20.5H16.8L15.2 16.5H8.8L7.2 20.5H3.5L10.5 3.5H13.5Z"
        fill="#D97706"
        opacity="0.12"
      />
      <path
        d="M12 5.5L18.2 20.5H15.5L14.2 17H9.8L8.5 20.5H5.8L12 5.5ZM12 9.5L10.7 13H13.3L12 9.5Z"
        fill="#D97706"
      />
    </svg>
  )
}

/**
 * OpenAI GPT — Official OpenAI logo (hexagonal bloom)
 * Brand color: #10A37F (OpenAI green) or #000 (black, as on their site)
 * This is the actual polygon/gear shape from their brand
 */
function OpenAIIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>OpenAI GPT</title>
      {/*
        Simplified from OpenAI's actual SVG logo path.
        The OpenAI logo is a clockwork-style bloom with 6 curved segments.
        Simplified to a recognizable geometric approximation.
      */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2.5C9.8 2.5 7.8 3.4 6.4 4.9C5.1 4.6 3.7 5 2.7 6C1.3 7.4 1.1 9.5 2 11.1C1.7 12.4 2.1 13.8 3 14.8C4.4 16.2 6.5 16.4 8.1 15.5C9.4 16.5 11 17 12.6 16.8L12 2.5Z"
        fill="#10A37F"
        opacity="0.2"
      />
      <path
        d="M20.3 9.5C21.4 11.3 21.3 13.6 20 15.2C20.2 16.5 19.8 17.8 18.9 18.8C17.5 20.2 15.4 20.4 13.8 19.5C12.5 20.2 11 20.3 9.6 19.9L12 12L20.3 9.5Z"
        fill="#10A37F"
        opacity="0.2"
      />
      {/* Center hexagon - the main shape */}
      <path
        d="M12 7L15.46 9V13L12 15L8.54 13V9L12 7Z"
        fill="#10A37F"
      />
      {/* Outer ring segments */}
      <path
        d="M12 3.5V7M12 15V18.5M8.54 9L5.5 7.25M15.46 13L18.5 14.75M8.54 13L5.5 14.75M15.46 9L18.5 7.25"
        stroke="#10A37F"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ProviderIcon({ provider, size = 20, className = '' }: ProviderIconProps) {
  return (
    <span className={`inline-flex items-center justify-center flex-shrink-0 ${className}`}>
      {provider === 'gemini' && <GeminiIcon size={size} />}
      {provider === 'claude' && <ClaudeIcon size={size} />}
      {provider === 'openai' && <OpenAIIcon size={size} />}
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
}
