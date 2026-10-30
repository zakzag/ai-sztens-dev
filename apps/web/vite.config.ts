import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dev server proxies /api to the NestJS API so the browser never hits CORS in dev.
//
// The key is a REGEX (`^/api/`), not the prefix `'/api'`: a prefix match would
// also capture any SPA route starting with `/api` and answer it with the API's
// 404 instead of `index.html` (same fix as `apps/admin/vite.config.ts`).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '^/api/': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
