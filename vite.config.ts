import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'favicon-32.png', 'damac.png', 'image.png', 'damac.jpg', 'apple-touch-icon.png', 'icons/*.png', 'icons/*.ico'],
      manifest: {
        name: 'DAMAC - Durrah Al Munawwara Admin Console',
        short_name: 'DAMAC',
        description: 'Durrah Al Munawwara admin console - quotes, inbox, knowledge base, AI',
        theme_color: '#f36b21',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: (() => {
      // SPA routes (/quotes, /kb, …) share paths with the API. On refresh the
      // browser navigates with Accept: text/html — serve index.html instead of
      // proxying, or the backend returns {"error":"Authentication required"}.
      const apiTarget = 'http://127.0.0.1:3000'
      const spaBypass = (req: { headers: { accept?: string } }) => {
        if (req.headers.accept?.includes('text/html')) {
          return '/index.html'
        }
      }
      const apiProxy = {
        target: apiTarget,
        bypass: spaBypass,
      }
      return {
        '/auth': apiProxy,
        '/quotes': apiProxy,
        '/kb': apiProxy,
        '/chat': apiProxy,
        '/push': apiProxy,
        '/conversations': apiProxy,
        '/health': apiProxy,
        '/socket.io': {
          target: apiTarget,
          ws: true,
        },
      }
    })(),
  },
})
