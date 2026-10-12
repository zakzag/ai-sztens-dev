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
  /** UTC build timestamp of the image, ISO 8601 (e.g. `2026-10-12T12:34:56Z`). */
  readonly VITE_DEPLOY_DATE?: string;
  /** Full 40-character git SHA of the deployed revision. */
  readonly VITE_COMMIT_HASH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
