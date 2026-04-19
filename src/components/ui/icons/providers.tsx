/**
 * Provider icons — SVG brand icons for AI providers (Gemini, Claude, OpenAI).
 *
 * SPLIT-ICON-01: Moved from ProviderIcon.tsx into the centralized icon registry
 * so all SVG definitions are managed in one place.
 *
 * Usage:
 *   import { GeminiProviderIcon, ClaudeProviderIcon, OpenAIProviderIcon } from './ui/icons'
 */

/**
 * Google Gemini — Official 4-pointed star (sparkle) icon.
 * Brand color: #1A73E8 (Google Blue)
 */
export function GeminiProviderIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>Google Gemini</title>
      {/* Gemini's actual 4-pointed star: two overlapping diamond shapes */}
      {/* Top arm + bottom arm (vertical) */}
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
 * Anthropic Claude — Official brand mark (stylized geometric "A" shape).
 * Brand color: #D97706 (Claude warm amber/orange)
 */
export function ClaudeProviderIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>Anthropic Claude</title>
      {/* Simplified from Anthropic's official logo mark. */}
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
 * OpenAI GPT — Official OpenAI logo (hexagonal bloom).
 * Brand color: #10A37F (OpenAI green)
 */
export function OpenAIProviderIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>OpenAI GPT</title>
      {/* Simplified from OpenAI's actual SVG logo path. */}
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
