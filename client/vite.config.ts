import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The client talks to the API through /api, so no CORS config or hard-coded host is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3001' },
  },
})
