import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const DEFAULT_DEV_PROXY_TARGET = 'http://161.153.193.159:8080'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.DEV_API_PROXY_TARGET || DEFAULT_DEV_PROXY_TARGET

  return {
    plugins: [tailwindcss()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/health': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
