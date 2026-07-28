import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The SPA is served under /app so the marketing site can own the root. Vite
// rewrites bundled asset URLs for us; anything fetched by a hand-written string
// (words.db, sql-wasm.wasm, reader JSON) must go through `assetUrl()` instead —
// see src/lib/assets.ts.
export default defineConfig({
  base: '/app/',
  plugins: [react()],
})
