const codexNeutral = {
  50: 'var(--vzn-neutral-50)',
  100: 'var(--vzn-neutral-100)',
  200: 'var(--vzn-neutral-200)',
  300: 'var(--vzn-neutral-300)',
  400: 'var(--vzn-neutral-400)',
  500: 'var(--vzn-neutral-500)',
  600: 'var(--vzn-neutral-600)',
  700: 'var(--vzn-neutral-700)',
  800: 'var(--vzn-neutral-800)',
  900: 'var(--vzn-neutral-900)',
  950: 'var(--vzn-neutral-950)',
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gray: codexNeutral,
        neutral: codexNeutral,
        brand: {
          50: 'var(--vzn-blue-50)',
          100: 'var(--vzn-blue-100)',
          200: 'var(--vzn-blue-200)',
          300: 'var(--vzn-blue-300)',
          400: 'var(--vzn-blue-400)',
          500: 'var(--vzn-blue-500)',
          600: 'var(--vzn-blue-600)',
          700: 'var(--vzn-blue-700)',
          800: 'var(--vzn-blue-800)',
          900: 'var(--vzn-blue-900)',
        },
      },
      fontFamily: {
        // Keep body CSS and Tailwind utilities aligned with the native system font stack.
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto',
          'Helvetica', 'Arial', 'sans-serif',
          '"Apple Color Emoji"', '"Segoe UI Emoji"', '"Segoe UI Symbol"',
        ],
      },
      fontSize: {
        xs: ['12px', { lineHeight: '1.4' }],
        sm: ['13px', { lineHeight: '1.4' }],
        base: ['14px', { lineHeight: '1.5' }],
        lg: ['15px', { lineHeight: '1.5' }],
        xl: ['18px', { lineHeight: '1.2' }],
        '2xl': ['22px', { lineHeight: '1.2' }],
        '3xl': ['28px', { lineHeight: '1.1' }],
        '4xl': ['28px', { lineHeight: '1.1' }],
      },
      borderRadius: {
        sm: 'var(--vzn-radius-xs)',
        md: 'var(--vzn-radius-sm)',
        lg: 'var(--vzn-radius-md)',
        xl: 'var(--vzn-radius-lg)',
        '2xl': 'var(--vzn-radius-xl)',
        '3xl': 'var(--vzn-radius-2xl)',
        full: 'var(--vzn-radius-pill)',
      },
      boxShadow: {
        sm: 'var(--vzn-shadow-sm)',
        md: 'var(--vzn-shadow-md)',
        lg: 'var(--vzn-shadow-lg)',
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
