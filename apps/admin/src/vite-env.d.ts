/// <reference types="vite/client" />

/**
 * Build-metadata variables injected at image build time by
 * [`.github/workflows/images.yml`](../../../.github/workflows/images.yml)
 * (see the `VITE_DEPLOY_DATE` / `VITE_COMMIT_HASH` build args in
 * [`infra/admin/Dockerfile`](../../../infra/admin/Dockerfile)).
 *
 * They are absent during local development, hence optional.
 */
interface ImportMetaEnv {
  /**
   * Base URL of the API, e.g. `/api` behind the Vite dev proxy or
   * `https://api.aisztens.hu/api` on the droplets. Consumed only by
   * [`services/api-client.ts`](./services/api-client.ts); when missing, the
   * client falls back to `/api`.
   */
  readonly VITE_API_BASE_URL?: string;
  /** UTC build timestamp of the image, ISO 8601 (e.g. `2026-10-12T12:34:56Z`). */
  readonly VITE_DEPLOY_DATE?: string;
  /** Full 40-character git SHA of the deployed revision. */
  readonly VITE_COMMIT_HASH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
