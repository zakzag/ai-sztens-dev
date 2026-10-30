import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Resolving `DATABASE_URL` for tools that do not read dotenv files.
 *
 * The API itself loads its values through `@nestjs/config`
 * (`apps/api/src/app.module.ts`), but `drizzle-kit` and the standalone
 * migration runner are plain Node processes: they only see `process.env`.
 * Instead of duplicating the credential in yet another place, this helper
 * follows the same order the API does, so a developer never has to export
 * anything:
 *
 *   1. an already exported `DATABASE_URL` (CI, droplet, one-off override);
 *   2. `apps/api/.env.local` — the developer override;
 *   3. `infra/.env.local` — composed into a URL from the very credentials the
 *      postgres container was bootstrapped with (`AISZTENS_DB_USER`,
 *      `AISZTENS_DB_PASSWORD`, `POSTGRES_DB`). This keeps a single source of
 *      truth for the local database password.
 *
 * Node's built-in `process.loadEnvFile()` is used, so no dependency is added.
 * Values already present in `process.env` win over file contents.
 */

const LOCAL_HOST = 'localhost';
const LOCAL_PORT = 5432;
const DEFAULT_USER = 'aisztens';
const DEFAULT_DATABASE = 'aisztens_db';

/**
 * The API package directory.
 *
 * `pnpm --filter @callback/api …` runs with `cwd = apps/api`, which is also the
 * only supported invocation for the `db:*` scripts. When the module is loaded
 * from the repository root instead (ad-hoc `node` runs), `apps/api` is
 * appended, so the dotenv lookup still finds the right files.
 */
function findApiDir(): string {
  const candidates = [process.cwd(), join(process.cwd(), 'apps', 'api')];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'drizzle.config.ts'))) return dir;
  }
  return process.cwd();
}

const API_DIR = findApiDir();
const REPO_DIR = join(API_DIR, '..', '..');

/**
 * Load a dotenv file into `process.env` when it exists.
 *
 * @returns `true` when a file was found and loaded, `false` when it is absent.
 * @throws When the file exists but cannot be parsed (misconfiguration must not
 * be swallowed — a silent half-loaded environment is worse than a hard stop).
 */
export function loadEnvFileIfPresent(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  try {
    process.loadEnvFile(filePath);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read ${filePath}: ${reason}`);
  }
  return true;
}

/**
 * Best-effort resolution of the connection string.
 *
 * @returns the URL, or `undefined` when nothing usable is configured. Used by
 * `drizzle.config.ts`, which must keep working offline: `db:generate` and
 * `db:check` never connect to a database.
 */
export function tryResolveDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  loadEnvFileIfPresent(join(API_DIR, '.env.local'));
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  loadEnvFileIfPresent(join(REPO_DIR, 'infra', '.env.local'));
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const password = process.env.AISZTENS_DB_PASSWORD;
  if (!password) return undefined;

  const user = process.env.AISZTENS_DB_USER ?? DEFAULT_USER;
  const database = process.env.POSTGRES_DB ?? DEFAULT_DATABASE;
  return `postgres://${user}:${password}@${LOCAL_HOST}:${LOCAL_PORT}/${database}`;
}

/**
 * Strict resolution for processes that actually connect (the migration runner).
 *
 * @throws Always, with an actionable message, when no URL can be resolved —
 * a wrong-password fallback would surface much later as an opaque
 * `password authentication failed`.
 */
export function resolveDatabaseUrl(): string {
  const url = tryResolveDatabaseUrl();
  if (url) return url;
  throw new Error(
    'DATABASE_URL is not set. Set it in apps/api/.env.local, export it, or make ' +
      'infra/.env.local contain AISZTENS_DB_PASSWORD — see ' +
      'docs/Specs/Database-Local.md §3.',
  );
}
