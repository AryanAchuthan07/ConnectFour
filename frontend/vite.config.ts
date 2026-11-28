import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// The backend's port on the host during development.
const backend = 'http://localhost:8081'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  server: {
    port: 5173,
    strictPort: true,
    // Forward the same paths as nginx.conf. Keys starting with ^ are regular expressions.
    proxy: {
      '^/api/': backend,
      '^/healthz$': backend,
    },
  },
})
