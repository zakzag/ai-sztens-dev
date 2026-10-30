import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { resolveDatabaseUrl } from './db/database-url.js';

/**
 * Standalone migration runner — the implementation behind `db:migrate`
 * (`node dist/migrate.js`, see `apps/api/package.json`).
 *
 * It applies the versioned SQL migrations from `apps/api/drizzle/` and records
 * them in `platform.__drizzle_migrations` (both values also live in
 * `drizzle.config.ts`, so `drizzle-kit migrate` and this runner agree).
 *
 * SCOPE (AIS-36): apply + bookkeeping only. Concurrency hardening — a
 * `pg_advisory_lock`, `lock_timeout=5s`, `statement_timeout=60s` and the
 * "second concurrent runner waits or exits" behaviour — belongs to Story 3
 * ("run migrations in the deploy pipeline") and lands in THIS file, so the
 * script name and the invocation path never change again.
 *
 * Failure policy: any error is printed once and turns into a non-zero exit code
 * so a deploy pipeline (or a developer's `&&` chain) can rely on it.
 */
async function runMigrations(): Promise<void> {
  const url = resolveDatabaseUrl();
  // max: 1 — the migrator is a single sequential writer; a pool would only
  // make the connection lifecycle harder to reason about.
  // onnotice: the migrations use `CREATE SCHEMA IF NOT EXISTS`, which emits a
  // "schema already exists, skipping" NOTICE on every run after the first.
  // postgres.js prints NOTICEs to the console by default, which would make a
  // normal no-op run look like it had problems.
  const client = postgres(url, { max: 1, onnotice: () => undefined });

  try {
    const db = drizzle(client);
    await migrate(db, {
      migrationsFolder: 'drizzle',
      migrationsSchema: 'platform',
      migrationsTable: '__drizzle_migrations',
    });
    console.log(
      '[db:migrate] migrations applied (bookkeeping: platform.__drizzle_migrations)',
    );
  } finally {
    // Never leave the socket open: an unclosed postgres.js client keeps the
    // process alive and the CI job would hang instead of failing.
    await client.end({ timeout: 5 });
  }
}

runMigrations().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[db:migrate] failed: ${message}`);
  process.exitCode = 1;
});
