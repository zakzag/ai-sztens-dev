import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema.js';
import {
  DATABASE_PROBE_TIMEOUT_MS,
  DATABASE_SKIP_REASON,
  probeDatabase,
} from './lib/database-gate.js';

/**
 * The database gate decides whether the persistence suite **runs** or
 * **self-skips**, so a broken gate is invisible in two directions: it can skip
 * real coverage (a silent pass) or fail a healthy run (a false alarm). This spec
 * pins the "unreachable" branch, which is the one that cannot be exercised by
 * `api-keys.e2e-spec.ts` on a machine without Postgres.
 */

/** Port 1 is reserved and never listens, so the connection is refused at once. */
const UNREACHABLE_URL = 'postgres://gate:gate@127.0.0.1:1/never';

describe('database gate', () => {
  it('reports an unreachable database instead of throwing', async () => {
    const client = postgres(UNREACHABLE_URL, { max: 1, connect_timeout: 1 });
    const database = drizzle(client, { schema });

    try {
      await expect(probeDatabase(database, 2000)).resolves.toBe(false);
    } finally {
      await client.end({ timeout: 1 });
    }
  });

  it('keeps the probe timeout short enough for a test run', () => {
    expect(DATABASE_PROBE_TIMEOUT_MS).toBeGreaterThan(0);
    expect(DATABASE_PROBE_TIMEOUT_MS).toBeLessThanOrEqual(5000);
  });

  it('tells the operator how to enable the suite', () => {
    expect(DATABASE_SKIP_REASON).toContain('pnpm db:up');
  });
});
