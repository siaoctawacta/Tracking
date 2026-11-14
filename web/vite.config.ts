import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In development the SPA and API share an origin through this proxy.
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: false } },
  },
  preview: {
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: false } },
  },
})
