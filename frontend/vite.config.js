import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = (env.VITE_PROXY_TARGET || env.VITE_API_BASE || 'http://localhost:5001').replace(/\/$/, '')

  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_DEV_PORT || 5173),
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false
        }
      }
    },
    build: {
      // Increase chunk size warning threshold (face-api.js models are large)
      chunkSizeWarningLimit: 2000,
      // Disable sourcemaps in production for faster builds and smaller deploys
      sourcemap: false,
      rollupOptions: {
        output: {
          // Manual chunk splitting to keep individual bundle sizes reasonable
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['framer-motion', 'react-hot-toast'],
            'supabase': ['@supabase/supabase-js'],
            'pdf': ['jspdf'],
            'face-api': ['@vladmandic/face-api', 'face-api.js']
          }
        }
      }
    }
  }
})
