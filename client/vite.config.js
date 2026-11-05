import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// Override when port 5000 is taken (e.g. macOS AirPlay Receiver): VITE_PROXY_TARGET=http://localhost:5001
// Which commit this build came from (set by Vercel). Shown as <meta name="app-commit"> so a deployment can be verified.
process.env.VITE_APP_COMMIT = process.env.VITE_APP_COMMIT || (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7)

const apiTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:5000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/socket.io': {
        target: apiTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
