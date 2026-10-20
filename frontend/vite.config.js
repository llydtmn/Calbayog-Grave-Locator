import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    // Allow Cloudflare tunnel links (any *.trycloudflare.com subdomain)
    // so the app can be opened on a phone over HTTPS (needed for location).
    allowedHosts: ['.trycloudflare.com'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'GraveLocator — Calbayog Memorial Park',
        short_name: 'GraveLocator',
        description: 'Find and manage lots, plots, and memorials at Calbayog Memorial Park.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#0284C7',
        background_color: '#0284C7',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell (JS/CSS/HTML/images/fonts) is precached for offline use.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // The admin panel isn't part of the phone app — don't make every
        // visitor pre-download it (it still loads normally at /admin).
        globIgnores: ['**/AdminRoot-*.{js,css}', '**/xlsx-*.js'],
        // Never let the service worker cache API/data responses — those must
        // always hit the network so lot/plot/memorial data stays fresh.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /\/api\/.*/,
            handler: 'NetworkOnly',
          },
          // Map tiles: cache what's been viewed so the park map still loads
          // on weak/no signal inside the cemetery.
          {
            urlPattern: /^https:\/\/(server\.arcgisonline\.com|tile\.openstreetmap\.org)\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
})