import React from 'react'
import {
  IconBrandClaude,
  IconBrandGemini,
  IconBrandGroq,
  IconBrandOpenAI,
} from './icons/AppIcons'

interface ProviderIconProps {
  provider: string
  size?: number
}

type BrandIconComponent = React.ComponentType<{ size?: number; style?: React.CSSProperties }>

const PROVIDER_META: Record<string, { bg: string; color: string; Icon?: BrandIconComponent; label?: string }> = {
  gemini: { bg: 'rgba(66,133,244,0.25)',   color: '#4285F4', Icon: IconBrandGemini },
  claude: { bg: 'rgba(217,119,87,0.25)',   color: '#D97757', Icon: IconBrandClaude },
  openai: { bg: 'rgba(16,163,127,0.25)',   color: '#10A37F', Icon: IconBrandOpenAI },
  groq:   { bg: 'rgba(248,160,0,0.25)',    color: '#F8A000', Icon: IconBrandGroq },
  local:  { bg: 'rgba(96,165,250,0.25)',   color: '#60A5FA', label: 'L' },
}

export default function ProviderIcon({ provider, size = 20 }: ProviderIconProps) {
  const meta = PROVIDER_META[provider] ?? { bg: 'rgba(107,114,128,0.25)', color: '#9CA3AF', label: '?' }
  const iconSize = Math.round(size * 0.62)

  return (
    <span style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: meta.bg,
      border: `1px solid ${meta.color}35`,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      color: meta.color,
      boxShadow: `0 0 0 1px rgba(255,255,255,0.08), 0 2px 6px rgba(0,0,0,0.25)`,
    }}>
      {meta.Icon
        ? <meta.Icon size={iconSize} style={{ color: meta.color }} />
        : <span style={{ fontSize: Math.max(7, Math.round(size * 0.42)), fontWeight: 700, letterSpacing: '-0.02em', color: meta.color }}>
            {meta.label}
          </span>
      }
    </span>
  )
}
