import { defineConfig } from 'drizzle-kit';
import { tryResolveDatabaseUrl } from './src/db/database-url.js';

/**
 * Drizzle Kit configuration for the AIsztens API.
 *
 * - `schema` points at the schema-as-code source (the single source of truth).
 * - `out` is where versioned SQL migrations and the `meta/` snapshot are
 *   written. Both must be committed.
 * - `migrations` pins where the bookkeeping table lives. It is `platform`
 *   (the operations context) rather than Drizzle's default `drizzle` schema, so
 *   the documented three-schema boundary (`platform`, `callback`, `email`)
 *   stays intact. `02-schemas.sh` grants the app role CREATE on `platform` for
 *   exactly this table, and the migration runner passes the same values.
 * - `dbCredentials.url` is only used by commands that touch a live database
 *   (`drizzle-kit migrate` / `push`). `db:generate` and `db:check` work
 *   offline, which is why the resolution below tolerates a missing URL: the
 *   fallback is a deliberately unusable sentinel, so a command that really
 *   needs a database fails immediately with an obvious connection error
 *   instead of silently connecting somewhere unexpected.
 *
 * See `src/db/database-url.ts` for the resolution order and rationale.
 */

const UNRESOLVED_DATABASE_URL =
  'postgres://database-url-not-configured@127.0.0.1:1/no_database';

const databaseUrl = tryResolveDatabaseUrl();
if (!databaseUrl) {
  console.warn(
    '[drizzle.config] DATABASE_URL could not be resolved — offline commands ' +
      '(db:generate, db:check) still work; anything that connects will fail. ' +
      'See docs/Specs/Database-Local.md §3.',
  );
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  migrations: {
    schema: 'platform',
    table: '__drizzle_migrations',
  },
  strict: true,
  verbose: true,
  dbCredentials: {
    url: databaseUrl ?? UNRESOLVED_DATABASE_URL,
  },
});
