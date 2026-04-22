import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    // Serve .wasm and .onnx files with correct MIME types so
    // onnxruntime-web and @ricky0123/vad-web can load them at runtime.
    headers: {
      'Cross-Origin-Opener-Policy':   'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  // Prevent Vite from pre-bundling packages that ship WASM/ONNX/AudioWorklet
  // assets — they must be served as-is from the public/ directory.
  optimizeDeps: {
    exclude: ['@ricky0123/vad-web', 'onnxruntime-web'],
  },
  // Tell Vite to treat .onnx and .wasm files as static assets so they are
  // copied verbatim into dist/ and not transformed by any plugin.
  assetsInclude: ['**/*.onnx', '**/*.wasm'],
})
