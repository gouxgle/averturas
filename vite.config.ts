import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
  server: {
    port: 5173,
    host: true,
    // Backend nativo (npm run dev:api → :3001) por defecto; API_URL lo cambia,
    // p.ej. API_URL=http://localhost:3000 para apuntar al contenedor.
    proxy: {
      '/api':     process.env.API_URL ?? 'http://localhost:3001',
      '/uploads': process.env.API_URL ?? 'http://localhost:3001',
    },
  },
})
