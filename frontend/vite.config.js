import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React — changes rarely, cache-busting stays minimal
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Charting library is large (~200KB) — keep separate
          'vendor-charts': ['recharts'],
          // Icons — tree-shakeable but keeping separate for clarity
          'vendor-icons': ['lucide-react'],
        }
      }
    },
    // Warn on chunks > 500KB
    chunkSizeWarningLimit: 500,
  },
  server: {
    // Expose on network for mobile testing
    host: true,
  }
})

