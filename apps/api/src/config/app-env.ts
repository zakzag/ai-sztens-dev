/**
 * Single source of truth for which environment the API is running in.
 *
 * `APP_ENV` is set by the deployment orchestrator:
 *   - local developer machine → `APP_ENV=local` (see scripts/dev-stack.sh, future PR)
 *   - dev droplet            → `APP_ENV=dev`   (via infra/.env.dev → compose environment)
 *   - future prod droplet    → `APP_ENV=prod`  (via infra/.env.prod → compose environment)
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

function normalise(value: string): AppEnv {
  // Accept the three canonical values and a few common aliases.
  if (value === 'local' || value === 'development' || value === 'dev.local') return 'local';
  if (value === 'dev' || value === 'staging' || value === 'development.droplet') return 'dev';
  if (value === 'prod' || value === 'production') return 'prod';
  // Default: if APP_ENV is unset we assume the dev droplet (the only currently
  // running target). If a real prod droplet comes online without APP_ENV=prod,
  // the log line emitted by `main.ts` will shout about it.
  return 'dev';
}

export const APP_ENV: AppEnv = normalise(RAW);
export const APP_ENV_RAW: string = RAW || '(unset, defaulted to dev)';

/** Convenience booleans for branches that want a one-line check. */
export const isProd: boolean = APP_ENV === 'prod';
export const isDev: boolean = APP_ENV === 'dev';
export const isLocal: boolean = APP_ENV === 'local';