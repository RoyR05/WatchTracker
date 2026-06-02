import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Use the static RaineyFlixs manifest in /public/manifest.json
      // (linked manually in index.html) instead of generating one here.
      manifest: false,
      includeAssets: [
        'icons/favicon.ico',
        'icons/favicon-16x16.png',
        'icons/favicon-32x32.png',
        'icons/apple-touch-icon.png',
        'manifest.json',
      ],
      // Switch to injectManifest so we can write custom push event handling
      // in src/sw.ts while still using Workbox for precaching + runtime caching.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
});
