import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit configuration for the AIsztens API.
 *
 * - `schema` points at the schema-as-code source. It is a placeholder for
 *   now; the real `callback_requests` table lands in AIS-36.
 * - `out` is where versioned SQL migrations and the `meta/` snapshot are
 *   written. Both must be committed.
 * - `dbCredentials.url` is only used by commands that touch a live database.
 *   `db:generate` and `db:check` work offline. The local Docker Postgres
 *   (see `infra/docker-compose.db.yml`) listens on localhost:5432, so the
 *   fallback points there; set `DATABASE_URL` to override.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgres://aisztens:aisztens@localhost:5432/aisztens_db',
  },
});
