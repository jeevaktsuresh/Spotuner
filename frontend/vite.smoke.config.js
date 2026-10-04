import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * SSR build for the Node-side test scripts.
 *
 * Both `check-recommend.mjs` and `render-smoke.mjs` import application source
 * that contains JSX, so they need transpiling. Kept separate from the app
 * config so it cannot affect the real build.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    ssr: true,
    outDir: 'node_modules/.test-bundle',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: {
        recommend: 'scripts/check-recommend.mjs',
        render: 'scripts/render-smoke.mjs',
        live: 'scripts/live-check.mjs',
        home: 'scripts/check-home.mjs',
      },
    },
  },
  ssr: {
    external: ['react', 'react-dom', 'react-dom/server', 'react-router-dom'],
  },
});
