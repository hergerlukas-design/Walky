import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Rückfrage statt automatischem Austausch: Ein selbsttätiger Neustart
      // würde mitten im Gespräch die Kanalverbindung kappen. Der neue
      // Service Worker wartet, bis jemand im Banner zustimmt.
      registerType: 'prompt',
      // Registriert wird ausschließlich über useRegisterSW, sonst liefe die
      // Anmeldung doppelt.
      injectRegister: null,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        name: 'Walky — Walkie-Talkie',
        short_name: 'Walky',
        // Das Manifest ist eine einzelne statische Datei und kennt keine
        // Sprachvarianten. Englisch erreicht mehr Leute; die Oberfläche
        // selbst richtet sich nach der Browsersprache.
        description:
          'Push-to-talk for groups: join a channel, press the button, speak. No call, no app store.',
        lang: 'en',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0f14',
        theme_color: '#0b0f14',
        categories: ['communication', 'utilities'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Open a new channel',
            short_name: 'New channel',
            url: '/?neu=1',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,wav}'],
        // Jede unbekannte Route auf die SPA-Shell mappen (/kanal/abc123).
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // Kein clientsClaim/skipWaiting: Der wartende Worker übernimmt erst,
        // wenn das Banner bestätigt wurde.
        clientsClaim: false,
      },
      devOptions: {
        // Service Worker auch im Dev-Server, damit PWA-Verhalten testbar ist.
        enabled: false,
        type: 'module',
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Der Dev-Server reicht die WebSockets an den Signaling-Server weiter.
      // Dadurch braucht die App auch lokal keine abweichende Konfiguration
      // und verhält sich wie im Deployment (ein Origin für alles).
      '/ws': { target: 'ws://127.0.0.1:8080', ws: true, changeOrigin: true },
      '/healthz': { target: 'http://127.0.0.1:8080', changeOrigin: true },
    },
  },
  preview: {
    host: true,
    port: 4173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
