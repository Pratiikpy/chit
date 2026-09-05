import { defineConfig } from 'vite';

/**
 * Vite configuration.
 *
 * `host: true` is not optional here — the local dev loop is "run the dev server, open the
 * LAN URL on your phone inside Nimiq Pay" (research/verification/02 §8). Bound to
 * localhost, the phone would resolve `localhost` to itself and see nothing.
 */
// The API runs as its own service. Proxying keeps the app same-origin so the browser
// never has to think about CORS, and — importantly — the same proxy is applied to
// `preview`, so the built artefact can be exercised exactly as it ships rather than only
// in dev mode.
const apiProxy = {
  '/api': { target: process.env['CHIT_API_URL'] ?? 'http://localhost:8787', changeOrigin: true },
  '/health': { target: process.env['CHIT_API_URL'] ?? 'http://localhost:8787', changeOrigin: true },
};

export default defineConfig({
  server: { host: true, port: 5173, proxy: apiProxy },
  preview: { host: true, port: 4173, proxy: apiProxy },
  build: {
    target: 'es2022',
    // The performance budget is <150 KB gzipped initial JS (DESIGN.md §7). Warn well
    // before that so a heavy import is noticed on the commit that adds it.
    chunkSizeWarningLimit: 200,
    sourcemap: true,
  },
});
