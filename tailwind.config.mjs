/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './quick-chat.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['SF Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        glass: {
          bg: 'rgba(255,255,255,0.07)',
          'bg-hover': 'rgba(255,255,255,0.11)',
          'bg-active': 'rgba(255,255,255,0.15)',
          border: 'rgba(255,255,255,0.12)',
          'border-strong': 'rgba(255,255,255,0.22)',
        },
        accent: {
          DEFAULT: '#0A84FF',
          hover: '#409CFF',
          muted: 'rgba(10,132,255,0.15)',
          'muted-hover': 'rgba(10,132,255,0.25)',
        },
        surface: {
          bg: '#080811',
          overlay: 'rgba(8,8,17,0.6)',
        },
      },
      backdropBlur: { glass: '40px', 'glass-sm': '20px' },
      backdropSaturate: { glass: '180%' },
      animation: {
        'shimmer': 'shimmer 2s infinite',
        'dot-bounce': 'dotBounce 1.4s ease-in-out infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'spin-slow': 'spin 2s linear infinite',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        dotBounce: {
          '0%,80%,100%': { transform: 'scale(0)', opacity: '0.4' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
        fadeIn: { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'none' } },
      },
      borderRadius: { xl: '12px', '2xl': '16px', '3xl': '20px', '4xl': '24px' },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)',
        'glass-sm': '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)',
        'glass-lg': '0 16px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.22)',
        'glow-accent': '0 0 20px rgba(10,132,255,0.4)',
        'glow-sm': '0 0 10px rgba(10,132,255,0.25)',
      },
    },
  },
}
