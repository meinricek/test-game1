import { defineConfig } from 'vite';

// base './' => funguje na GitHub Pages v podsložce /<repo>/ i lokálně.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
  server: { host: true },
});
