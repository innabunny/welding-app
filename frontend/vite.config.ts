import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// в докере бэк доступен по имени сервиса, локально — на localhost
const apiTarget = process.env.VITE_API_TARGET ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // в докере на macOS события файлов через bind mount доходят не всегда
    watch: process.env.VITE_USE_POLLING ? { usePolling: true, interval: 300 } : undefined,
    proxy: {
      // Host не подменяем: «backend:8000» Django отклонит (DisallowedHost),
      // а localhost при DEBUG разрешён без ALLOWED_HOSTS
      '/api': {
        target: apiTarget,
        changeOrigin: false,
      },
    },
  },
})
