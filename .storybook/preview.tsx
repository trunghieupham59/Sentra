import type { Preview } from '@storybook/react'
import { withThemeByClassName } from '@storybook/addon-themes'
import '../src/index.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      disable: true,
    },
    layout: 'centered',
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'button-name', enabled: true },
          { id: 'image-alt', enabled: true },
        ],
      },
    },
  },
  decorators: [
    withThemeByClassName({
      themes: {
        light: '',
        dark: 'dark',
      },
      defaultTheme: 'light',
    }),
    (Story) => (
      <div
        className="antialiased min-h-screen"
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif",
          background: 'var(--apple-bg-primary)',
          color: 'var(--apple-label-primary)',
          padding: '24px',
        }}
      >
        <Story />
      </div>
    ),
  ],
}

export default preview
