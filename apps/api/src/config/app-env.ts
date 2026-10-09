/**
 * Single source of truth for which environment the API is running in.
 *
 * `APP_ENV` is set by the deployment orchestrator:
 *   - local developer machine → `APP_ENV=local` (exported by `scripts/dev-stack.sh`,
 *                                    which `up`'s the merged
 *                                    `infra/docker-compose.yml + infra/docker-compose.local.yml`
 *                                    stack; the Caddy service is disabled in the local
 *                                    override so the developer hits the API directly).
 *   - dev droplet             → `APP_ENV=dev`   (rendered into `infra/.env` on the
 *                                    droplet by `deploy/deploy.sh:render_caddyfile()`-style
 *                                    fallback chain, picked up by the compose
 *                                    `environment:` block; the CI dispatch writes
 *                                    `infra/.env.dev` from the `INFRA_ENV_DEV`
 *                                    GitHub secret).
 *   - future prod droplet     → `APP_ENV=prod`  (rendered from `INFRA_ENV_PROD` only when
 *                                    `actions → Run workflow` is dispatched with
 *                                    `app_env=prod`; gated by the GitHub `production`
 *                                    environment protection rule).
 *
 * The variable MUST be set; we do not fall back to `NODE_ENV` because NestJS
 * uses `NODE_ENV` for its own `enableCors` / validation / serializer behaviour
 * (e.g. `NODE_ENV=production` makes class-validator strip unknown fields
 * silently). Mixing the two would conflate "is this a prod build" with
 * "which env's CORS list applies".
 *
 * This module is the ONLY place that reads `APP_ENV`. Everywhere else in the
 * codebase should import `{ APP_ENV, isProd }` from this file.
 */

export type AppEnv = 'local' | 'dev' | 'prod';

const RAW = process.env.APP_ENV ?? '';

/**
 * Maps the raw `APP_ENV` value onto one of the three canonical environments.
 *
 * Pure and exported so it can be unit-tested without re-importing this module
 * (the module-level constants below are computed once, at import time, which
 * makes them impossible to re-compute in a Jest ESM test).
 *
 * Normalisation: surrounding whitespace is ignored and the comparison is
 * case-insensitive, so `Production` or ` prod ` cannot silently fall back to
 * the dev default. Anything unrecognised also falls back to `dev` — the only
 * target that is currently running — and `main.ts` logs `APP_ENV_RAW` on boot
 * so the fallback is visible in the container log.
 */
export function normaliseAppEnv(value: string | undefined): AppEnv {
  const normalised = (value ?? '').trim().toLowerCase();

  // Accept the three canonical values and a few common aliases.
  if (
    normalised === 'local' ||
    normalised === 'development' ||
    normalised === 'dev.local'
  ) {
    return 'local';
  }
  if (
    normalised === 'dev' ||
    normalised === 'staging' ||
    normalised === 'development.droplet'
  ) {
    return 'dev';
  }
  if (normalised === 'prod' || normalised === 'production') {
    return 'prod';
  }

  return 'dev';
}

export const APP_ENV: AppEnv = normaliseAppEnv(RAW);
export const APP_ENV_RAW: string = RAW || '(unset, defaulted to dev)';

/** Convenience booleans for branches that want a one-line check. */
export const isProd: boolean = APP_ENV === 'prod';
export const isDev: boolean = APP_ENV === 'dev';
export const isLocal: boolean = APP_ENV === 'local';
