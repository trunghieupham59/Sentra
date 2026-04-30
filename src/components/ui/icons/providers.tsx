/**
 * Provider icons — SVG brand icons for AI, speech, TTS, and web search providers.
 *
 * SPLIT-ICON-01: Moved from ProviderIcon.tsx into the centralized icon registry
 * so all SVG definitions are managed in one place.
 *
 * BRAND ACCURACY:
 * - GeminiProviderIcon: Official 4-pointed star (sparkle) with the Gemini brand
 *   gradient (blue → purple → pink), matching simpleicons.org "googlegemini".
 * - ClaudeProviderIcon: Official Anthropic Claude "spark" / 8-ray star mark in
 *   the brand warm coral color (#CC785C), matching the Claude product logo.
 * - OpenAIProviderIcon: Official OpenAI "knot" mark (the interlocking ring
 *   logo), matching simpleicons.org "openai".
 *
 * Usage:
 *   import { GeminiProviderIcon, ClaudeProviderIcon, OpenAIProviderIcon } from './ui/icons'
 *   import { GroqIcon, ElevenLabsIcon, MicrosoftEdgeIcon, TavilyIcon, BraveSearchIcon } from './ui/icons'
 */

/**
 * Local AI — Custom mark designed to sit visually alongside the cloud-AI
 * provider logos (Gemini sparkle, Claude starburst, OpenAI knot).
 *
 * Concept: a CPU/chip outline with the same 4-point AI "sparkle" used by
 * Gemini sitting at its core — semantically "AI sparkle on your own device".
 *
 * Color: neutral slate gray (#475569) so it reads as on-device hardware
 * rather than any specific brand. Slightly darker than the previous #6B7280
 * to give the mark equal visual weight to the colored brand logos.
 */
export function LocalProviderIcon({ size = 20 }: { size?: number }) {
  const color = '#475569' // slate-600 — neutral hardware tone
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>Local AI</title>
      {/* Soft chip body fill so the mark has presence at small sizes */}
      <rect x="4.5" y="4.5" width="15" height="15" rx="3.5" fill={color} opacity="0.12" />
      {/* CPU pins on all four sides (3 per side) */}
      <g stroke={color} strokeWidth="1.6" strokeLinecap="round">
        {/* top */}
        <path d="M9 2.5V4.5" />
        <path d="M12 2.5V4.5" />
        <path d="M15 2.5V4.5" />
        {/* bottom */}
        <path d="M9 19.5V21.5" />
        <path d="M12 19.5V21.5" />
        <path d="M15 19.5V21.5" />
        {/* left */}
        <path d="M2.5 9H4.5" />
        <path d="M2.5 12H4.5" />
        <path d="M2.5 15H4.5" />
        {/* right */}
        <path d="M19.5 9H21.5" />
        <path d="M19.5 12H21.5" />
        <path d="M19.5 15H21.5" />
      </g>
      {/* Chip outline */}
      <rect x="4.5" y="4.5" width="15" height="15" rx="3.5" stroke={color} strokeWidth="1.7" />
      {/*
        AI "sparkle" core — the same 4-point concave star used by the Gemini
        logo, scaled down (~42%) and re-centered inside the chip. This makes
        the Local AI mark visually echo the AI sparkle idiom while staying
        in a neutral on-device color.
      */}
      <path
        d="M12 17A5.96 5.96 0 0 0 7 12A5.96 5.96 0 0 0 12 7A5.96 5.96 0 0 0 17 12A5.96 5.96 0 0 0 12 17Z"
        fill={color}
      />
    </svg>
  )
}

/**
 * Google Gemini — Official 4-pointed star with rounded concave sides.
 * Path matches simpleicons.org "googlegemini" (24×24 viewBox).
 * Uses the official Gemini gradient: blue (#4285F4) → purple → pink.
 */
export function GeminiProviderIcon({ size = 20 }: { size?: number }) {
  // Use a unique gradient id per render so multiple instances don't clash.
  const gradientId = `gemini-gradient-${size}`
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>Google Gemini</title>
      <defs>
        <linearGradient id={gradientId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4285F4" />
          <stop offset="0.52" stopColor="#9B72F2" />
          <stop offset="1" stopColor="#D96570" />
        </linearGradient>
      </defs>
      <path
        d="M12 24A14.304 14.304 0 0 0 0 12 14.304 14.304 0 0 0 12 0a14.304 14.304 0 0 0 12 12 14.304 14.304 0 0 0-12 12Z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  )
}

/**
 * Anthropic Claude — Official Claude AI starburst / "spark" mark.
 * Path source: simpleicons.org "claudeai" (24×24 viewBox).
 * Brand color: #CC785C (Claude warm coral / "Clay").
 */
export function ClaudeProviderIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#CC785C" xmlns="http://www.w3.org/2000/svg">
      <title>Anthropic Claude</title>
      <path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128h-.23l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.448.255h.389l.054-.158-.133-.097-.103-.097-2.339-1.585-2.533-1.677-1.328-.965-.717-.487-.36-.456-.155-.992.645-.71.866.06.219.06.879.673 1.88 1.452 2.448 1.798.358.298.144-.103.018-.072-.16-.272-1.346-2.428-1.43-2.466-.638-1.025-.17-.616a2.948 2.948 0 0 1-.105-.722L1.51.39 2.045 0l1.296.073.426.054.674.616.99 2.265 1.605 3.566.249.495.13.456.05.14h.082V7.43L7.25 1.04l.067-.298.534-.182.535.255.225.503-.225 1.476-1.825 8.844.011.49.146.054.342-.121 1.413-1.91 2.351-2.95 1.044-1.18 1.225-1.302.781-.617h1.483l1.105 1.62-.495 1.673-1.546 1.97-1.281 1.659-1.83 2.466-1.146 1.96.106.158.275-.03 4.196-.91 2.265-.412 2.703-.467.91.42.105.43-.359.879-2.156.526-2.529.51-3.766.892-.045.04.05.057 1.69.157.722.043h1.766l3.291.245.86.575.515.687-.085.527-1.32.682-1.78-.42-4.165-.998-1.43-.358h-.197v.121l1.193 1.166 2.181 1.971 2.732 2.532.139.625-.349.49-.367-.054-2.379-1.798-.917-.81-2.082-1.755h-.139v.182l.482.71 2.539 3.808.13 1.166-.18.388-.658.224-.722-.133-1.486-2.078-1.532-2.345-1.236-2.114-.146.085-.732 7.876-.343.4-.793.298-.66-.504-.353-.815.353-1.616.421-2.111.343-1.679.31-2.084.18-.69-.012-.048-.146.018-1.5 2.062-2.282 3.083-1.81 1.937-.435.176-.755-.387.07-.687.418-.61 2.495-3.165 1.5-1.962.972-1.137-.006-.158h-.054L4.262 18.62l-1.788.225-.768-.061-.473-.557.06-.376.281-.297 2.336-1.605"/>
    </svg>
  )
}

/**
 * OpenAI — Official "knot" / interlocking ring logo (the hexagonal flower).
 * Path matches simpleicons.org "openai" (24×24 viewBox).
 * Brand color: #10A37F (OpenAI green) — also rendered in pure black on
 * marketing surfaces, but we keep the brand green for consistency with the
 * provider color palette in PROVIDER_COLORS.
 */
export function OpenAIProviderIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#10A37F" xmlns="http://www.w3.org/2000/svg">
      <title>OpenAI</title>
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.843-3.372L15.115 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.774 2.758a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  )
}

/**
 * Groq — public company wordmark.
 */
export function GroqIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={Math.round(size * 2.74)}
      height={size}
      viewBox="0 32.25 152 55.5"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Groq</title>
      <path d="M84.848 34.137c-9.798 0-17.769 7.971-17.769 17.77s7.971 17.769 17.769 17.769 17.77-7.971 17.77-17.769-7.973-17.77-17.77-17.77Zm0 28.876c-6.124 0-11.106-4.983-11.106-11.106S78.724 40.801 84.848 40.801s11.106 4.982 11.106 11.106-4.981 11.106-11.106 11.106Z" />
      <path d="M60.315 34.206a16.7 16.7 0 0 0-1.827-.108c-.304 0-.595.009-.893.014s-.594.033-.891.051a17.7 17.7 0 0 0-3.541.611c-2.329.629-4.574 1.723-6.515 3.277a16.5 16.5 0 0 0-4.611 5.859 17.3 17.3 0 0 0-1.165 3.567c-.121.608-.21 1.222-.266 1.84-.02.307-.055.615-.059.921l-.011.459-.005.23v.19l.015 5.951.015 5.951.041 5.95h6.664l.042-5.95.015-5.952.015-5.951v-.182l.005-.142.008-.285c0-.191.028-.375.039-.564.036-.37.091-.738.165-1.102a10.5 10.5 0 0 1 .678-2.077 10.3 10.3 0 0 1 2.673-3.419c1.156-.932 2.541-1.628 4.038-2.042.757-.207 1.532-.344 2.314-.408.198-.011.395-.03.594-.037s.402-.013.595-.012c.383 0 .76.025 1.142.06 1.518.153 2.989.619 4.318 1.368l3.326-5.776a17.3 17.3 0 0 0-6.915-2.258Z" />
      <path d="M17.77 34.048C7.971 34.048 0 42.019 0 51.817s7.971 17.77 17.77 17.77h5.844v-6.664H17.77c-6.124 0-11.106-4.982-11.106-11.106s4.982-11.106 11.106-11.106 11.132 4.982 11.132 11.106v16.365c0 6.084-4.954 11.039-11.023 11.103a10.84 10.84 0 0 1-7.729-3.25l-4.712 4.712a17.5 17.5 0 0 0 12.321 5.201v.003h.244v-.003c9.659-.131 17.48-8.005 17.525-17.686l.006-16.881c-.232-9.596-8.112-17.333-17.764-17.333Z" />
      <path d="M124.083 34.137c-9.798 0-17.769 7.971-17.769 17.77s7.971 17.769 17.769 17.769h6.08v-6.663h-6.08c-6.124 0-11.106-4.983-11.106-11.106s4.982-11.106 11.106-11.106c5.799 0 10.572 4.468 11.062 10.143h-.01v34.12h6.664V51.907c-.002-9.799-7.918-17.77-17.716-17.77Z" />
      <path d="M151.983 35.04h-.95l-1.296 2.013-1.338-2.013h-.959v3.584h1.071V36.88l.95 1.408h.518l.933-1.452.017 1.788H152l-.017-3.584ZM143.519 35.896h1.166v2.728h1.175v-2.728h1.174v-.856h-3.515v.856Z" />
    </svg>
  )
}

/**
 * ElevenLabs — official symbol.
 */
export function ElevenLabsIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 876 876" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>ElevenLabs</title>
      <path d="M468 292H528V584H468V292Z" fill="currentColor" />
      <path d="M348 292H408V584H348V292Z" fill="currentColor" />
    </svg>
  )
}

/**
 * Microsoft Edge — public Edge logo used since 2019.
 */
export function MicrosoftEdgeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>Microsoft Edge</title>
      <defs>
        <linearGradient id="edge-icon-a" x1="63.3" y1="84" x2="241.7" y2="84" gradientTransform="matrix(1 0 0 -1 0 266)" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0C59A4" />
          <stop offset="1" stopColor="#114A8B" />
        </linearGradient>
        <linearGradient id="edge-icon-c" x1="157.3" y1="161.4" x2="46" y2="40.1" gradientTransform="matrix(1 0 0 -1 0 266)" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1B9DE2" />
          <stop offset=".2" stopColor="#1595DF" />
          <stop offset=".7" stopColor="#0680D7" />
          <stop offset="1" stopColor="#0078D4" />
        </linearGradient>
        <radialGradient id="edge-icon-b" cx="161.8" cy="68.9" r="95.4" gradientTransform="matrix(1 0 0 -.95 0 248.8)" gradientUnits="userSpaceOnUse">
          <stop offset=".7" stopOpacity="0" />
          <stop offset=".9" stopOpacity=".5" />
          <stop offset="1" />
        </radialGradient>
        <radialGradient id="edge-icon-d" cx="-340.3" cy="63" r="143.2" gradientTransform="matrix(.15 -.99 -.8 -.12 176.6 -125.4)" gradientUnits="userSpaceOnUse">
          <stop offset=".8" stopOpacity="0" />
          <stop offset=".9" stopOpacity=".5" />
          <stop offset="1" />
        </radialGradient>
        <radialGradient id="edge-icon-e" cx="113.4" cy="570.2" r="202.4" gradientTransform="matrix(-.04 1 2.13 .08 -1179.5 -106.7)" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#35C1F1" />
          <stop offset=".1" stopColor="#34C1ED" />
          <stop offset=".2" stopColor="#2FC2DF" />
          <stop offset=".3" stopColor="#2BC3D2" />
          <stop offset=".7" stopColor="#36C752" />
        </radialGradient>
        <radialGradient id="edge-icon-f" cx="376.5" cy="568" r="97.3" gradientTransform="matrix(.28 .96 .78 -.23 -303.8 -148.5)" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#66EB6E" />
          <stop offset="1" stopColor="#66EB6E" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M235.7 195.5c-3.7 1.9-7.5 3.6-11.4 5a125 125 0 0 1-42.1 7.4c-58.1 0-108.6-39.8-122.3-96.5a128.5 128.5 0 0 1-3.7-30.8C56.2 39.1 89.8 5.3 131.1 5h.3c37.5 0 70.4 24.5 81.3 60.4a74.7 74.7 0 0 1-30.2 84.1c-2.4 1.5-5 2.9-7.6 4.2-7.8 3.8-16.4 5.8-25.1 5.8h-1.1a57.1 57.1 0 0 1-54.9-43.4 57 57 0 0 0 93.5 54.9 74.5 74.5 0 0 0 28.6-88.4c-.6-1.8-1.3-3.5-2.1-5.2a85.6 85.6 0 0 0-33.3-37.2A95.4 95.4 0 0 0 4.6 90.5C4.6 160.9 61.7 218 132.1 218c36.6 0 69.6-15.4 93-40.1a129 129 0 0 0 10.6-12.4Z" transform="translate(-4.6 -5)" fill="url(#edge-icon-a)" />
      <path d="M235.7 195.5c-3.7 1.9-7.5 3.6-11.4 5a125 125 0 0 1-42.1 7.4c-58.1 0-108.6-39.8-122.3-96.5a128.5 128.5 0 0 1-3.7-30.8C56.2 39.1 89.8 5.3 131.1 5h.3c37.5 0 70.4 24.5 81.3 60.4a74.7 74.7 0 0 1-30.2 84.1c-2.4 1.5-5 2.9-7.6 4.2-7.8 3.8-16.4 5.8-25.1 5.8h-1.1a57.1 57.1 0 0 1-54.9-43.4 57 57 0 0 0 93.5 54.9 74.5 74.5 0 0 0 28.6-88.4c-.6-1.8-1.3-3.5-2.1-5.2a85.6 85.6 0 0 0-33.3-37.2A95.4 95.4 0 0 0 4.6 90.5C4.6 160.9 61.7 218 132.1 218c36.6 0 69.6-15.4 93-40.1a129 129 0 0 0 10.6-12.4Z" transform="translate(-4.6 -5)" fill="url(#edge-icon-b)" opacity=".35" />
      <path d="M110.3 246.3A128 128 0 0 1 4.6 120.4c0-44 22.3-82.9 56.2-105.9A128.2 128.2 0 0 0 4.6 120.3c0 70.7 57.3 128 128 128 46.6 0 87.4-24.9 109.7-62.1-14.4 13.3-33.5 21.5-54.6 21.5-20.2 0-38.7-7.5-52.8-19.9a80.4 80.4 0 0 1-24.6 58.5Z" transform="translate(-4.6 -5)" fill="url(#edge-icon-c)" />
      <path d="M110.3 246.3A128 128 0 0 1 4.6 120.4c0-44 22.3-82.9 56.2-105.9A128.2 128.2 0 0 0 4.6 120.3c0 70.7 57.3 128 128 128 46.6 0 87.4-24.9 109.7-62.1-14.4 13.3-33.5 21.5-54.6 21.5-20.2 0-38.7-7.5-52.8-19.9a80.4 80.4 0 0 1-24.6 58.5Z" transform="translate(-4.6 -5)" fill="url(#edge-icon-d)" opacity=".41" />
      <path d="M157 153.8a57 57 0 0 1-63.3-37.7c7.5-31.7 36-55.4 70-55.4a72 72 0 0 1 70.2 55.5c.2 1.3.4 2.7.5 4.1a82.6 82.6 0 0 0-82.6-80c-45.6 0-82.6 37-82.6 82.6 0 10.1 1.8 19.7 5.1 28.6a86 86 0 0 0 82.7 2.3Z" transform="translate(-4.6 -5)" fill="url(#edge-icon-e)" />
      <path d="M157 153.8a57 57 0 0 1-63.3-37.7c7.5-31.7 36-55.4 70-55.4a72 72 0 0 1 70.2 55.5c.2 1.3.4 2.7.5 4.1a82.6 82.6 0 0 0-82.6-80c-45.6 0-82.6 37-82.6 82.6 0 10.1 1.8 19.7 5.1 28.6a86 86 0 0 0 82.7 2.3Z" transform="translate(-4.6 -5)" fill="url(#edge-icon-f)" />
    </svg>
  )
}

/**
 * Tavily — official mark from the public Tavily logo asset.
 */
export function TavilyIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>Tavily</title>
      <path
        d="M39.5137 0C45.2842 0 48.17 2.47984e-05 50.374 1.12305C52.3127 2.11089 53.8892 3.68731 54.877 5.62598C55.9998 7.82995 56 10.7153 56 16.4854V39.5146C56 45.2847 55.9998 48.17 54.877 50.374C53.8891 52.3127 52.3127 53.8891 50.374 54.877C48.17 56 45.2842 56 39.5137 56H16.4854C10.7148 56 7.82905 56 5.625 54.877C3.68646 53.8891 2.11082 52.3126 1.12305 50.374C4.91453e-05 48.17 5.27826e-10 45.2849 0 39.5146V16.4854C4.81286e-10 10.7151 4.80472e-05 7.82999 1.12305 5.62598C2.11082 3.68739 3.68646 2.11089 5.625 1.12305C7.82905 2.47984e-05 10.7148 0 16.4854 0H39.5137ZM23.8105 30.958C23.5077 30.9581 23.2076 31.0175 22.9277 31.1338C22.6478 31.2502 22.393 31.4216 22.1787 31.6367L17.7705 36.0625L16.5986 34.8867C15.7377 34.0228 14.2649 34.4498 13.9971 35.6426L12.3271 43.0713C12.2686 43.3267 12.2752 43.593 12.3477 43.8447C12.4199 44.0956 12.555 44.3246 12.7393 44.5088L12.7383 44.5107C12.922 44.6967 13.1498 44.8324 13.4004 44.9053C13.6513 44.9782 13.9173 44.9856 14.1719 44.9268L21.5713 43.25C22.7588 42.9812 23.1851 41.502 22.3242 40.6377L21.1523 39.4619L25.5615 35.0371C25.9943 34.6025 26.2373 34.012 26.2373 33.3975C26.2372 32.783 25.9942 32.1934 25.5615 31.7588L25.5029 31.6992L25.5049 31.6982L25.4434 31.6367C25.229 31.4215 24.9744 31.2503 24.6943 31.1338C24.4144 31.0174 24.1136 30.958 23.8105 30.958ZM39.7139 28.1689C38.6842 27.5158 37.3429 28.2597 37.3428 29.4824V31.1445H27.8955C28.2111 31.7502 28.3916 32.439 28.3916 33.1699C28.3915 34.2266 28.0177 35.196 27.3965 35.9521H37.3418V37.6143C37.342 38.837 38.6843 39.58 39.7139 38.9268L46.1279 34.8613C46.6077 34.5556 46.8476 34.0509 46.8477 33.5469C46.847 33.0436 46.6067 32.5399 46.126 32.2354L39.7139 28.1689ZM24.0391 10.4062C23.778 10.4051 23.5207 10.4712 23.292 10.5977C23.063 10.7243 22.869 10.9083 22.7305 11.1309L18.6807 17.5684H18.6787C18.028 18.602 18.7694 19.9499 19.9873 19.9502H21.6436V29.5137C22.3307 29.0592 23.1537 28.794 24.0381 28.7939C24.9228 28.794 25.7453 29.0599 26.4326 29.5146V19.9502H28.0898C29.3077 19.9501 30.047 18.6028 29.3975 17.5684L25.3457 11.1309C25.0415 10.6489 24.5406 10.4068 24.0391 10.4062Z"
        fill="#3C3A39"
      />
    </svg>
  )
}

/**
 * Brave Search — official Brave 2024 mark.
 */
export function BraveSearchIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 35 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>Brave Search</title>
      <path
        fill="url(#brave-search-icon-gradient)"
        fillRule="evenodd"
        d="m33.308 9.576.937-2.298S33.052 6 31.603 4.554s-4.515-.595-4.515-.595L23.594 0H11.325L7.832 3.959s-3.067-.851-4.516.595A124 124 0 0 0 .675 7.278l.937 2.298L.42 12.98s3.509 13.273 3.92 14.894c.81 3.191 1.363 4.425 3.663 6.042s6.476 4.426 7.157 4.851c.682.426 1.534 1.15 2.3 1.15.768 0 1.62-.724 2.301-1.15.682-.425 4.857-3.234 7.157-4.85 2.3-1.618 2.855-2.852 3.664-6.043.411-1.621 3.92-14.894 3.92-14.894z"
        clipRule="evenodd"
      />
      <path fill="#fff" d="M21.805 7.193c.511 0 4.303-.724 4.303-.724s4.493 5.426 4.493 6.586c0 .958-.386 1.334-.841 1.775q-.145.138-.292.293l-3.37 3.573q-.05.054-.11.113c-.336.337-.83.835-.482 1.66l.072.17c.383.894.856 1.999.254 3.118-.64 1.191-1.737 1.986-2.44 1.854s-2.354-.993-2.96-1.386c-.608-.394-2.532-1.979-2.532-2.585 0-.506 1.384-1.348 2.056-1.756.134-.082.24-.146.3-.187.07-.047.186-.119.329-.207.613-.381 1.721-1.069 1.75-1.374.034-.376.02-.486-.474-1.415a20 20 0 0 0-.356-.627c-.47-.81-.998-1.716-.881-2.365.132-.733 1.281-1.153 2.255-1.51l.355-.13 1.014-.38c.973-.364 2.053-.769 2.23-.85.248-.114.184-.223-.563-.293l-.363-.038c-.924-.098-2.63-.279-3.459-.048l-.538.147c-.931.252-2.073.56-2.182.739l-.056.083c-.105.149-.173.246-.057.879.034.188.105.56.193 1.018.258 1.342.659 3.436.71 3.906q.01.1.022.19c.064.525.107.875-.503 1.014l-.16.037c-.688.157-1.697.389-2.062.389s-1.375-.232-2.064-.39l-.158-.036c-.61-.14-.568-.489-.503-1.013l.022-.19c.05-.472.453-2.57.71-3.913.088-.456.159-.824.193-1.012.116-.633.047-.73-.057-.88q-.027-.036-.056-.083c-.11-.178-1.251-.486-2.183-.738l-.538-.147c-.829-.23-2.534-.05-3.458.048l-.363.038c-.747.07-.811.179-.564.292.178.082 1.258.486 2.23.85l1.015.38.355.132c.973.356 2.123.776 2.255 1.509.117.649-.41 1.555-.882 2.364-.127.22-.25.43-.355.628-.495.93-.508 1.04-.474 1.415.028.305 1.136.992 1.75 1.373.142.09.259.161.328.208.061.041.166.105.3.186.672.41 2.056 1.25 2.056 1.757 0 .606-1.924 2.191-2.53 2.585-.608.393-2.259 1.255-2.961 1.386-.703.132-1.8-.663-2.44-1.854-.603-1.12-.13-2.224.253-3.119l.072-.168c.35-.826-.146-1.324-.482-1.661q-.06-.06-.11-.113l-3.369-3.573a9 9 0 0 0-.292-.292c-.455-.442-.841-.818-.841-1.776 0-1.16 4.493-6.586 4.493-6.586s3.791.724 4.303.724c.407 0 1.195-.271 2.016-.554l.625-.212c1.022-.34 1.704-.343 1.704-.343s.681.002 1.704.343q.31.104.624.212c.822.283 1.61.554 2.017.554"/>
      <path fill="#fff" d="M21.154 26.384c.802.412 1.37.705 1.585.84.278.173.109.501-.144.68-.254.179-3.659 2.812-3.989 3.103l-.134.12c-.318.287-.724.652-1.012.652s-.695-.366-1.013-.652l-.133-.12c-.33-.29-3.736-2.924-3.989-3.103s-.423-.507-.145-.68c.215-.135.784-.428 1.587-.841l.762-.393c1.2-.62 2.697-1.149 2.93-1.149s1.73.528 2.93 1.149z"/>
      <defs>
        <linearGradient id="brave-search-icon-gradient" x1=".419" x2="34.5" y1="40.199" y2="40.199" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF5601" />
          <stop offset=".5" stopColor="#FF4000" />
          <stop offset="1" stopColor="#FF1F01" />
        </linearGradient>
      </defs>
    </svg>
  )
}
