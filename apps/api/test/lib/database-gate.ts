/**
 * Gate for the e2e suite that persists real rows.
 *
 * The problem
 * -----------
 * `api-keys.e2e-spec.ts` proves persistence against a **real** Postgres, which
 * is the point of that suite. On a bare checkout (no `pnpm db:up`) every call
 * fails inside the repository with `ECONNREFUSED :5432`, the filter correctly
 * answers `500`, and the spec reports six assertion failures plus a failing
 * `afterAll` cleanup — none of which says anything about the envelope contract
 * the suite is there to protect.
 *
 * The workaround used here
 * ------------------------
 * `beforeAll` probes the connection with `select 1` (short timeout) and, when it
 * fails, warns loudly and leaves the app/DB handles unset so every test
 * self-skips — the same "loud skip, never a silent pass" rule as
 * `app-module-gate.ts`. With a running database (`pnpm db:up` + `DATABASE_URL`)
 * the suite executes fully.
 */

import { sql } from 'drizzle-orm';
import type { Database } from '../../src/db/database.interface.js';

/** How long the probe waits before declaring the database unreachable. */
export const DATABASE_PROBE_TIMEOUT_MS = 3000;

/** Warning text printed instead of a silent skip. */
export const DATABASE_SKIP_REASON =
  'skipped: no Postgres reachable — run `pnpm db:up` (and set DATABASE_URL) ' +
  'to execute the persistence suite';

/**
 * Races a probe query against a timeout.
 *
 * @param probe - the in-flight `select 1`.
 * @param timeoutMs - maximum wait.
 * @returns `true` when the query settled successfully within the timeout.
 */
async function settlesWithin(
  probe: Promise<unknown>,
  timeoutMs: number,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });

  try {
    return await Promise.race([probe.then(() => true), timeout]);
  } catch {
    // A rejected probe is exactly the "unreachable" case; the caller logs it.
    return false;
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/**
 * @param database - the injected Drizzle handle.
 * @param timeoutMs - maximum wait for the probe.
 * @returns `true` when the database answered `select 1`.
 */
export async function probeDatabase(
  database: Database,
  timeoutMs: number = DATABASE_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  return settlesWithin(database.execute(sql`select 1 as ok`), timeoutMs);
}
