/**
 * Vitest configuration — separate from vite.config.ts to avoid type conflicts.
 * Uses vitest/config which extends Vite's defineConfig with test-specific options.
 */

import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/__tests__/**/*.test.{ts,tsx}',
      'src/**/*.test.{ts,tsx}',
      'electron/**/__tests__/**/*.test.ts',
    ],
  },
})
