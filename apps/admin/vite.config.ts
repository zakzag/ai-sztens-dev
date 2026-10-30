import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dev server proxies /api to the NestJS API so the browser never hits CORS in dev.
//
// The proxy key is a REGEX on purpose: a plain `'/api'` key is a *prefix* match,
// so it also swallows SPA routes that merely start with `/api` — `/api-keys`
// was forwarded to the API (which answers `Cannot GET /api-keys`) and the page
// could not be opened or reloaded directly. `'^/api/'` matches real API calls
// (`/api/api-keys`) and leaves client-side routes to Vite's SPA fallback.
// Production is unaffected: Caddy uses `handle /api/*` and nginx uses
// `try_files … /index.html`, so both already require the trailing slash.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: {
      '^/api/': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
