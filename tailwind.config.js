/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        // System font stack — căn chỉnh với body CSS, tự động dùng font native của từng OS
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto',
          'Helvetica', 'Arial', 'sans-serif',
          '"Apple Color Emoji"', '"Segoe UI Emoji"', '"Segoe UI Symbol"',
        ],
      },
      fontSize: {
        // Typography scale chuẩn cho Electron Desktop App (đơn vị px tuyệt đối)
        // Tham khảo: macOS HIG (~13pt body), Windows Fluent (14px body), Linux GNOME (14-15px)
        'xs':   ['12px', { lineHeight: '1.4' }],  // Caption, annotation, badge text
        'sm':   ['13px', { lineHeight: '1.4' }],  // Sidebar, menu, UI label, control text
        'base': ['14px', { lineHeight: '1.5' }],  // Body text — "con số vàng" cho Desktop
        'lg':   ['15px', { lineHeight: '1.5' }],  // Content area (textarea, transcript...)
        'xl':   ['18px', { lineHeight: '1.2' }],  // H3 — Block/Panel title
        '2xl':  ['22px', { lineHeight: '1.2' }],  // H2 — Section title
        '3xl':  ['28px', { lineHeight: '1.1' }],  // H1 — Page title
        '4xl':  ['28px', { lineHeight: '1.1' }],  // Alias cho H1 (tương thích)
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
